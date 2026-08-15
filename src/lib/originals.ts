import { createAdminClient } from "@/lib/supabase";
import JSZip from "jszip";
import type { SupabaseClient } from "@supabase/supabase-js";

// Shared logic for the host-facing "originals album" (admin computer-upload).
// An event's album link serves the ORIGINALS when they're published and still
// fresh; otherwise callers fall back to the finished-magnets album. This keeps
// guest phone events (which never publish originals) showing magnets as before.

export const ORIGINALS_TTL_DAYS = 30;

/** True if `publishedAt` is set and within the TTL window (not expired). */
export function originalsAreLive(publishedAt: string | null): boolean {
  if (!publishedAt) return false;
  const published = Date.parse(publishedAt);
  if (Number.isNaN(published)) return false;
  const ageMs = Date.now() - published;
  return ageMs < ORIGINALS_TTL_DAYS * 24 * 60 * 60 * 1000;
}

const SIGNED_URL_TTL = 60 * 60 * 4; // 4 hours

export interface OriginalWithUrl {
  id: string;
  url: string;
  orientation: "portrait" | "landscape" | null;
  storage_path: string;
}

/**
 * List an event's original photos (newest first) with signed URLs. Returns []
 * when the event has none. Does NOT check the TTL — callers decide whether to
 * use originals via originalsAreLive().
 */
export async function listOriginals(
  eventId: string,
  client?: SupabaseClient,
): Promise<OriginalWithUrl[]> {
  const admin = client ?? createAdminClient();

  const { data: rows } = await admin
    .from("original_photos")
    .select("id, storage_path, orientation")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  const paths = (rows ?? []).map((r) => r.storage_path as string);
  const urlByPath = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await admin.storage
      .from("submissions")
      .createSignedUrls(paths, SIGNED_URL_TTL);
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl);
    }
  }

  return (rows ?? []).map((r) => ({
    id: r.id as string,
    storage_path: r.storage_path as string,
    orientation: r.orientation as "portrait" | "landscape" | null,
    url: urlByPath.get(r.storage_path as string) ?? "",
  }));
}

const MAX_ZIP_ITEMS = 600; // matches submissions.ts guard

/**
 * Bundle an event's original photos into a ZIP (downloaded in parallel, then
 * streamed by the caller via zipToWebStream). Returns the built JSZip.
 */
export async function zipOriginals(
  eventId: string,
): Promise<{ ok: true; zip: JSZip } | { ok: false; reason: "too_many" }> {
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("original_photos")
    .select("storage_path")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  const items = rows ?? [];
  if (items.length > MAX_ZIP_ITEMS) return { ok: false, reason: "too_many" };

  const zip = new JSZip();
  const CONCURRENCY = 8;
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      const { data: blob } = await admin.storage
        .from("submissions")
        .download(items[i].storage_path as string);
      if (blob) {
        const buf = Buffer.from(await blob.arrayBuffer());
        zip.file(`photo-${String(i + 1).padStart(3, "0")}.jpg`, buf);
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker),
  );
  return { ok: true, zip };
}
