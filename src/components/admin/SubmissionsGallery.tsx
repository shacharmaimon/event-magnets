"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { apiFetch, apiFetchBlob } from "@/lib/api-client";
import { labels } from "@/lib/labels";
import type { GroupedSubmission } from "@/lib/types";

const POLL_MS = 30000;

type GalleryData = {
  count: number; // total magnets to print (copies expanded)
  uniqueCount: number; // unique photos shown
  newIndividual: number; // not-yet-downloaded (individual) magnets
  newSheets: number; // not-yet-printed (sheet) magnets
  submissions: GroupedSubmission[];
};

// Live-ish gallery of an event's submitted magnets. Copies are collapsed into a
// single card badged "×N". Supports single, batch (all/new), and multi-select
// downloads, for both individual magnets and 2-up print sheets. The "new"
// counters for individual downloads vs print sheets are tracked independently.
export default function SubmissionsGallery({
  eventId,
  eventName,
}: {
  eventId: string;
  eventName: string;
}) {
  const [submissions, setSubmissions] = useState<GroupedSubmission[]>([]);
  const [count, setCount] = useState(0);
  const [newIndividual, setNewIndividual] = useState(0);
  const [newSheets, setNewSheets] = useState(0);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [zipping, setZipping] = useState(false);
  // Selected photos, keyed by finished_storage_path (the group key).
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const inFlight = useRef(false);
  // Remember the signed URL already shown for each photo path. Re-signing on
  // every poll would give each image a new URL and force the browser to
  // re-download ALL thumbnails every cycle (huge egress). Reusing the URL for
  // paths we've already seen lets the browser cache them; only NEW photos load.
  const urlByPath = useRef<Map<string, string>>(new Map());

  const load = useCallback(async () => {
    if (inFlight.current) return; // avoid overlapping polls
    inFlight.current = true;
    try {
      const data = await apiFetch<GalleryData>(
        `/api/events/${eventId}/submissions`,
      );
      // Keep stable URLs for already-seen photos; only new ones get a fresh URL.
      const merged = data.submissions.map((s) => {
        const known = urlByPath.current.get(s.path);
        if (known) return { ...s, url: known };
        urlByPath.current.set(s.path, s.url);
        return s;
      });
      setSubmissions(merged);
      setCount(data.count);
      setNewIndividual(data.newIndividual);
      setNewSheets(data.newSheets);
      // Drop any selection whose photo no longer exists.
      setSelected((prev) => {
        const paths = new Set(merged.map((m) => m.path));
        const next = new Set([...prev].filter((p) => paths.has(p)));
        return next.size === prev.size ? prev : next;
      });
      setError("");
    } catch {
      setError(labels.adminSubmissions.loadError);
    } finally {
      inFlight.current = false;
      setLoaded(true);
    }
  }, [eventId]);

  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (!document.hidden) load();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  function toggle(path: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(submissions.map((s) => s.path)));
  }
  function clearSelection() {
    setSelected(new Set());
  }

  // Trigger a browser download from a Blob.
  function saveBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const safeName = (eventName || "event").replace(/[^\p{L}\p{N}_-]+/gu, "_");

  // Download all/new via the GET endpoints (?new=1 marks the matching counter).
  //   kind "zip"    -> individual finished images
  //   kind "sheets" -> 2-up 4x6 print sheets
  async function downloadZip(kind: "zip" | "sheets", onlyNew: boolean) {
    setZipping(true);
    setError("");
    try {
      const path =
        kind === "sheets"
          ? `/api/events/${eventId}/submissions/print-sheets`
          : `/api/events/${eventId}/submissions/zip`;
      const blob = await apiFetchBlob(`${path}${onlyNew ? "?new=1" : ""}`);
      const suffix = kind === "sheets" ? "print-sheets" : "magnets";
      saveBlob(blob, `${safeName}-${suffix}${onlyNew ? "-new" : ""}.zip`);
      if (onlyNew) await load(); // refresh so the "new" count updates
    } catch {
      setError(labels.adminSubmissions.zipError);
    }
    setZipping(false);
  }

  // Download only the SELECTED photos (POST with the chosen paths). Neutral:
  // does not touch the "new" counters. A ×N photo still yields N magnets.
  async function downloadSelected(kind: "zip" | "sheets") {
    if (selected.size === 0) return;
    setZipping(true);
    setError("");
    try {
      const path =
        kind === "sheets"
          ? `/api/events/${eventId}/submissions/print-sheets`
          : `/api/events/${eventId}/submissions/zip`;
      const blob = await apiFetchBlob(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths: [...selected] }),
      });
      const suffix = kind === "sheets" ? "print-sheets" : "magnets";
      saveBlob(blob, `${safeName}-${suffix}-selected.zip`);
    } catch {
      setError(labels.adminSubmissions.zipError);
    }
    setZipping(false);
  }

  const t = (tpl: string, n: number) => tpl.replace("{n}", String(n));

  return (
    <section className="flex flex-col gap-4 pb-24">
      <div className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
          {labels.adminSubmissions.magnetsCount}: {count}
        </h2>
        {count > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Primary: download only NEW individual magnets (for big 4x6 prints) */}
            <button
              onClick={() => downloadZip("zip", true)}
              disabled={zipping || newIndividual === 0}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
            >
              {zipping
                ? labels.adminSubmissions.preparingZip
                : `${labels.adminSubmissions.downloadNew} (${newIndividual})`}
            </button>
            {/* NEW as 2-up print sheets (independent counter) */}
            <button
              onClick={() => downloadZip("sheets", true)}
              disabled={zipping || newSheets === 0}
              className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-600 disabled:opacity-50"
            >
              {`${labels.adminSubmissions.printSheetsNew} (${newSheets})`}
            </button>
            {/* Re-download everything (individual) */}
            <button
              onClick={() => downloadZip("zip", false)}
              disabled={zipping}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {labels.adminSubmissions.downloadAllAgain}
            </button>
            {/* Re-download all as print sheets */}
            <button
              onClick={() => downloadZip("sheets", false)}
              disabled={zipping}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {labels.adminSubmissions.printSheetsAll}
            </button>
          </div>
        )}
        {/* Select-all / clear affordance */}
        {count > 0 && (
          <div className="flex items-center gap-3 text-sm">
            <button
              onClick={selectAll}
              className="font-medium text-amber-600 hover:text-amber-700"
            >
              {labels.adminSubmissions.selectAll}
            </button>
            {selected.size > 0 && (
              <button
                onClick={clearSelection}
                className="font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                {labels.adminSubmissions.clearSelection}
              </button>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-red-600 dark:text-red-400">{error}</p>}

      {loaded && count === 0 && (
        <p className="text-zinc-500">{labels.adminSubmissions.empty}</p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {submissions.map((s) => {
          const isSelected = selected.has(s.path);
          return (
            <div
              key={s.path}
              className={`relative flex flex-col gap-2 rounded-xl border bg-white p-2 transition-colors dark:bg-zinc-900 ${
                isSelected
                  ? "border-amber-500 ring-2 ring-amber-500"
                  : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              {/* Tap the image to toggle selection. */}
              <button
                type="button"
                onClick={() => toggle(s.path)}
                className="relative block"
                aria-pressed={isSelected}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.url}
                  alt=""
                  className="w-full rounded-lg object-cover"
                />
                {/* Selection checkmark */}
                <span
                  className={`absolute end-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border text-xs font-bold ${
                    isSelected
                      ? "border-amber-500 bg-amber-500 text-white"
                      : "border-white/80 bg-black/30 text-transparent"
                  }`}
                >
                  ✓
                </span>
                {/* Copies badge (×N) — only when more than one copy */}
                {s.copies > 1 && (
                  <span className="absolute bottom-2 start-2 rounded-full bg-black/70 px-2 py-0.5 text-xs font-bold text-white">
                    {t(labels.adminSubmissions.copiesBadge, s.copies)}
                  </span>
                )}
              </button>
              <a
                href={`${s.url}&download=magnet-${s.id.slice(0, 8)}.jpg`}
                className="text-center text-sm font-medium text-amber-600 hover:text-amber-700"
              >
                {labels.adminSubmissions.downloadOne}
              </a>
            </div>
          );
        })}
      </div>

      {/* Sticky action bar for the current selection. */}
      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-zinc-200 bg-white/95 p-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
          <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t(labels.adminSubmissions.selectedCount, selected.size)}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => downloadSelected("sheets")}
                disabled={zipping}
                className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-600 disabled:opacity-50"
              >
                {labels.adminSubmissions.printSheetsSelected}
              </button>
              <button
                onClick={() => downloadSelected("zip")}
                disabled={zipping}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
              >
                {labels.adminSubmissions.downloadSelected}
              </button>
              <button
                onClick={clearSelection}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {labels.adminSubmissions.clearSelection}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
