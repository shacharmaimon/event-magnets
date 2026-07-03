import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase";

// In Next.js 16, dynamic route params are async and must be awaited.
type Params = { params: Promise<{ id: string }> };

// GET /api/events/[id] — fetch one event.
export async function GET(request: Request, { params }: Params) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("events")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(data);
}

// PATCH /api/events/[id] — update fields and/or toggle is_open.
// Accepts any subset of the editable fields; id and public_slug are never changed.
export async function PATCH(request: Request, { params }: Params) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  // Whitelist the fields a client is allowed to change.
  const updates: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) {
    updates.name = body.name.trim();
  }
  if (typeof body.welcome_heading === "string") {
    updates.welcome_heading = body.welcome_heading;
  }
  if (typeof body.welcome_subheading === "string") {
    updates.welcome_subheading = body.welcome_subheading;
  }
  if (body.photos_per_device !== undefined) {
    const n = Number(body.photos_per_device);
    if (!Number.isInteger(n) || n < 1) {
      return NextResponse.json(
        { error: "invalid_photos_per_device" },
        { status: 400 },
      );
    }
    updates.photos_per_device = n;
  }
  if (typeof body.is_open === "boolean") {
    updates.is_open = body.is_open;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "no_valid_fields" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Guard: an event can only be OPENED if it has at least one portrait AND one
  // landscape frame (so guests never hit a missing-frame dead end).
  if (updates.is_open === true) {
    const { data: frames } = await admin
      .from("frames")
      .select("orientation")
      .eq("event_id", id);
    const hasPortrait = frames?.some((f) => f.orientation === "portrait");
    const hasLandscape = frames?.some((f) => f.orientation === "landscape");
    if (!hasPortrait || !hasLandscape) {
      return NextResponse.json(
        { error: "needs_both_orientations" },
        { status: 409 },
      );
    }
  }

  const { data, error } = await admin
    .from("events")
    .update(updates)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(data);
}

// DELETE /api/events/[id] — remove an event.
// Its frames and submissions are removed automatically via ON DELETE CASCADE.
export async function DELETE(request: Request, { params }: Params) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const admin = createAdminClient();
  const { error } = await admin.from("events").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
