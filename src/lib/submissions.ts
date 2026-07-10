import JSZip from "jszip";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase";
import type {
  GroupedSubmission,
  NewCounts,
  SubmissionWithUrl,
} from "@/lib/types";

// Shared, auth-agnostic helpers for reading an event's finished submissions.
// Used by BOTH the admin routes (behind Bearer auth) and the public album
// routes (authorized by the album token). Keeping the logic here avoids
// duplicating the query + signing + zip code.

export const SIGNED_URL_TTL = 60 * 60 * 4; // 4 hours — long enough for a full event session (gallery reuses these URLs so images stay cached, not re-downloaded)
// Peak memory is bounded by the file buffers held while zipping. Streaming the
// archive out (instead of buffering the whole zip too) keeps this affordable, so
// we allow a healthy batch. The guard still prevents a runaway OOM.
const MAX_ZIP_ITEMS = 600;
// Storage downloads are network-bound, so fetching several at once slashes the
// wall-clock vs the old one-at-a-time loop (the cause of the 60s timeouts).
const DOWNLOAD_CONCURRENCY = 8;
// Print-sheet composition is CPU/sharp-bound — a smaller pool avoids thrashing.
const SHEET_CONCURRENCY = 4;

/**
 * Run `fn` over `items` with at most `limit` in flight at once, preserving the
 * input order in the returned array. Used to parallelize the per-file storage
 * downloads (and sheet compositing) that previously ran sequentially.
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return results;
}

/**
 * Bridge a built JSZip into a web ReadableStream so the route can stream the
 * archive to the browser as it's serialized — the response starts immediately
 * (no "frozen then fails") and we never hold the whole zip buffer in memory on
 * top of the file buffers. Applies basic backpressure via pause/resume.
 */
export function zipToWebStream(zip: JSZip): ReadableStream<Uint8Array> {
  const helper = zip.generateInternalStream({
    type: "uint8array",
    streamFiles: true,
  });
  return new ReadableStream<Uint8Array>({
    start(controller) {
      helper
        .on("data", (chunk: Uint8Array) => {
          controller.enqueue(chunk);
          if (controller.desiredSize !== null && controller.desiredSize <= 0) {
            helper.pause();
          }
        })
        .on("end", () => controller.close())
        .on("error", (err: unknown) => controller.error(err));
      helper.resume();
    },
    pull() {
      helper.resume();
    },
    cancel() {
      helper.pause();
    },
  });
}

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

/**
 * Like listFinishedSubmissions, but collapses copies: N rows sharing one
 * finished_storage_path become ONE entry with copies=N. Newest-first order is
 * preserved (a group takes the position of its newest row). Used by the admin
 * gallery so a photo submitted with 8 copies shows once, badged "x8".
 */
export async function groupFinishedSubmissions(
  eventId: string,
): Promise<GroupedSubmission[]> {
  const rows = await listFinishedSubmissions(eventId);
  const byPath = new Map<string, GroupedSubmission>();
  for (const r of rows) {
    const path = r.finished_storage_path as string;
    const existing = byPath.get(path);
    if (existing) {
      existing.copies += 1;
    } else {
      byPath.set(path, {
        id: r.id,
        path,
        url: r.url,
        orientation: r.orientation,
        copies: 1,
      });
    }
  }
  return Array.from(byPath.values());
}

/**
 * The two independent "new" counts for the admin print page. Each counts finished
 * ROWS (= magnets to print, copies expanded), not unique photos:
 *   newIndividual -> rows with downloaded_at NULL (not yet downloaded singly)
 *   newSheets     -> rows with printed_at NULL (not yet downloaded as sheets)
 */
export async function countNewSubmissions(eventId: string): Promise<NewCounts> {
  const admin = createAdminClient();
  const base = () =>
    admin
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .not("finished_storage_path", "is", null);

  const [{ count: newIndividual }, { count: newSheets }] = await Promise.all([
    base().is("downloaded_at", null),
    base().is("printed_at", null),
  ]);
  return { newIndividual: newIndividual ?? 0, newSheets: newSheets ?? 0 };
}

/**
 * Options shared by the two batch-download builders.
 * - onlyNew: restrict to rows not yet consumed by this flow, and mark them
 *   consumed after building (individual -> downloaded_at, sheets -> printed_at).
 * - paths: restrict to these finished_storage_paths (used by multi-select).
 *   Selecting one path returns ALL its rows, so a photo with N copies yields N
 *   magnets. Selection is neutral: it never marks rows.
 * - dedupe: keep only one row per finished_storage_path (used by the host album,
 *   where duplicate copies are pointless).
 * paths and onlyNew are mutually exclusive in practice; if paths is set, no
 * marking happens regardless of onlyNew.
 */
export interface ZipOptions {
  onlyNew?: boolean;
  paths?: string[];
  dedupe?: boolean;
}

type ZipResult =
  | { ok: true; zip: JSZip; empty: boolean }
  | { ok: false; reason: "too_many" };

/**
 * Bundle an event's finished images into a ZIP. See ZipOptions for scoping.
 * Copies are expanded (a 3-copy submission contributes 3 identical files) unless
 * `dedupe` is set.
 */
