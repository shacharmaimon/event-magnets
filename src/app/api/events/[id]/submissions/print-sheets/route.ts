import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { zipPrintSheets, zipToWebStream } from "@/lib/submissions";

export const runtime = "nodejs";
// Print sheets also run sharp on every magnet, so they need the full headroom.
export const maxDuration = 300;

type Params = { params: Promise<{ id: string }> };

const zipHeaders = {
  "Content-Type": "application/zip",
  "Content-Disposition": 'attachment; filename="print-sheets.zip"',
};

// GET /api/events/[id]/submissions/print-sheets[?new=1]
// Admin download of 2-up 4x6 print sheets. new=1 restricts to not-yet-printed
// magnets and marks them printed (independent of the individual-download flow).
export async function GET(request: Request, { params }: Params) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const onlyNew = new URL(request.url).searchParams.get("new") === "1";
  const res = await zipPrintSheets(id, { onlyNew });
  if (!res.ok) {
    return NextResponse.json({ error: res.reason }, { status: 413 });
  }
  return new Response(zipToWebStream(res.zip), { headers: zipHeaders });
}

// POST /api/events/[id]/submissions/print-sheets — print sheets for only a
// SELECTED set of photos (body: { paths: string[] }). Neutral: no counter
// marking. A selected photo with N copies yields N magnets across the sheets.
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

  const res = await zipPrintSheets(id, { paths });
  if (!res.ok) {
    return NextResponse.json({ error: res.reason }, { status: 413 });
  }
  return new Response(zipToWebStream(res.zip), { headers: zipHeaders });
}
