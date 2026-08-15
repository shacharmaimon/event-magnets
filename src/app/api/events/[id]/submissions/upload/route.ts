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

// POST /api/events/[id]/submissions/upload — ADMIN. Composite one uploaded photo
// with a chosen frame and add it to the event as N copies, exactly like a guest
// submission but with NO open-check and NO per-device limit. One photo per
// request (the client uploads a batch sequentially with a progress bar).
export async function POST(request: Request, { params }: Params) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id: eventId } = await params;

  // --- Parse + validate the multipart form ---
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "no_file" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "no_file" }, { status: 400 });
  }
  const frameId = form.get("frameId");
  const orientation = form.get("orientation");
  if (
    typeof frameId !== "string" ||
    (orientation !== "portrait" && orientation !== "landscape")
  ) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  const copiesRaw = Number(form.get("copies") ?? 1);
  const copies =
    Number.isInteger(copiesRaw) && copiesRaw >= 1
      ? Math.min(copiesRaw, MAX_COPIES)
      : 1;
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file_too_large" }, { status: 400 });
  }

  const admin = createAdminClient();

  // --- Event must exist (but may be OPEN or CLOSED — admin uploads either way) ---
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

  const rawBytes = Buffer.from(await file.arrayBuffer());
  const uploaded: string[] = [];

  try {
    // Validate the photo is a real image + get its format for the raw upload.
    let photoFormat: string | undefined;
    try {
      photoFormat = (await sharp(rawBytes).metadata()).format;
    } catch {
      return NextResponse.json({ error: "invalid_type" }, { status: 400 });
    }
    if (!photoFormat) {
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

    // The frame's opening (if detected) — place the whole photo inside it.
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

    // Upload raw original + finished image (same path scheme as guest submits).
    const rowId = randomUUID();
    const raw = rawMeta(photoFormat);
    const rawPath = `${event.id}/${rowId}-raw.${raw.ext}`;
    const finishedPath = `${event.id}/${rowId}-finished.jpg`;

    const { error: rawErr } = await admin.storage
      .from("submissions")
      .upload(rawPath, rawBytes, { contentType: raw.type, upsert: false });
    if (rawErr) throw new Error("raw_upload");
    uploaded.push(rawPath);

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
      raw_storage_path: rawPath,
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
