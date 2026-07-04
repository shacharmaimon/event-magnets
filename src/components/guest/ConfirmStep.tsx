"use client";

import { useState } from "react";
import FramedPhoto from "@/components/guest/FramedPhoto";
import { submitMagnet } from "@/lib/guest-submit";
import { labels } from "@/lib/labels";
import type { Orientation, PublicFrame } from "@/lib/types";

// Final review + submit. On the expected Phase-5 501 ("not_implemented") it
// shows a friendly "coming soon" message; Phase 6 makes submission real.
export default function ConfirmStep({
  slug,
  photoFile,
  photoUrl,
  frame,
  orientation,
  deviceId,
  onRetake,
  onDone,
}: {
  slug: string;
  photoFile: File;
  photoUrl: string;
  frame: PublicFrame;
  orientation: Orientation;
  deviceId: string;
  onRetake: () => void;
  onDone: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  async function handleConfirm() {
    setSubmitting(true);
    setMessage("");
    const result = await submitMagnet({
      slug,
      photoFile,
      frameId: frame.id,
      orientation,
      deviceId,
    });
    setSubmitting(false);

    if (result.ok) {
      onDone();
    } else if (result.error === "not_implemented") {
      // Expected until Phase 6.
      setMessage(labels.guest.comingSoon);
    } else {
      setMessage(labels.guest.submitError);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center">
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
        {labels.guest.confirmTitle}
      </h2>

      <FramedPhoto
        photoUrl={photoUrl}
        frameUrl={frame.url}
        orientation={orientation}
      />

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
