"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api-client";
import { labels } from "@/lib/labels";
import type { GroupedFrames, FrameWithUrl } from "@/lib/types";

// Maps server error codes to friendly Hebrew messages.
const errorLabel: Record<string, string> = {
  invalid_type: labels.frames.errInvalidType,
  file_too_large: labels.frames.errTooLarge,
  ambiguous_orientation: labels.frames.errAmbiguous,
  would_break_open_event: labels.frames.errWouldBreak,
};

interface Props {
  eventId: string;
  onCountsChange?: (counts: { portrait: number; landscape: number }) => void;
}

export default function FrameManager({ eventId, onCountsChange }: Props) {
  const [frames, setFrames] = useState<GroupedFrames | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const data = await apiFetch<GroupedFrames>(
      `/api/events/${eventId}/frames`,
    );
    setFrames(data);
    onCountsChange?.({
      portrait: data.portrait.length,
      landscape: data.landscape.length,
    });
  }, [eventId, onCountsChange]);

  useEffect(() => {
    load().catch(() => setError(labels.frames.errGeneric));
  }, [load]);

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    if (!list || list.length === 0) return;
    setError("");
    setUploading(true);

    const fd = new FormData();
    for (const file of Array.from(list)) fd.append("file", file);

    try {
      await apiFetch(`/api/events/${eventId}/frames`, {
        method: "POST",
        body: fd,
      });
      await load();
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setError(errorLabel[code] ?? labels.frames.errGeneric);
    }
    setUploading(false);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function handleDelete(frameId: string) {
    if (!confirm(labels.frames.confirmDelete)) return;
    setError("");
    try {
      await apiFetch(`/api/events/${eventId}/frames/${frameId}`, {
        method: "DELETE",
      });
      await load();
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setError(errorLabel[code] ?? labels.frames.errGeneric);
    }
  }

  function renderGroup(heading: string, empty: string, list: FrameWithUrl[]) {
    return (
      <div>
        <h4 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          {heading} ({list.length})
        </h4>
        {list.length === 0 ? (
          <p className="text-sm text-zinc-400">{empty}</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {list.map((frame) => (
              <div
                key={frame.id}
                className="group relative overflow-hidden rounded-lg border border-zinc-200 bg-[repeating-conic-gradient(#eee_0_25%,#fff_0_50%)] bg-[length:16px_16px] dark:border-zinc-700"
              >
                {/* checkerboard bg shows the frame's transparency */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={frame.url}
                  alt=""
                  className="object-contain"
                  style={{
                    width: frame.orientation === "landscape" ? 160 : 120,
                    height: frame.orientation === "landscape" ? 120 : 160,
                  }}
                />
                <button
                  onClick={() => handleDelete(frame.id)}
                  className="absolute top-1 left-1 rounded bg-red-600/90 px-2 py-0.5 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  {labels.frames.delete}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
        {labels.frames.title}
      </h3>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {labels.frames.help}
      </p>

      <div className="mt-4">
        <input
          ref={fileInput}
          type="file"
          accept="image/png"
          multiple
          onChange={handleFiles}
          className="hidden"
        />
        <button
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
        >
          {uploading ? labels.frames.uploading : labels.frames.uploadButton}
        </button>
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {frames && (
        <div className="mt-6 flex flex-col gap-6">
          {renderGroup(
            labels.frames.landscapeHeading,
            labels.frames.emptyLandscape,
            frames.landscape,
          )}
          {renderGroup(
            labels.frames.portraitHeading,
            labels.frames.emptyPortrait,
            frames.portrait,
          )}
        </div>
      )}
    </section>
  );
}
