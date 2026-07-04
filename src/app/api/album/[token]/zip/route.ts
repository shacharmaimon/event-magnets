import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { zipFinishedSubmissions } from "@/lib/submissions";

export const runtime = "nodejs";
export const maxDuration = 60;

type Params = { params: Promise<{ token: string }> };

// GET /api/album/[token]/zip — PUBLIC batch download. The token is the auth.
export async function GET(_request: Request, { params }: Params) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: event } = await admin
    .from("events")
    .select("id")
    .eq("album_token", token)
    .maybeSingle();
  if (!event) {
    return NextResponse.json({ error: "not_available" }, { status: 404 });
  }

  const res = await zipFinishedSubmissions(event.id);
  if (!res.ok) {
    return NextResponse.json({ error: res.reason }, { status: 413 });
  }

  return new Response(res.bytes as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="album.zip"',
    },
  });
}
