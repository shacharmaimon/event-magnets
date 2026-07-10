"use client";

import { useState } from "react";
import { labels } from "@/lib/labels";
import type { PublicAlbumPhoto } from "@/lib/types";

// Public, read-only album gallery for hosts. Photos are passed in from the
// server (no polling, no auth). Download-all uses a plain fetch to the public
// album zip endpoint (authorized by the token in the URL).
export default function AlbumGallery({
  token,
  eventName,
  photos,
}: {
  token: string;
  eventName: string;
  photos: PublicAlbumPhoto[];
}) {
  const [zipping, setZipping] = useState(false);
  const [error, setError] = useState("");

  async function downloadAll() {
    setZipping(true);
    setError("");
    try {
      const res = await fetch(`/api/album/${token}/zip`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeName = (eventName || "album").replace(/[^\p{L}\p{N}_-]+/gu, "_");
      a.download = `${safeName}-album.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError(labels.album.zipError);
    }
    setZipping(false);
  }

  if (photos.length === 0) {
    return <p className="text-zinc-500">{labels.album.empty}</p>;
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex justify-end">
        <button
          onClick={downloadAll}
          disabled={zipping}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
        >
          {zipping ? labels.album.preparingZip : labels.album.downloadAll}
        </button>
      </div>

      {error && <p className="text-red-600 dark:text-red-400">{error}</p>}

      {zipping && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
          {labels.album.preparingZipLarge}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((p) => (
          <div
            key={p.id}
            className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="" className="w-full rounded-lg object-cover" />
            <a
              href={`${p.url}&download=magnet-${p.id.slice(0, 8)}.jpg`}
              className="text-center text-sm font-medium text-amber-600 hover:text-amber-700"
            >
              {labels.album.downloadOne}
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
