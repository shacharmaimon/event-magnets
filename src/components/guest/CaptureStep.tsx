"use client";

import { useRef } from "react";
import { labels } from "@/lib/labels";

// Lets the guest either take a live photo (rear camera via capture="environment")
// or pick from their gallery. Both use a hidden file input; the only difference
// is the capture attribute. Hands the chosen File up to the parent.
export default function CaptureStep({
  onPhoto,
}: {
  onPhoto: (file: File) => void;
}) {
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onPhoto(file);
    e.target.value = ""; // allow re-picking the same file
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
        {labels.guest.chooseSource}
      </h2>

      <div className="flex w-full max-w-xs flex-col gap-3">
        <input
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleChange}
          className="hidden"
        />
        <input
          ref={galleryInput}
          type="file"
          accept="image/*"
          onChange={handleChange}
          className="hidden"
        />

        <button
          onClick={() => cameraInput.current?.click()}
          className="rounded-xl bg-amber-500 px-6 py-4 text-lg font-semibold text-white transition-colors hover:bg-amber-600"
        >
          {labels.guest.takePhoto}
        </button>
        <button
          onClick={() => galleryInput.current?.click()}
          className="rounded-xl border border-zinc-300 px-6 py-4 text-lg font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          {labels.guest.uploadFromGallery}
        </button>
      </div>
    </main>
  );
}
