"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { apiFetch, apiFetchBlob } from "@/lib/api-client";
import { labels } from "@/lib/labels";
import type { SubmissionWithUrl } from "@/lib/types";

const POLL_MS = 7000;

// Live-ish gallery of an event's submitted magnets. Polls every 7s so new
// photos appear during the event. Supports single + batch (ZIP) download.
export default function SubmissionsGallery({
  eventId,
  eventName,
}: {
  eventId: string;
  eventName: string;
}) {
  const [submissions, setSubmissions] = useState<SubmissionWithUrl[]>([]);
  const [count, setCount] = useState(0);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [zipping, setZipping] = useState(false);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) return; // avoid overlapping polls
    inFlight.current = true;
    try {
      const data = await apiFetch<{
        count: number;
        submissions: SubmissionWithUrl[];
      }>(`/api/events/${eventId}/submissions`);
      setSubmissions(data.submissions);
      setCount(data.count);
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

  async function downloadAll() {
    setZipping(true);
    setError("");
    try {
      const blob = await apiFetchBlob(
        `/api/events/${eventId}/submissions/zip`,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeName = (eventName || "event").replace(/[^\p{L}\p{N}_-]+/gu, "_");
      a.download = `${safeName}-magnets.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError(labels.adminSubmissions.zipError);
    }
    setZipping(false);
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
          {labels.adminSubmissions.photosCount}: {count}
        </h2>
        {count > 0 && (
          <button
            onClick={downloadAll}
            disabled={zipping}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
          >
            {zipping
              ? labels.adminSubmissions.preparingZip
              : labels.adminSubmissions.downloadAll}
          </button>
        )}
      </div>

      {error && <p className="text-red-600 dark:text-red-400">{error}</p>}

      {loaded && count === 0 && (
        <p className="text-zinc-500">{labels.adminSubmissions.empty}</p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {submissions.map((s) => (
          <div
            key={s.id}
            className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={s.url}
              alt=""
              className="w-full rounded-lg object-cover"
            />
            <a
              href={`${s.url}&download=magnet-${s.id.slice(0, 8)}.jpg`}
              className="text-center text-sm font-medium text-amber-600 hover:text-amber-700"
            >
              {labels.adminSubmissions.downloadOne}
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
