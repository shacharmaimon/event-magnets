import { NextResponse } from "next/server";
import sharp from "sharp";
import { randomUUID } from "crypto";
import { getUserFromRequest } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 30;

type Params = { params: Promise<{ id: string }> };

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB — client ships ~3000px JPEGs, under the limit

// POST /api/events/[id]/originals — ADMIN. Store ONE unframed original photo
// (client already shrank it to ~3000px) for the event's host-facing originals
// album. One photo per request; the client uploads a batch in the background.
export async function POST(request: Request, { params }: Params) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id: eventId } = await params;

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
  const orientation = form.get("orientation");
  if (orientation !== "portrait" && orientation !== "landscape") {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file_too_large" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Event must exist (open or closed — admin uploads either way).
  const { data: event } = await admin
    .from("events")
    .select("id")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) {
    return NextResponse.json({ error: "not_available" }, { status: 404 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  // Validate it's a real image before storing.
  try {
    await sharp(bytes).metadata();
  } catch {
    return NextResponse.json({ error: "invalid_type" }, { status: 400 });
  }

  const rowId = randomUUID();
  const storagePath = `originals/${event.id}/${rowId}.jpg`;

  const { error: upErr } = await admin.storage
    .from("submissions")
    .upload(storagePath, bytes, {
      contentType: "image/jpeg",
      upsert: false,
    });
  if (upErr) {
    return NextResponse.json({ error: "upload_failed" }, { status: 500 });
  }

  const { data: row, error: insErr } = await admin
    .from("original_photos")
    .insert({
      id: rowId,
      event_id: event.id,
      storage_path: storagePath,
      orientation,
    })
    .select("id, storage_path")
    .single();
  if (insErr) {
    await admin.storage.from("submissions").remove([storagePath]);
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ...row }, { status: 201 });
}
