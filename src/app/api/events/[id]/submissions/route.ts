import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import {
  groupFinishedSubmissions,
  countNewSubmissions,
} from "@/lib/submissions";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

// GET /api/events/[id]/submissions — admin list of finished submissions,
// collapsed by unique photo (copies badged in the UI) plus the two independent
// "new" counters (individual downloads vs print sheets).
export async function GET(request: Request, { params }: Params) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const [submissions, counts] = await Promise.all([
    groupFinishedSubmissions(id),
    countNewSubmissions(id),
  ]);
  // count = total magnets to print (copies expanded); submissions.length is the
  // number of unique photos shown on the page.
  const totalMagnets = submissions.reduce((n, s) => n + s.copies, 0);
  return NextResponse.json({
    count: totalMagnets,
    uniqueCount: submissions.length,
    newIndividual: counts.newIndividual,
    newSheets: counts.newSheets,
    submissions,
  });
}
