import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase";
import { generateSlug } from "@/lib/slug";

// GET /api/events — list all events (newest first).
export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("events")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

// POST /api/events — create an event with a unique public_slug.
export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "name_required" }, { status: 400 });
  }

  const photosPerDevice = Number(body.photos_per_device ?? 1);
  if (!Number.isInteger(photosPerDevice) || photosPerDevice < 1) {
    return NextResponse.json(
      { error: "invalid_photos_per_device" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // Find a slug that isn't already taken (retry a few times).
  let slug = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateSlug();
    const { data: existing } = await admin
      .from("events")
      .select("id")
      .eq("public_slug", candidate)
      .maybeSingle();
    if (!existing) {
      slug = candidate;
      break;
    }
  }
  if (!slug) {
    return NextResponse.json(
      { error: "slug_generation_failed" },
      { status: 500 },
    );
  }

  const { data, error } = await admin
    .from("events")
    .insert({
      name: body.name.trim(),
      welcome_heading: body.welcome_heading ?? "",
      welcome_subheading: body.welcome_subheading ?? "",
      photos_per_device: photosPerDevice,
      public_slug: slug,
      // is_open defaults to false in the DB — events start closed.
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
