import { NextResponse } from "next/server";
import sharp from "sharp";
import { randomUUID } from "crypto";
import { getUserFromRequest } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase";
import type { Orientation } from "@/lib/types";

// sharp needs the Node.js runtime (not edge).
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB — stay under Vercel's request body limit
const SIGNED_URL_TTL = 3600; // 1 hour — fine for admin previews

// Landscape if wider than tall, portrait if taller than wide.
// Square (or unknown) is ambiguous for a 4:3 magnet → reject.
function deriveOrientation(w?: number, h?: number): Orientation | null {
  if (!w || !h || w === h) return null;
  return w > h ? "landscape" : "portrait";
}

// GET /api/events/[id]/frames — list frames grouped by orientation, each with a
// temporary signed URL for display (bucket is private).
export async function GET(request: Request, { params }: Params) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const admin = createAdminClient();

  const { data: rows, error } = await admin
    .from("frames")
    .select("*")
    .eq("event_id", id)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Sign all storage paths in one batch.
  const paths = (rows ?? []).map((r) => r.storage_path);
  const urlByPath = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await admin.storage
      .from("frames")
      .createSignedUrls(paths, SIGNED_URL_TTL);
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl);
    }
  }

  const withUrls = (rows ?? []).map((r) => ({
    ...r,
    url: urlByPath.get(r.storage_path) ?? "",
  }));

  return NextResponse.json({
    portrait: withUrls.filter((f) => f.orientation === "portrait"),
    landscape: withUrls.filter((f) => f.orientation === "landscape"),
  });
}

// POST /api/events/[id]/frames — upload one or more PNG frames.
// Validates + derives orientation server-side, uploads to storage, inserts rows.
export async function POST(request: Request, { params }: Params) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const form = await request.formData();
  const files = form.getAll("file").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "no_file" }, { status: 400 });
  }

  const admin = createAdminClient();
  const created = [];

  for (const file of files) {
    // Basic checks before touching sharp.
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "file_too_large" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Read real image metadata — don't trust the client-declared type.
    let meta;
    try {
      meta = await sharp(buffer).metadata();
    } catch {
      return NextResponse.json({ error: "invalid_type" }, { status: 400 });
    }
    if (meta.format !== "png") {
      return NextResponse.json({ error: "invalid_type" }, { status: 400 });
    }

    const orientation = deriveOrientation(meta.width, meta.height);
    if (!orientation) {
      return NextResponse.json(
        { error: "ambiguous_orientation" },
        { status: 400 },
      );
    }

    const storagePath = `${id}/${randomUUID()}.png`;

    const { error: uploadErr } = await admin.storage
      .from("frames")
      .upload(storagePath, buffer, {
        contentType: "image/png",
        upsert: false,
      });
    if (uploadErr) {
      return NextResponse.json({ error: uploadErr.message }, { status: 500 });
    }

    const { data: row, error: insertErr } = await admin
      .from("frames")
      .insert({ event_id: id, storage_path: storagePath, orientation })
      .select("*")
      .single();

    if (insertErr) {
      // Best-effort cleanup so we don't orphan the uploaded file.
      await admin.storage.from("frames").remove([storagePath]);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    created.push(row);
  }

  return NextResponse.json(created, { status: 201 });
}
