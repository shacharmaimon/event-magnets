"use client";

import { useState } from "react";
import QrCode from "@/components/admin/QrCode";
import { labels } from "@/lib/labels";

// Admin card showing the shareable album link (+ copy + QR) to send to hosts.
// Uses the long album_token, NOT the guest slug.
export default function ShareAlbumCard({ albumToken }: { albumToken: string }) {
  const [copied, setCopied] = useState(false);

  const base =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (typeof window !== "undefined" ? window.location.origin : "");
  const url = `${base}/album/${albumToken}`;

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
        {labels.adminAlbum.title}
      </h3>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {labels.adminAlbum.help}
      </p>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex flex-1 flex-col gap-2">
          <input
            readOnly
            value={url}
            dir="ltr"
            className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          />
          <button
            onClick={copy}
            className="self-start rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {copied ? labels.adminAlbum.copied : labels.adminAlbum.copyLink}
          </button>
        </div>

        <QrCode value={url} />
      </div>
    </section>
  );
}
