import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { zipFinishedSubmissions } from "@/lib/submissions";

export const runtime = "nodejs";
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

// GET /api/events/[id]/submissions/zip — admin batch download (ZIP).
export async function GET(request: Request, { params }: Params) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const res = await zipFinishedSubmissions(id);
  if (!res.ok) {
    return NextResponse.json({ error: res.reason }, { status: 413 });
  }

  return new Response(res.bytes as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="magnets.zip"',
    },
  });
}
