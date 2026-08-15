import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

// POST /api/events/[id]/originals/publish — ADMIN. Mark the originals album as
// complete: sets originals_published_at = now(). This makes the host album link
// serve the originals (until it expires 30 days later), and starts that clock.
export async function POST(request: Request, { params }: Params) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const admin = createAdminClient();

  const { error } = await admin
    .from("events")
    .update({ originals_published_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: "publish_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
