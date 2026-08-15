import { createAdminClient } from "@/lib/supabase";
import { ensureFrameWindows, type FrameRowRaw } from "@/lib/frames";
import type { PublicEventData, PublicFrame } from "@/lib/types";

// Server-only. Returns the SAFE, public subset of an event's data for guests —
// but ONLY for events that are currently OPEN. Missing and closed events both
// return null (indistinguishable, so no enumeration signal).
//
// Security notes:
// - the query hard-filters is_open=true
// - only an explicit allowlist of columns is selected (never id, is_open, etc.)
// - frames are re-mapped to drop event_id/storage_path; images are reachable
//   only via short-lived signed URLs.

const SIGNED_URL_TTL = 3600; // 1 hour

export async function getPublicEventData(
  slug: string,
): Promise<PublicEventData | null> {
  const admin = createAdminClient();

  // We need the internal id to look up frames, but never return it.
  const { data: event } = await admin
    .from("events")
    .select(
      "id, name, welcome_heading, welcome_subheading, photos_per_device, public_slug",
    )
    .eq("public_slug", slug)
    .eq("is_open", true)
    .maybeSingle();

  if (!event) return null;

  const { data: frameRows } = await admin
    .from("frames")
    .select(
      "id, orientation, storage_path, window_x, window_y, window_w, window_h",
    )
    .eq("event_id", event.id)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  // Sign all frame image paths in one batch.
  const paths = (frameRows ?? []).map((f) => f.storage_path);
  const urlByPath = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await admin.storage
      .from("frames")
      .createSignedUrls(paths, SIGNED_URL_TTL);
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl);
    }
  }

  // Ensure each frame's opening window is known (backfills old frames once).
  const windows = await ensureFrameWindows((frameRows ?? []) as FrameRowRaw[]);

  const publicFrames: PublicFrame[] = (frameRows ?? []).map((f) => ({
    id: f.id,
    orientation: f.orientation,
    url: urlByPath.get(f.storage_path) ?? "",
    window: windows.get(f.id) ?? null,
  }));

  return {
    name: event.name,
    welcome_heading: event.welcome_heading,
    welcome_subheading: event.welcome_subheading,
    photos_per_device: event.photos_per_device,
    public_slug: event.public_slug,
    frames: {
      portrait: publicFrames.filter((f) => f.orientation === "portrait"),
      landscape: publicFrames.filter((f) => f.orientation === "landscape"),
    },
  };
}
