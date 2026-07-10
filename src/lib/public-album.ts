import { createAdminClient } from "@/lib/supabase";
import { groupFinishedSubmissions } from "@/lib/submissions";
import type { PublicAlbumData } from "@/lib/types";

// Server-only. Resolves an event by its ALBUM TOKEN (not the public slug) and
// returns the safe, public album data. Works regardless of is_open (hosts view
// after the event). Returns null for an unknown token (indistinguishable).
//
// Security: resolves exactly one event by token; exposes only finished images
// mapped to a safe subset (id, url, orientation) — no internal fields leak.
//
// Copies are collapsed here (grouped by unique photo) so hosts see each photo
// once, with no copy count — duplicates are an admin/print concern only.
export async function getPublicAlbumData(
  token: string,
): Promise<PublicAlbumData | null> {
  const admin = createAdminClient();

  const { data: event } = await admin
    .from("events")
    .select("id, name, welcome_heading")
    .eq("album_token", token)
    .maybeSingle();

  if (!event) return null;

  const photos = await groupFinishedSubmissions(event.id);

  return {
    name: event.name,
    welcome_heading: event.welcome_heading,
    photos: photos.map((p) => ({
      id: p.id,
      url: p.url,
      orientation: p.orientation,
    })),
  };
}
