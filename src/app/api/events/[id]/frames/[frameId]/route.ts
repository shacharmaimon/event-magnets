import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string; frameId: string }> };

// DELETE /api/events/[id]/frames/[frameId] — remove a frame (row + storage file).
// If the event is currently open, refuse a deletion that would drop either
// orientation to zero (which would break the "both orientations" invariant);
// the admin must close the event first.
export async function DELETE(request: Request, { params }: Params) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id, frameId } = await params;
  const admin = createAdminClient();

  // Fetch the frame (and confirm it belongs to this event).
  const { data: frame } = await admin
    .from("frames")
    .select("*")
    .eq("id", frameId)
    .eq("event_id", id)
    .maybeSingle();

  if (!frame) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Guard: if the event is open, don't let this be the last frame of its orientation.
  const { data: event } = await admin
    .from("events")
    .select("is_open")
    .eq("id", id)
    .maybeSingle();

  if (event?.is_open) {
    const { count } = await admin
      .from("frames")
      .select("id", { count: "exact", head: true })
      .eq("event_id", id)
      .eq("orientation", frame.orientation);
    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: "would_break_open_event" },
        { status: 409 },
      );
    }
  }

  // Delete the DB row, then the storage object (best-effort).
  const { error: delErr } = await admin
    .from("frames")
    .delete()
    .eq("id", frameId);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }
  await admin.storage.from("frames").remove([frame.storage_path]);

  return NextResponse.json({ ok: true });
}
