import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { ORIGINALS_TTL_DAYS } from "@/lib/originals";

export const runtime = "nodejs";
export const maxDuration = 300;

// GET /api/cron/expire-originals — deletes originals albums older than the TTL.
// Runs weekly via vercel.json. Vercel sends the CRON_SECRET as a Bearer token;
// we also accept a manual ?secret= for testing. Idempotent: only acts on events
// whose originals_published_at is older than the TTL, clearing the flag after.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  const url = new URL(request.url);
  const provided =
    (auth?.startsWith("Bearer ") ? auth.slice(7) : null) ??
    url.searchParams.get("secret");
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const cutoff = new Date(
    Date.now() - ORIGINALS_TTL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  // Events whose originals album has expired.
  const { data: events } = await admin
    .from("events")
    .select("id")
    .not("originals_published_at", "is", null)
    .lt("originals_published_at", cutoff);

  let deletedEvents = 0;
  let deletedFiles = 0;

  for (const event of events ?? []) {
    const { data: rows } = await admin
      .from("original_photos")
      .select("id, storage_path")
      .eq("event_id", event.id);

    const paths = (rows ?? []).map((r) => r.storage_path as string);
    if (paths.length > 0) {
      await admin.storage.from("submissions").remove(paths);
      deletedFiles += paths.length;
    }
    await admin.from("original_photos").delete().eq("event_id", event.id);
    await admin
      .from("events")
      .update({ originals_published_at: null })
      .eq("id", event.id);
    deletedEvents += 1;
  }

  return NextResponse.json({ ok: true, deletedEvents, deletedFiles });
}
