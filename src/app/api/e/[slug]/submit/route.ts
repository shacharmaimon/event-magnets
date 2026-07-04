import { NextResponse } from "next/server";
import sharp from "sharp";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase";
import type { Orientation } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30; // headroom for sharp on cold starts

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB (Vercel body limit is ~4.5 MB)

// Map a sharp format to a file extension + content type for the raw upload.
function rawMeta(format?: string): { ext: string; type: string } {
  if (format === "png") return { ext: "png", type: "image/png" };
  if (format === "webp") return { ext: "webp", type: "image/webp" };
  return { ext: "jpg", type: "image/jpeg" }; // default: jpeg
}

// POST /api/e/[slug]/submit — PUBLIC. Composite the guest's photo + chosen frame
// into a print-ready magnet, store raw + finished, record the submission.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  // --- 1. Parse + validate the multipart form ---
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
  const deviceId = form.get("deviceId");
  if (
    typeof frameId !== "string" ||
    (orientation !== "portrait" && orientation !== "landscape") ||
    typeof deviceId !== "string" ||
    !deviceId
  ) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  // Number of copies requested (default 1). Clamped to remaining allowance below.
  const copiesRaw = Number(form.get("copies") ?? 1);
  const requestedCopies =
    Number.isInteger(copiesRaw) && copiesRaw >= 1 ? copiesRaw : 1;
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file_too_large" }, { status: 400 });
  }

  const admin = createAdminClient();

  // --- 2. Event must exist AND be open ---
  const { data: event } = await admin
    .from("events")
    .select("id, photos_per_device")
    .eq("public_slug", slug)
    .eq("is_open", true)
    .maybeSingle();
  if (!event) {
    return NextResponse.json({ error: "not_available" }, { status: 404 });
  }

  // --- 3. Frame must belong to this event, orientation must match ---
  const { data: frame } = await admin
    .from("frames")
    .select("event_id, storage_path, orientation")
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

  // --- 4. Enforce per-device limit (before doing expensive work) ---
  const { count } = await admin
    .from("submissions")
    .select("id", { count: "exact", head: true })
    .eq("event_id", event.id)
    .eq("device_id", deviceId);
  // Race note: two simultaneous submits could both pass this check and overshoot
  // slightly — acceptable for v1.
  const remaining = event.photos_per_device - (count ?? 0);
  if (remaining <= 0) {
    return NextResponse.json({ error: "limit_reached" }, { status: 429 });
  }
  // Save at most the remaining allowance (clamp the requested copies).
  const copies = Math.min(requestedCopies, remaining);

  const [W, H]: [number, number] =
    (orientation as Orientation) === "landscape" ? [1200, 900] : [900, 1200];

  const rawBytes = Buffer.from(await file.arrayBuffer());

  // Track uploaded objects for cleanup-on-failure.
  const uploaded: string[] = [];

  try {
    // --- 5. Composite with sharp ---
    // Validate the photo is a real image and get its format for the raw upload.
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

    // Force the frame to exact target dimensions (authored at size; safe).
    const frameBuf = await sharp(frameBytes)
      .resize(W, H, { fit: "fill" })
      .png()
      .toBuffer();

    // Photo: apply EXIF rotation, center-crop cover to target (matches the
    // preview's object-cover), overlay the frame, encode print-quality JPEG.
    const finished = await sharp(rawBytes, { failOn: "none" })
      .rotate()
      .resize(W, H, { fit: "cover", position: "center" })
      .composite([{ input: frameBuf, top: 0, left: 0 }])
      .jpeg({ quality: 90, chromaSubsampling: "4:4:4", mozjpeg: true })
      .toBuffer();

    // --- 6. Upload raw original + finished image ---
    const id = randomUUID();
    const raw = rawMeta(photoFormat);
    const rawPath = `${event.id}/${id}-raw.${raw.ext}`;
    const finishedPath = `${event.id}/${id}-finished.jpg`;

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

    // --- 7. Record the submission(s) — one row per requested copy, all
    // pointing to the same finished image, so it prints N times, appears N
    // times in the gallery/ZIP, and counts N against the per-device limit. ---
    const row = {
      event_id: event.id,
      frame_id: frameId,
      device_id: deviceId,
      raw_storage_path: rawPath,
      finished_storage_path: finishedPath,
      orientation,
    };
    const { error: insErr } = await admin
      .from("submissions")
      .insert(Array.from({ length: copies }, () => row));
    if (insErr) throw new Error("insert");

    // --- 8. Sign the finished image so the guest can see their magnet ---
    const { data: signed } = await admin.storage
      .from("submissions")
      .createSignedUrl(finishedPath, 3600);

    return NextResponse.json(
      { ok: true, url: signed?.signedUrl ?? null, copies },
      { status: 201 },
    );
  } catch {
    // Best-effort cleanup of anything already uploaded.
    if (uploaded.length > 0) {
      await admin.storage.from("submissions").remove(uploaded);
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
