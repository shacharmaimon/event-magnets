"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import FramedPhoto from "@/components/guest/FramedPhoto";
import { apiFetch } from "@/lib/api-client";
import { preparePhoto } from "@/lib/prepare-photo";
import {
  uploadOriginal,
  publishOriginals,
  commitMagnet,
} from "@/lib/admin-upload";
import { labels } from "@/lib/labels";
import type { FrameWithUrl, GroupedFrames, Orientation } from "@/lib/types";

const MAX_COPIES = 20;
const ALBUM_MAX_EDGE = 3000; // originals album fidelity (see plan)
const ALBUM_CONCURRENCY = 4;
const COMMIT_CONCURRENCY = 3;
const UPLOAD_RETRIES = 2;

// One reviewed photo in the batch (client-side only until committed).
type Item = {
  id: string;
  file: File; // shrunk + upright (post-preparePhoto, ~3000px)
  url: string; // object URL for preview
  orientation: Orientation;
  copies: number;
};

// Per-photo album-upload state (background job, keyed by photo id).
type AlbumEntry = { status: "pending" | "done" | "failed"; originalId?: string };

type Step = "idle" | "preparing" | "frames" | "review" | "committing" | "done";

let seq = 0;
const nextId = () => `b${seq++}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function tpl(s: string, vars: Record<string, string | number>) {
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

// Admin bulk upload — ONE drop does BOTH jobs:
// 1. Every photo uploads once (unframed, ~3000px) to the host originals album,
//    in the background, with progress + auto-retry; published when all land.
// 2. In parallel, the review flow (delete / copies / frame) runs on instant
//    local previews; committing a magnet references the already-uploaded
//    original (no second upload) and composites it server-side.
export default function BulkUpload({
  eventId,
  onCommitted,
}: {
  eventId: string;
  onCommitted: () => void; // refresh the gallery after commit
}) {
  const [step, setStep] = useState<Step>("idle");
  const [items, setItems] = useState<Item[]>([]);
  const [prep, setPrep] = useState({ done: 0, total: 0 });
  const [frames, setFrames] = useState<GroupedFrames | null>(null);
  const [pick, setPick] = useState<{
    landscape: string | null;
    portrait: string | null;
  }>({ landscape: null, portrait: null });
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState({ committed: 0, failed: 0 });
  const [error, setError] = useState("");
  const [enlarge, setEnlarge] = useState<number | null>(null);

  // Background album-upload state.
  const albumRef = useRef<Map<string, AlbumEntry>>(new Map());
  const [albumDone, setAlbumDone] = useState(0);
  const [albumTotal, setAlbumTotal] = useState(0);
  const [albumFailed, setAlbumFailed] = useState(0);
  const [albumPublished, setAlbumPublished] = useState(false);
  const albumStarted = useRef(false);

  // Track object URLs so we can revoke them on reset/unmount (avoid leaks).
  const urls = useRef<Set<string>>(new Set());
  const revokeAll = useCallback(() => {
    for (const u of urls.current) URL.revokeObjectURL(u);
    urls.current.clear();
  }, []);
  useEffect(() => revokeAll, [revokeAll]);

  function reset() {
    revokeAll();
    albumRef.current = new Map();
    albumStarted.current = false;
    setItems([]);
    setFrames(null);
    setPick({ landscape: null, portrait: null });
    setPrep({ done: 0, total: 0 });
    setProgress({ done: 0, total: 0 });
    setResult({ committed: 0, failed: 0 });
    setAlbumDone(0);
    setAlbumTotal(0);
    setAlbumFailed(0);
    setAlbumPublished(false);
    setError("");
    setEnlarge(null);
    setStep("idle");
  }

  // --- Background album upload over a FIXED snapshot of all photos. Runs
  // independently of which review step the admin is on. Deleting a photo from
  // the magnet review does NOT remove it here — the album is every shot. ---
  async function startAlbumUpload(photos: Item[]) {
    if (albumStarted.current) return;
    albumStarted.current = true;
    albumRef.current = new Map(
      photos.map((p) => [p.id, { status: "pending" } as AlbumEntry]),
    );
    setAlbumTotal(photos.length);
    setAlbumDone(0);
    await runAlbumUploads(photos);
  }

  async function runAlbumUploads(photos: Item[]) {
    let cursor = 0;
    async function worker() {
      while (cursor < photos.length) {
        const p = photos[cursor++];
        let ok = false;
        for (let attempt = 0; attempt <= UPLOAD_RETRIES && !ok; attempt++) {
          try {
            const r = await uploadOriginal({
              eventId,
              file: p.file,
              orientation: p.orientation,
            });
            if (r.ok && r.id) {
              albumRef.current.set(p.id, { status: "done", originalId: r.id });
              ok = true;
            }
          } catch {
            /* retry */
          }
          if (!ok && attempt < UPLOAD_RETRIES) await sleep(1000);
        }
        if (!ok) albumRef.current.set(p.id, { status: "failed" });
        setAlbumDone((d) => d + 1);
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(ALBUM_CONCURRENCY, photos.length) }, worker),
    );

    const failed = [...albumRef.current.values()].filter(
      (v) => v.status === "failed",
    ).length;
    setAlbumFailed(failed);
    // Publish only when the WHOLE album landed (host sees the complete set).
    if (failed === 0) {
      await publishOriginals(eventId);
      setAlbumPublished(true);
    }
  }

  // Retry just the photos whose album upload failed.
  async function retryAlbumFailures() {
    const failedPhotos = items.filter(
      (i) => albumRef.current.get(i.id)?.status === "failed",
    );
    if (failedPhotos.length === 0) return;
    for (const p of failedPhotos)
      albumRef.current.set(p.id, { status: "pending" });
    setAlbumFailed(0);
    setAlbumDone((d) => d - failedPhotos.length);
    await runAlbumUploads(failedPhotos);
  }

  // --- Files chosen → prepare (shrink to 3000px + detect orientation) ---
  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    setError("");
    setStep("preparing");
    setPrep({ done: 0, total: files.length });

    const prepared: Item[] = [];
    for (let i = 0; i < files.length; i++) {
      try {
        const { file, orientation } = await preparePhoto(files[i], ALBUM_MAX_EDGE);
        const url = URL.createObjectURL(file);
        urls.current.add(url);
        prepared.push({ id: nextId(), file, url, orientation, copies: 1 });
      } catch {
        // Skip an undecodable file; it just won't appear in the batch.
      }
      setPrep({ done: i + 1, total: files.length });
    }

    if (prepared.length === 0) {
      setError(labels.bulkUpload.uploadFailed);
      setStep("idle");
      return;
    }
    setItems(prepared);

    // Kick off the background album upload immediately (fire-and-forget).
    void startAlbumUpload(prepared);

    // Load this event's frames and auto-pick when there's only one per side.
    try {
      const gf = await apiFetch<GroupedFrames>(`/api/events/${eventId}/frames`);
      setFrames(gf);
      setPick({
        landscape: gf.landscape[0]?.id ?? null,
        portrait: gf.portrait[0]?.id ?? null,
      });
      setStep("frames");
    } catch {
      setError(labels.adminSubmissions.loadError);
      setStep("frames"); // album upload still runs; frames can be retried
    }
  }

  function frameFor(orientation: Orientation): FrameWithUrl | null {
    if (!frames) return null;
    const id = pick[orientation];
    const list = frames[orientation];
    return list.find((f) => f.id === id) ?? null;
  }

  const hasLandscape = items.some((i) => i.orientation === "landscape");
  const hasPortrait = items.some((i) => i.orientation === "portrait");
  const kept = items.filter((i) => frameFor(i.orientation));
  const skippedForNoFrame = items.length - kept.length;
  const totalMagnets = kept.reduce((n, i) => n + i.copies, 0);

  function setCopies(id: string, copies: number) {
    setItems((prev) =>
      prev.map((i) =>
        i.id === id
          ? { ...i, copies: Math.max(1, Math.min(MAX_COPIES, copies)) }
          : i,
      ),
    );
  }
  function removeItem(id: string) {
    // Only removes from the MAGNET review — the photo stays in the album.
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  // Wait for a photo's album upload to finish so we can reference its original.
  async function waitForOriginal(id: string): Promise<string | null> {
    for (let i = 0; i < 40; i++) {
      const entry = albumRef.current.get(id);
      if (entry?.status === "done" && entry.originalId) return entry.originalId;
      if (entry?.status === "failed") return null;
      await sleep(1000);
    }
    return null;
  }

  // --- Commit magnets BY REFERENCE to the uploaded originals (no re-upload) ---
  async function commit() {
    const queue = items.filter((i) => frameFor(i.orientation));
    if (queue.length === 0) {
      setResult({ committed: 0, failed: 0 });
      setStep("done");
      return;
    }

    setStep("committing");
    setProgress({ done: 0, total: queue.length });
    let committed = 0;
    let failed = 0;
    let cursor = 0;

    async function worker() {
      while (cursor < queue.length) {
        const it = queue[cursor++];
        const frame = frameFor(it.orientation)!;
        const originalId = await waitForOriginal(it.id);
        if (!originalId) {
          failed++;
          setProgress((p) => ({ ...p, done: p.done + 1 }));
          continue;
        }
        let ok = false;
        for (let attempt = 0; attempt <= UPLOAD_RETRIES && !ok; attempt++) {
          const r = await commitMagnet({
            eventId,
            originalId,
            frameId: frame.id,
            orientation: it.orientation,
            copies: it.copies,
          });
          if (r.ok) ok = true;
          else if (r.error === "original_not_ready") await sleep(1500);
          else break;
        }
        if (ok) committed++;
        else failed++;
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(COMMIT_CONCURRENCY, queue.length) }, worker),
    );

    setResult({ committed, failed });
    setStep("done");
    onCommitted();
  }

  // Keyboard shortcuts while a photo is enlarged.
  useEffect(() => {
    if (enlarge === null) return;
    function onKey(e: KeyboardEvent) {
      if (enlarge === null) return;
      const it = items[enlarge];
      if (!it) return;
      if (e.key === "Escape") setEnlarge(null);
      else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        const delta = e.key === "ArrowLeft" ? 1 : -1;
        setEnlarge((idx) =>
          idx === null ? idx : (idx + delta + items.length) % items.length,
        );
      } else if (e.key === "+" || e.key === "=") setCopies(it.id, it.copies + 1);
      else if (e.key === "-" || e.key === "_") setCopies(it.id, it.copies - 1);
      else if (/^[0-9]$/.test(e.key)) {
        const n = Number(e.key);
        if (n >= 1) setCopies(it.id, n);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        removeItem(it.id);
        setEnlarge(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enlarge, items]);

  // ---------------------------------------------------------------- rendering

  const panel =
    "rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900";

  // Small always-visible album-upload status (shown from frames step onward).
  function albumStatus() {
    if (albumTotal === 0) return null;
    const complete = albumDone >= albumTotal;
    return (
      <div className="flex flex-col gap-1 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800 dark:bg-sky-950/30 dark:text-sky-300">
        <div className="flex items-center justify-between gap-2">
          <span>
            {complete && albumPublished
              ? labels.bulkUpload.albumPublished
              : complete && albumFailed > 0
                ? tpl(labels.bulkUpload.albumFailedTemplate, { n: albumFailed })
                : tpl(labels.bulkUpload.albumProgressTemplate, {
                    done: albumDone,
                    total: albumTotal,
                  })}
          </span>
          {complete && albumFailed > 0 && (
            <button
              onClick={retryAlbumFailures}
              className="font-medium text-sky-700 underline dark:text-sky-300"
            >
              {labels.bulkUpload.retryFailed}
            </button>
          )}
        </div>
        {!complete && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-sky-200 dark:bg-sky-900">
            <div
              className="h-full bg-sky-500 transition-all"
              style={{ width: `${Math.round((albumDone / albumTotal) * 100)}%` }}
            />
          </div>
        )}
        <span className="text-xs opacity-70">{labels.bulkUpload.keepTabOpen}</span>
      </div>
    );
  }

  if (step === "idle") {
    return (
      <section className="rounded-xl border border-dashed border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <label className="flex cursor-pointer flex-col items-center gap-2 text-center">
          <span className="text-3xl">📁</span>
          <span className="font-semibold text-amber-600">
            {labels.bulkUpload.openButton}
          </span>
          <span className="text-xs text-zinc-500">{labels.bulkUpload.help}</span>
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </label>
        {error && (
          <p className="mt-2 text-center text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </section>
    );
  }

  if (step === "preparing") {
    return (
      <section className={panel}>
        <p className="text-center text-sm font-medium text-zinc-600 dark:text-zinc-300">
          {tpl(labels.bulkUpload.preparingTemplate, prep)}
        </p>
      </section>
    );
  }

  if (step === "frames") {
    const noFrames =
      (frames?.landscape.length ?? 0) === 0 &&
      (frames?.portrait.length ?? 0) === 0;
    return (
      <section className={`${panel} flex flex-col gap-4`}>
        {albumStatus()}
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
          {labels.bulkUpload.chooseFramesTitle}
        </h3>

        {noFrames ? (
          <p className="text-sm text-amber-600 dark:text-amber-400">
            {labels.bulkUpload.noFramesAtAll}
          </p>
        ) : (
          <>
            {hasLandscape && (
              <FrameRow
                heading={labels.bulkUpload.landscapeFrame}
                list={frames?.landscape ?? []}
                selectedId={pick.landscape}
                onSelect={(id) => setPick((p) => ({ ...p, landscape: id }))}
                emptyWarn={tpl(labels.bulkUpload.noFrameWarnTemplate, {
                  orientation: labels.bulkUpload.orientationLandscape,
                })}
              />
            )}
            {hasPortrait && (
              <FrameRow
                heading={labels.bulkUpload.portraitFrame}
                list={frames?.portrait ?? []}
                selectedId={pick.portrait}
                onSelect={(id) => setPick((p) => ({ ...p, portrait: id }))}
                emptyWarn={tpl(labels.bulkUpload.noFrameWarnTemplate, {
                  orientation: labels.bulkUpload.orientationPortrait,
                })}
              />
            )}
          </>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={() => setStep("review")}
            disabled={noFrames}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
          >
            {labels.bulkUpload.continueToReview}
          </button>
        </div>
      </section>
    );
  }

  if (step === "committing") {
    const pct = progress.total
      ? Math.round((progress.done / progress.total) * 100)
      : 0;
    return (
      <section className={`${panel} flex flex-col gap-3`}>
        {albumStatus()}
        <p className="text-center text-sm font-medium text-zinc-600 dark:text-zinc-300">
          {tpl(labels.bulkUpload.committingTemplate, progress)}
        </p>
        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div
            className="h-full bg-amber-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </section>
    );
  }

  if (step === "done") {
    return (
      <section className={`${panel} flex flex-col items-center gap-3 text-center`}>
        {albumStatus()}
        <span className="text-3xl">✅</span>
        <p className="font-semibold text-zinc-900 dark:text-white">
          {tpl(labels.bulkUpload.doneMagnetsTemplate, result)}
        </p>
        <button
          onClick={reset}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-600"
        >
          {labels.bulkUpload.startOver}
        </button>
      </section>
    );
  }

  // step === "review"
  return (
    <section className={`${panel} flex flex-col gap-4`}>
      {albumStatus()}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
          {labels.bulkUpload.reviewTitle}
        </h3>
        <span className="text-sm text-zinc-500">
          {tpl(labels.bulkUpload.summaryTemplate, {
            photos: kept.length,
            magnets: totalMagnets,
          })}
        </span>
      </div>

      {skippedForNoFrame > 0 && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          {tpl(labels.bulkUpload.skippedNoFrameTemplate, {
            n: skippedForNoFrame,
          })}
        </p>
      )}
      <p className="text-xs text-zinc-400">{labels.bulkUpload.keyboardHint}</p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {items.map((it, idx) => {
          const frame = frameFor(it.orientation);
          const willSkip = !frame;
          return (
            <div
              key={it.id}
              className={`flex flex-col gap-2 rounded-xl border p-2 ${
                willSkip
                  ? "border-red-300 opacity-60 dark:border-red-900"
                  : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              <button
                type="button"
                onClick={() => setEnlarge(idx)}
                className="block"
                title={labels.bulkUpload.enlargeHint}
              >
                {frame ? (
                  <FramedPhoto
                    photoUrl={it.url}
                    frameUrl={frame.url}
                    orientation={it.orientation}
                    window={frame.window}
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={it.url}
                    alt=""
                    className="w-full rounded-lg object-cover"
                  />
                )}
              </button>

              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCopies(it.id, it.copies - 1)}
                    disabled={it.copies <= 1}
                    className="h-7 w-7 rounded-full border border-zinc-300 text-sm font-bold text-zinc-700 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300"
                  >
                    −
                  </button>
                  <span className="w-5 text-center text-sm font-semibold">
                    {it.copies}
                  </span>
                  <button
                    onClick={() => setCopies(it.id, it.copies + 1)}
                    disabled={it.copies >= MAX_COPIES}
                    className="h-7 w-7 rounded-full border border-zinc-300 text-sm font-bold text-zinc-700 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300"
                  >
                    +
                  </button>
                </div>
                <button
                  onClick={() => removeItem(it.id)}
                  className="text-sm font-medium text-red-500 hover:text-red-700"
                  title={labels.bulkUpload.deletePhoto}
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={commit}
          disabled={kept.length === 0}
          className="rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
        >
          {labels.bulkUpload.commitButton} ({kept.length})
        </button>
      </div>

      {/* Enlarge modal */}
      {enlarge !== null && items[enlarge] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
          onClick={() => setEnlarge(null)}
        >
          <div
            className="flex max-h-full w-full max-w-md flex-col items-center gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const it = items[enlarge];
              const frame = frameFor(it.orientation);
              return frame ? (
                <FramedPhoto
                  photoUrl={it.url}
                  frameUrl={frame.url}
                  orientation={it.orientation}
                  window={frame.window}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.url} alt="" className="max-h-[70vh] rounded-xl" />
              );
            })()}
            <div className="flex items-center gap-4 rounded-full bg-white/95 px-4 py-2 dark:bg-zinc-900/95">
              <button
                onClick={() => setCopies(items[enlarge].id, items[enlarge].copies - 1)}
                disabled={items[enlarge].copies <= 1}
                className="h-9 w-9 rounded-full border border-zinc-300 text-lg font-bold disabled:opacity-40 dark:border-zinc-700"
              >
                −
              </button>
              <span className="w-6 text-center text-lg font-semibold">
                {items[enlarge].copies}
              </span>
              <button
                onClick={() => setCopies(items[enlarge].id, items[enlarge].copies + 1)}
                disabled={items[enlarge].copies >= MAX_COPIES}
                className="h-9 w-9 rounded-full border border-zinc-300 text-lg font-bold disabled:opacity-40 dark:border-zinc-700"
              >
                +
              </button>
              <button
                onClick={() => {
                  removeItem(items[enlarge].id);
                  setEnlarge(null);
                }}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
              >
                {labels.bulkUpload.deletePhoto}
              </button>
              <button
                onClick={() => setEnlarge(null)}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-300"
              >
                {labels.bulkUpload.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// A single-orientation frame chooser (thumbnails).
function FrameRow({
  heading,
  list,
  selectedId,
  onSelect,
  emptyWarn,
}: {
  heading: string;
  list: FrameWithUrl[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  emptyWarn: string;
}) {
  if (list.length === 0) {
    return <p className="text-sm text-amber-600 dark:text-amber-400">{emptyWarn}</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {heading}
      </span>
      <div className="flex flex-wrap gap-2">
        {list.map((f) => (
          <button
            key={f.id}
            onClick={() => onSelect(f.id)}
            className={`overflow-hidden rounded-lg border-2 ${
              selectedId === f.id
                ? "border-amber-500"
                : "border-transparent opacity-70 hover:opacity-100"
            }`}
            style={{
              width: f.orientation === "landscape" ? 120 : 90,
              height: f.orientation === "landscape" ? 90 : 120,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.url} alt="" className="h-full w-full object-contain" />
          </button>
        ))}
      </div>
    </div>
  );
}