export async function zipFinishedSubmissions(
  eventId: string,
  opts: ZipOptions = {},
): Promise<ZipResult> {
  const admin = createAdminClient();
  const selecting = Array.isArray(opts.paths);

  let query = admin
    .from("submissions")
    .select("id, finished_storage_path")
    .eq("event_id", eventId)
    .not("finished_storage_path", "is", null)
    .order("created_at", { ascending: false });
  if (selecting) query = query.in("finished_storage_path", opts.paths as string[]);
  if (opts.onlyNew && !selecting) query = query.is("downloaded_at", null);

  const { data: rows } = await query;
  let items = rows ?? [];
  if (opts.dedupe) items = dedupeByPath(items);

  if (items.length > MAX_ZIP_ITEMS) {
    return { ok: false, reason: "too_many" };
  }
  const zip = new JSZip();
  if (items.length === 0) {
    return { ok: true, zip, empty: true };
  }

  // Download every finished image in parallel batches (was sequential — the
  // cause of the 60s timeouts on big events). Order is preserved so file names
  // stay stable.
  await mapWithConcurrency(items, DOWNLOAD_CONCURRENCY, async (item, i) => {
    const { data: blob } = await admin.storage
      .from("submissions")
      .download(item.finished_storage_path as string);
    if (blob) {
      const buf = Buffer.from(await blob.arrayBuffer());
      zip.file(`magnet-${String(i + 1).padStart(3, "0")}.jpg`, buf);
    }
  });

  // Mark these rows downloaded (only for the "new" download; never for selection).
  if (opts.onlyNew && !selecting) {
    const ids = items.map((r) => r.id);
    await admin
      .from("submissions")
      .update({ downloaded_at: new Date().toISOString() })
      .in("id", ids);
  }

  return { ok: true, zip, empty: false };
}

/** Keep only the first row per finished_storage_path (order preserved). */
function dedupeByPath<T extends { finished_storage_path: string | null }>(
  rows: T[],
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of rows) {
    const p = r.finished_storage_path as string;
    if (seen.has(p)) continue;
    seen.add(p);
    out.push(r);
  }
  return out;
}

// Print-sheet layout: 4x6" sheet @ 300 DPI, holding two 4x3" magnets stacked.
const SHEET_W = 1200;
const SHEET_H = 1800;
const MAGNET_W = 1200;
const MAGNET_H = 900;

/**
 * Produce ready-to-print 4x6 sheets, each holding TWO 4x3 magnets stacked
 * top/bottom (cut across the middle). Portrait magnets are rotated 90° so every
 * magnet is normalized to landscape and any two can share a sheet (max paper
 * efficiency). A leftover odd magnet gets its own sheet (top half only).
 * Copies are expanded (a 3-copy submission contributes 3 magnets).
 *
 * See ZipOptions. onlyNew here means "not yet printed" (printed_at NULL) and
 * marks printed_at — SEPARATE from the individual-download counter. paths
 * selection is neutral (no marking).
 */
export async function zipPrintSheets(
  eventId: string,
  opts: ZipOptions = {},
): Promise<ZipResult> {
  const admin = createAdminClient();
  const selecting = Array.isArray(opts.paths);

  let query = admin
    .from("submissions")
    .select("id, finished_storage_path, orientation")
    .eq("event_id", eventId)
    .not("finished_storage_path", "is", null)
    .order("created_at", { ascending: false });
  if (selecting) query = query.in("finished_storage_path", opts.paths as string[]);
  if (opts.onlyNew && !selecting) query = query.is("printed_at", null);

  const { data: rows } = await query;
  let items = rows ?? [];
  if (opts.dedupe) items = dedupeByPath(items);

  if (items.length > MAX_ZIP_ITEMS) {
    return { ok: false, reason: "too_many" };
  }
  const zip = new JSZip();
  if (items.length === 0) {
    return { ok: true, zip, empty: true };
  }

  // Download + normalize every magnet to a landscape 1200x900 buffer (rotate
  // portraits), in parallel batches (was sequential — the timeout cause). Order
  // is preserved; failed downloads become null and are dropped.
  const normalized = await mapWithConcurrency(
    items,
    SHEET_CONCURRENCY,
    async (item) => {
      const { data: blob } = await admin.storage
        .from("submissions")
        .download(item.finished_storage_path as string);
      if (!blob) return null;
      const src = Buffer.from(await blob.arrayBuffer());
      return sharp(src)
        .rotate(item.orientation === "portrait" ? 90 : 0)
        .resize(MAGNET_W, MAGNET_H, { fit: "fill" })
        .toBuffer();
    },
  );
  const magnets = normalized.filter((b): b is Buffer => b !== null);

  // Pair them up onto sheets (two stacked per 1200x1800 sheet), compositing the
  // sheets in parallel batches too. Precompute the pairs to keep sheet order.
  const pairs: Array<[Buffer, Buffer | undefined]> = [];
  for (let i = 0; i < magnets.length; i += 2) {
    pairs.push([magnets[i], magnets[i + 1]]);
  }
  const sheets = await mapWithConcurrency(
    pairs,
    SHEET_CONCURRENCY,
    async ([top, bottom]) => {
      const composites = [{ input: top, top: 0, left: 0 }];
      if (bottom) composites.push({ input: bottom, top: MAGNET_H, left: 0 });
      return sharp({
        create: {
          width: SHEET_W,
          height: SHEET_H,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      })
        .composite(composites)
        .jpeg({ quality: 92, chromaSubsampling: "4:4:4", mozjpeg: true })
        .toBuffer();
    },
  );
  sheets.forEach((sheet, i) => {
    zip.file(`sheet-${String(i + 1).padStart(3, "0")}.jpg`, sheet);
  });

  if (opts.onlyNew && !selecting) {
    const ids = items.map((r) => r.id);
    await admin
      .from("submissions")
      .update({ printed_at: new Date().toISOString() })
      .in("id", ids);
  }

  return { ok: true, zip, empty: false };
}
