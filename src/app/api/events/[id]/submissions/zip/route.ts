import { NextResponse } from "next/server";
import JSZip from "jszip";
import { getUserFromRequest } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60; // zipping many images can take a bit

type Params = { params: Promise<{ id: string }> };

const MAX_ZIP_ITEMS = 300; // protect function memory (all buffered in RAM)

// GET /api/events/[id]/submissions/zip — bundle all finished images into a ZIP.
// Called via apiFetchBlob (Bearer auth) from the browser, then downloaded.
export async function GET(request: Request, { params }: Params) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const admin = createAdminClient();

  const { data: rows, error } = await admin
    .from("submissions")
    .select("finished_storage_path")
    .eq("event_id", id)
    .not("finished_storage_path", "is", null)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const paths = (rows ?? []).map((r) => r.finished_storage_path as string);
  if (paths.length > MAX_ZIP_ITEMS) {
    return NextResponse.json({ error: "too_many" }, { status: 413 });
  }

  const zip = new JSZip();
  for (let i = 0; i < paths.length; i++) {
    const { data: blob } = await admin.storage
      .from("submissions")
      .download(paths[i]);
    if (blob) {
      const buf = Buffer.from(await blob.arrayBuffer());
      // Sequential names avoid UUID/Hebrew filename issues inside the archive.
      zip.file(`magnet-${String(i + 1).padStart(3, "0")}.jpg`, buf);
    }
  }

  const bytes = await zip.generateAsync({ type: "uint8array" });

  return new Response(bytes as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="magnets.zip"',
    },
  });
}
