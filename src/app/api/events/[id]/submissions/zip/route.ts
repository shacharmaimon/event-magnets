import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { zipFinishedSubmissions } from "@/lib/submissions";

export const runtime = "nodejs";
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

const zipHeaders = {
  "Content-Type": "application/zip",
  "Content-Disposition": 'attachment; filename="magnets.zip"',
};

// GET /api/events/[id]/submissions/zip[?new=1] — admin batch download (ZIP)
// of all finished magnets, or only the not-yet-downloaded ones (marks them).
export async function GET(request: Request, { params }: Params) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const onlyNew = new URL(request.url).searchParams.get("new") === "1";
  const res = await zipFinishedSubmissions(id, { onlyNew });
  if (!res.ok) {
    return NextResponse.json({ error: res.reason }, { status: 413 });
  }
  return new Response(res.bytes as BodyInit, { headers: zipHeaders });
}

// POST /api/events/[id]/submissions/zip — download only a SELECTED set of photos
// (body: { paths: string[] }). Neutral: does not touch the "new" counters. A
// selected photo with N copies yields N magnets.
export async function POST(request: Request, { params }: Params) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const paths = Array.isArray(body?.paths)
    ? (body.paths as unknown[]).filter((p): p is string => typeof p === "string")
    : [];
  if (paths.length === 0) {
    return NextResponse.json({ error: "no_selection" }, { status: 400 });
  }

  const res = await zipFinishedSubmissions(id, { paths });
  if (!res.ok) {
    return NextResponse.json({ error: res.reason }, { status: 413 });
  }
  return new Response(res.bytes as BodyInit, { headers: zipHeaders });
}
