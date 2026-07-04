import { NextResponse } from "next/server";
import { getPublicEventData } from "@/lib/public-event";

export const runtime = "nodejs";

type Params = { params: Promise<{ slug: string }> };

// GET /api/e/[slug] — PUBLIC (no auth). Returns safe event data for OPEN events
// only. Missing/closed events return an identical 404 (no enumeration signal).
export async function GET(_request: Request, { params }: Params) {
  const { slug } = await params;
  const data = await getPublicEventData(slug);
  if (!data) {
    return NextResponse.json({ error: "not_available" }, { status: 404 });
  }
  return NextResponse.json(data);
}
