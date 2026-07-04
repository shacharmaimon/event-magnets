import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { zipPrintSheets } from "@/lib/submissions";

export const runtime = "nodejs";
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

// GET /api/events/[id]/submissions/print-sheets?new=1
// Admin download of 2-up 4x6 print sheets (two 4x3 magnets stacked per sheet).
export async function GET(request: Request, { params }: Params) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const onlyNew = new URL(request.url).searchParams.get("new") === "1";
  const res = await zipPrintSheets(id, onlyNew);
  if (!res.ok) {
    return NextResponse.json({ error: res.reason }, { status: 413 });
  }

  return new Response(res.bytes as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="print-sheets.zip"',
    },
  });
}
