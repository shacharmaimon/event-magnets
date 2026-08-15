import { createAdminClient } from "@/lib/supabase";
import { groupFinishedSubmissions } from "@/lib/submissions";
import { listOriginals, originalsAreLive } from "@/lib/originals";
import type { PublicAlbumData } from "@/lib/types";

// Server-only. Resolves an event by its ALBUM TOKEN (not the public slug) and
// returns the safe, public album data. Works regardless of is_open (hosts view
// after the event). Returns null for an unknown token (indistinguishable).
//
// Album content: if the event has a published, non-expired ORIGINALS album
// (admin computer-upload flow), the host sees the full unframed originals.
// Otherwise it falls back to the finished MAGNETS (grouped, one per photo) —
// which is what guest phone events always use, so they're unchanged.
export async function getPublicAlbumData(
  token: string,
): Promise<PublicAlbumData | null> {
  const admin = createAdminClient();

  const { data: event } = await admin
    .from("events")
    .select("id, name, welcome_heading, originals_published_at")
    .eq("album_token", token)
    .maybeSingle();

  if (!event) return null;

  // Prefer live originals when present.
  if (originalsAreLive(event.originals_published_at)) {
    const originals = await listOriginals(event.id, admin);
    if (originals.length > 0) {
      return {
        name: event.name,
        welcome_heading: event.welcome_heading,
        photos: originals.map((o) => ({
          id: o.id,
          url: o.url,
          orientation: o.orientation,
        })),
      };
    }
  }

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
