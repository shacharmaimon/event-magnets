import { NextResponse } from "next/server";
import sharp from "sharp";
import { randomUUID } from "crypto";
import { getUserFromRequest } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase";
import { compositeMagnet } from "@/lib/composite";
import type { Orientation } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30; // headroom for sharp on cold starts

type Params = { params: Promise<{ id: string }> };

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB (client shrinks to ~2000px first)
const MAX_COPIES = 20;

// Admin-uploaded photos share one synthetic device id. device_id is NOT NULL and
// only the guest per-device limit ever reads it — which we skip here — so this
// flows through the gallery/zip/print-sheets untouched.
const ADMIN_DEVICE_ID = "admin-upload";

function rawMeta(format?: string): { ext: string; type: string } {
  if (format === "png") return { ext: "png", type: "image/png" };
  if (format === "webp") return { ext: "webp", type: "image/webp" };
  return { ext: "jpg", type: "image/jpeg" };
}

// POST /api/events/[id]/submissions/upload — ADMIN. Composite one photo with a
// chosen frame and add it as N copies (no open-check, no per-device limit).
//
// Two request shapes:
// - JSON  { originalId, frameId, orientation, copies }: composite from an
//   already-uploaded original photo (the "upload once, feed both" flow) — no
//   image bytes travel here, so committing magnets is near-instant.
// - multipart { file, frameId, orientation, copies }: legacy/fallback path that
//   uploads the image directly.
export async function POST(request: Request, { params }: Params) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id: eventId } = await params;
  const contentType = request.headers.get("content-type") ?? "";
  const admin = createAdminClient();

  // --- Gather inputs from either JSON (by-reference) or multipart (by-file) ---
  let frameId: string;
  let orientation: string;
  let copiesRaw: number;
  let originalId: string | null = null;
  let file: File | null = null;

  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => ({}));
    frameId = typeof body?.frameId === "string" ? body.frameId : "";
    orientation = body?.orientation;
    copiesRaw = Number(body?.copies ?? 1);
    originalId = typeof body?.originalId === "string" ? body.originalId : null;
    if (!originalId) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }
  } else {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json({ error: "no_file" }, { status: 400 });
    }
    const f = form.get("file");
    if (!(f instanceof File)) {
      return NextResponse.json({ error: "no_file" }, { status: 400 });
    }
    if (f.size > MAX_BYTES) {
      return NextResponse.json({ error: "file_too_large" }, { status: 400 });
    }
    file = f;
    frameId = typeof form.get("frameId") === "string" ? (form.get("frameId") as string) : "";
    orientation = form.get("orientation") as string;
    copiesRaw = Number(form.get("copies") ?? 1);
  }

  if (
    !frameId ||
    (orientation !== "portrait" && orientation !== "landscape")
  ) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  const copies =
    Number.isInteger(copiesRaw) && copiesRaw >= 1
      ? Math.min(copiesRaw, MAX_COPIES)
      : 1;

  // --- Event must exist (open OR closed — admin uploads either way) ---
  const { data: event } = await admin
    .from("events")
    .select("id")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) {
    return NextResponse.json({ error: "not_available" }, { status: 404 });
  }

  // --- Frame must belong to this event, orientation must match ---
  const { data: frame } = await admin
    .from("frames")
    .select(
      "event_id, storage_path, orientation, window_x, window_y, window_w, window_h",
    )
    .eq("id", frameId)
    .maybeSingle();
  if (!frame || frame.event_id !== event.id) {
    return NextResponse.json({ error: "invalid_frame" }, { status: 400 });
  }
  if (frame.orientation !== orientation) {
    return NextResponse.json(
      { error: "orientation_mismatch" },
      { status: 400 },
    );
  }

  // --- Resolve the source photo bytes + the path we'll record as the raw. ---
  // For a by-reference commit, the original is already stored; we reuse its path
  // as raw_storage_path (no duplicate upload). For a by-file commit, we upload.
  let rawBytes: Buffer;
  let rawStoragePath: string;
  let rawFormat: string | undefined;
  const uploaded: string[] = [];

  if (originalId) {
    const { data: original } = await admin
      .from("original_photos")
      .select("event_id, storage_path")
      .eq("id", originalId)
      .maybeSingle();
    if (!original || original.event_id !== event.id) {
      // Its upload may not have landed yet — let the client retry this one.
      return NextResponse.json({ error: "original_not_ready" }, { status: 409 });
    }
    const { data: origBlob, error: origErr } = await admin.storage
      .from("submissions")
      .download(original.storage_path);
    if (origErr || !origBlob) {
      return NextResponse.json({ error: "original_not_ready" }, { status: 409 });
    }
    rawBytes = Buffer.from(await origBlob.arrayBuffer());
    rawStoragePath = original.storage_path; // reuse — don't duplicate storage
  } else {
    rawBytes = Buffer.from(await (file as File).arrayBuffer());
  }

  try {
    // Validate the photo is a real image.
    try {
      rawFormat = (await sharp(rawBytes).metadata()).format;
    } catch {
      return NextResponse.json({ error: "invalid_type" }, { status: 400 });
    }
    if (!rawFormat) {
      return NextResponse.json({ error: "invalid_type" }, { status: 400 });
    }

    // Download the frame PNG bytes.
    const { data: frameBlob, error: dlErr } = await admin.storage
      .from("frames")
      .download(frame.storage_path);
    if (dlErr || !frameBlob) {
      return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
    const frameBytes = Buffer.from(await frameBlob.arrayBuffer());

    // The frame's opening (if detected) — cover-crop the photo into it.
    const window =
      frame.window_x != null &&
      frame.window_y != null &&
      frame.window_w != null &&
      frame.window_h != null
        ? {
            x: frame.window_x,
            y: frame.window_y,
            w: frame.window_w,
            h: frame.window_h,
          }
        : null;

    // Frame + photo -> print-ready magnet (shared pipeline).
    const finished = await compositeMagnet(
      rawBytes,
      frameBytes,
      orientation as Orientation,
      { window },
    );

    const rowId = randomUUID();
    const finishedPath = `${event.id}/${rowId}-finished.jpg`;

    // Only upload a raw copy for the by-file path; by-reference reuses the
    // original's stored path.
    if (!originalId) {
      const raw = rawMeta(rawFormat);
      rawStoragePath = `${event.id}/${rowId}-raw.${raw.ext}`;
      const { error: rawErr } = await admin.storage
        .from("submissions")
        .upload(rawStoragePath, rawBytes, {
          contentType: raw.type,
          upsert: false,
        });
      if (rawErr) throw new Error("raw_upload");
      uploaded.push(rawStoragePath);
    }

    const { error: finErr } = await admin.storage
      .from("submissions")
      .upload(finishedPath, finished, {
        contentType: "image/jpeg",
        upsert: false,
      });
    if (finErr) throw new Error("finished_upload");
    uploaded.push(finishedPath);

    // Record N rows (one per copy), all sharing the finished image — identical
    // to a guest submission, so copies collapse to ×N and print N times.
    const row = {
      event_id: event.id,
      frame_id: frameId,
      device_id: ADMIN_DEVICE_ID,
      raw_storage_path: rawStoragePath!,
      finished_storage_path: finishedPath,
      orientation,
    };
    const { error: insErr } = await admin
      .from("submissions")
      .insert(Array.from({ length: copies }, () => row));
    if (insErr) throw new Error("insert");

    return NextResponse.json({ ok: true, created: copies }, { status: 201 });
  } catch {
    if (uploaded.length > 0) {
      await admin.storage.from("submissions").remove(uploaded);
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
