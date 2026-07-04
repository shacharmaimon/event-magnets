import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { listFinishedSubmissions } from "@/lib/submissions";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

// GET /api/events/[id]/submissions — admin list of finished submissions.
export async function GET(request: Request, { params }: Params) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const submissions = await listFinishedSubmissions(id);
  return NextResponse.json({ count: submissions.length, submissions });
}
