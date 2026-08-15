"use client";

import { useState } from "react";
import FramedPhoto from "@/components/guest/FramedPhoto";
import { submitMagnet } from "@/lib/guest-submit";
import { labels } from "@/lib/labels";
import type { Orientation, PublicFrame } from "@/lib/types";

// Final review + submit, with an optional copies stepper.
export default function ConfirmStep({
  slug,
  photoFile,
  photoUrl,
  frame,
  orientation,
  deviceId,
  maxCopies,
  onRetake,
  onDone,
}: {
  slug: string;
  photoFile: File;
  photoUrl: string;
  frame: PublicFrame;
  orientation: Orientation;
  deviceId: string;
  maxCopies: number; // event's photos_per_device
  onRetake: () => void;
  onDone: (finishedUrl: string | null) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [copies, setCopies] = useState(1);
  const [mirrored, setMirrored] = useState(false);

  async function handleConfirm() {
    setSubmitting(true);
    setMessage("");
    const result = await submitMagnet({
      slug,
      photoFile,
      frameId: frame.id,
      orientation,
      deviceId,
      copies,
      mirrored,
    });
    setSubmitting(false);

    if (result.ok) {
      onDone(result.url ?? null);
    } else if (result.error === "limit_reached") {
      setMessage(labels.guest.limitReached);
    } else {
      setMessage(labels.guest.submitError);
    }
  }

  const showCopies = maxCopies > 1;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center">
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
        {labels.guest.confirmTitle}
      </h2>

      <FramedPhoto
        photoUrl={photoUrl}
        frameUrl={frame.url}
        orientation={orientation}
        mirrored={mirrored}
        window={frame.window}
      />

      {/* Flip — fixes mirrored selfies from the front camera */}
      <button
        onClick={() => setMirrored((m) => !m)}
        className="text-sm font-medium text-zinc-600 hover:text-amber-600 dark:text-zinc-400"
      >
        {labels.guest.flip}
      </button>

      {showCopies && (
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {labels.guest.copiesLabel}
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCopies((c) => Math.max(1, c - 1))}
              disabled={copies <= 1}
              className="h-9 w-9 rounded-full border border-zinc-300 text-lg font-bold text-zinc-700 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300"
            >
              −
            </button>
            <span className="w-6 text-lg font-semibold">{copies}</span>
            <button
              onClick={() => setCopies((c) => Math.min(maxCopies, c + 1))}
              disabled={copies >= maxCopies}
              className="h-9 w-9 rounded-full border border-zinc-300 text-lg font-bold text-zinc-700 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300"
            >
              +
            </button>
          </div>
        </div>
      )}

      {message && (
        <p className="text-base font-medium text-amber-600 dark:text-amber-400">
          {message}
        </p>
      )}

      <div className="flex w-full max-w-xs flex-col gap-3">
        <button
          onClick={handleConfirm}
          disabled={submitting}
          className="rounded-xl bg-amber-500 px-6 py-3.5 text-lg font-semibold text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
        >
          {submitting ? labels.guest.submitting : labels.guest.confirm}
        </button>
        <button
          onClick={onRetake}
          className="text-sm text-zinc-500 hover:text-amber-600"
        >
          {labels.guest.retake}
        </button>
      </div>
    </main>
  );
}
