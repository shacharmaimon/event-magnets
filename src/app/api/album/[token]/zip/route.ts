import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { zipFinishedSubmissions, zipToWebStream } from "@/lib/submissions";
import { zipOriginals, originalsAreLive } from "@/lib/originals";

export const runtime = "nodejs";
export const maxDuration = 300;

type Params = { params: Promise<{ token: string }> };

// GET /api/album/[token]/zip — PUBLIC batch download. The token is the auth.
// Mirrors the album view: live originals when published & fresh, else magnets.
export async function GET(_request: Request, { params }: Params) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: event } = await admin
    .from("events")
    .select("id, originals_published_at")
    .eq("album_token", token)
    .maybeSingle();
  if (!event) {
    return NextResponse.json({ error: "not_available" }, { status: 404 });
  }

  const res = originalsAreLive(event.originals_published_at)
    ? await zipOriginals(event.id)
    : // Hosts get one copy per unique magnet — duplicates are an admin concern.
      await zipFinishedSubmissions(event.id, { dedupe: true });
  if (!res.ok) {
    return NextResponse.json({ error: res.reason }, { status: 413 });
  }

  return new Response(zipToWebStream(res.zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="album.zip"',
    },
  });
}
