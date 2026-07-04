import JSZip from "jszip";
import { createAdminClient } from "@/lib/supabase";
import type { SubmissionWithUrl } from "@/lib/types";

// Shared, auth-agnostic helpers for reading an event's finished submissions.
// Used by BOTH the admin routes (behind Bearer auth) and the public album
// routes (authorized by the album token). Keeping the logic here avoids
// duplicating the query + signing + zip code.

export const SIGNED_URL_TTL = 3600; // 1 hour
const MAX_ZIP_ITEMS = 300; // protect function memory (all buffered in RAM)

/** List an event's finished submissions (newest first) with signed image URLs. */
export async function listFinishedSubmissions(
  eventId: string,
): Promise<SubmissionWithUrl[]> {
  const admin = createAdminClient();

  const { data: rows } = await admin
    .from("submissions")
    .select("*")
    .eq("event_id", eventId)
    .not("finished_storage_path", "is", null)
    .order("created_at", { ascending: false });

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

  return (rows ?? []).map((r) => ({
    ...r,
    url: urlByPath.get(r.finished_storage_path as string) ?? "",
  }));
}

/** How many finished submissions haven't been downloaded yet. */
export async function countNewSubmissions(eventId: string): Promise<number> {
  const admin = createAdminClient();
  const { count } = await admin
    .from("submissions")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .not("finished_storage_path", "is", null)
    .is("downloaded_at", null);
  return count ?? 0;
}

/**
 * Bundle an event's finished images into a ZIP.
 * - onlyNew=false: every finished image (a fresh full download).
 * - onlyNew=true: only images not yet downloaded, and mark them downloaded.
 */
export async function zipFinishedSubmissions(
  eventId: string,
  onlyNew = false,
): Promise<
  { ok: true; bytes: Uint8Array; empty: boolean } | { ok: false; reason: "too_many" }
> {
  const admin = createAdminClient();

  let query = admin
    .from("submissions")
    .select("id, finished_storage_path")
    .eq("event_id", eventId)
    .not("finished_storage_path", "is", null)
    .order("created_at", { ascending: false });
  if (onlyNew) query = query.is("downloaded_at", null);

  const { data: rows } = await query;
  const items = rows ?? [];

  if (items.length > MAX_ZIP_ITEMS) {
    return { ok: false, reason: "too_many" };
  }
  if (items.length === 0) {
    const zip = new JSZip();
    return { ok: true, bytes: await zip.generateAsync({ type: "uint8array" }), empty: true };
  }

  const zip = new JSZip();
  for (let i = 0; i < items.length; i++) {
    const { data: blob } = await admin.storage
      .from("submissions")
      .download(items[i].finished_storage_path as string);
    if (blob) {
      const buf = Buffer.from(await blob.arrayBuffer());
      zip.file(`magnet-${String(i + 1).padStart(3, "0")}.jpg`, buf);
    }
  }

  const bytes = await zip.generateAsync({ type: "uint8array" });

  // Mark these rows as downloaded (only for the "new" download).
  if (onlyNew) {
    const ids = items.map((r) => r.id);
    await admin
      .from("submissions")
      .update({ downloaded_at: new Date().toISOString() })
      .in("id", ids);
  }

  return { ok: true, bytes, empty: false };
}
