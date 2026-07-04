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

/** Bundle an event's finished images into a ZIP (byte array). */
export async function zipFinishedSubmissions(
  eventId: string,
): Promise<{ ok: true; bytes: Uint8Array } | { ok: false; reason: "too_many" }> {
  const admin = createAdminClient();

  const { data: rows } = await admin
    .from("submissions")
    .select("finished_storage_path")
    .eq("event_id", eventId)
    .not("finished_storage_path", "is", null)
    .order("created_at", { ascending: false });

  const paths = (rows ?? []).map((r) => r.finished_storage_path as string);
  if (paths.length > MAX_ZIP_ITEMS) {
    return { ok: false, reason: "too_many" };
  }

  const zip = new JSZip();
  for (let i = 0; i < paths.length; i++) {
    const { data: blob } = await admin.storage
      .from("submissions")
      .download(paths[i]);
    if (blob) {
      const buf = Buffer.from(await blob.arrayBuffer());
      zip.file(`magnet-${String(i + 1).padStart(3, "0")}.jpg`, buf);
    }
  }

  const bytes = await zip.generateAsync({ type: "uint8array" });
  return { ok: true, bytes };
}
