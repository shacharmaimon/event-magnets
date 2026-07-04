import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

const SIGNED_URL_TTL = 3600; // 1 hour

// GET /api/events/[id]/submissions — list an event's submissions (finished
// images only), newest first, each with a signed URL for display.
export async function GET(request: Request, { params }: Params) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const admin = createAdminClient();

  const { data: rows, error } = await admin
    .from("submissions")
    .select("*")
    .eq("event_id", id)
    .not("finished_storage_path", "is", null)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const paths = (rows ?? []).map((r) => r.finished_storage_path as string);
  const urlByPath = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await admin.storage
      .from("submissions")
      .createSignedUrls(paths, SIGNED_URL_TTL);
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl);
    }
  }

  const submissions = (rows ?? []).map((r) => ({
    ...r,
    url: urlByPath.get(r.finished_storage_path as string) ?? "",
  }));

  return NextResponse.json({ count: submissions.length, submissions });
}
