"use client";

import { useState } from "react";
import FramedPhoto from "@/components/guest/FramedPhoto";
import { labels } from "@/lib/labels";
import type { Orientation, PublicFrame } from "@/lib/types";

// Guest cycles through the matching-orientation frames, each previewed live on
// their photo, then picks one.
export default function FramePicker({
  photoUrl,
  orientation,
  frames,
  onChoose,
  onRetake,
}: {
  photoUrl: string;
  orientation: Orientation;
  frames: PublicFrame[];
  onChoose: (frame: PublicFrame) => void;
  onRetake: () => void;
}) {
  const [index, setIndex] = useState(0);
  const current = frames[index];
  const many = frames.length > 1;

  function go(delta: number) {
    setIndex((i) => (i + delta + frames.length) % frames.length);
  }

  // Basic touch-swipe support.
  const [touchX, setTouchX] = useState<number | null>(null);
  function onTouchStart(e: React.TouchEvent) {
    setTouchX(e.touches[0].clientX);
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 40) go(dx > 0 ? -1 : 1); // swipe threshold
    setTouchX(null);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 px-6">
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
        {labels.guest.framingTitle}
      </h2>

      <div
        className="w-full"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {current && (
          <FramedPhoto
            photoUrl={photoUrl}
            frameUrl={current.url}
            orientation={orientation}
          />
        )}
      </div>

      {many && (
        <div className="flex items-center gap-6">
          <button
            onClick={() => go(-1)}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
          >
            {labels.guest.prev}
          </button>
          <span className="text-sm text-zinc-500">
            {index + 1} / {frames.length}
          </span>
          <button
            onClick={() => go(1)}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
          >
            {labels.guest.next}
          </button>
        </div>
      )}

      <div className="flex w-full max-w-xs flex-col gap-3">
        <button
          onClick={() => current && onChoose(current)}
          className="rounded-xl bg-amber-500 px-6 py-3.5 text-lg font-semibold text-white transition-colors hover:bg-amber-600"
        >
          {labels.guest.chooseThisFrame}
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
