"use client";

import { useState } from "react";
import { labels } from "@/lib/labels";

// The success screen after a magnet is sent. Shows the finished magnet and
// three actions: share (native share sheet — IG/WhatsApp/etc.), save to device,
// and add another magnet.
export default function DoneScreen({
  finishedUrl,
  onAddAnother,
}: {
  finishedUrl: string | null;
  onAddAnother: () => void;
}) {
  const [busy, setBusy] = useState(false);

  // Fetch the (signed) image once as a File/Blob for share/download.
  async function getFile(): Promise<{ blob: Blob; file: File } | null> {
    if (!finishedUrl) return null;
    const res = await fetch(finishedUrl);
    const blob = await res.blob();
    const file = new File([blob], "magnet.jpg", { type: "image/jpeg" });
    return { blob, file };
  }

  // Native share sheet — the guest picks Instagram (Stories), WhatsApp, Save…
  // A true one-tap "post to IG story" isn't possible from a web page, so we use
  // the OS share sheet, which is the reliable cross-platform path.
  async function share() {
    setBusy(true);
    try {
      const f = await getFile();
      if (f && navigator.canShare?.({ files: [f.file] })) {
        await navigator.share({ files: [f.file] });
      } else {
        // Fallback: no file sharing support → just download.
        await download();
      }
    } catch {
      // user cancelled or share failed — no-op
    }
    setBusy(false);
  }

  // Save the finished image to the device.
  async function download() {
    const f = await getFile();
    if (!f) return;
    const url = URL.createObjectURL(f.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "magnet.jpg";
    a.click();
    URL.revokeObjectURL(url);
  }

  const canShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center">
      <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">
        {labels.guest.doneTitle}
      </h2>
      {finishedUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={finishedUrl}
          alt=""
          className="mx-auto w-full max-w-sm rounded-xl shadow-lg"
        />
      )}
      <p className="text-zinc-500 dark:text-zinc-400">{labels.guest.doneBody}</p>

      <div className="flex w-full max-w-xs flex-col gap-3">
        {/* Share opens the native sheet (which includes "Save Image"). If the
            device has no share support, it falls back to a direct download. */}
        <button
          onClick={canShare ? share : download}
          disabled={busy}
          className="rounded-xl bg-amber-500 px-6 py-3 font-semibold text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
        >
          {labels.guest.shareButton}
        </button>
        <button
          onClick={onAddAnother}
          className="rounded-xl border border-zinc-300 px-6 py-3 font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          {labels.guest.addAnother}
        </button>
      </div>
    </main>
  );
}
