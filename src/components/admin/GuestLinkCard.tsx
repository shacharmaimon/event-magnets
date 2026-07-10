"use client";

import { useState } from "react";
import QrCode from "@/components/admin/QrCode";
import PrintableQrButton from "@/components/admin/PrintableQrButton";
import { labels } from "@/lib/labels";

// Shows the guest link for an event (read-only, LTR) with a copy button, plus
// its QR code and a "download printable QR page" button. The base URL comes from
// NEXT_PUBLIC_SITE_URL when set (so production links are stable), otherwise the
// current browser origin.
export default function GuestLinkCard({
  slug,
  welcomeHeading,
  eventName,
}: {
  slug: string;
  welcomeHeading: string;
  eventName: string;
}) {
  const [copied, setCopied] = useState(false);

  const base =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (typeof window !== "undefined" ? window.location.origin : "");
  const url = `${base}/e/${slug}`;

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
        {labels.adminEvents.guestLinkTitle}
      </h3>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {labels.adminEvents.guestLinkHelp}
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
            {copied ? labels.adminEvents.copied : labels.adminEvents.copyLink}
          </button>
        </div>

        <QrCode value={url} />
      </div>

      {/* Printable 10x15 QR + instructions page for the DNP printer. */}
      <div className="mt-4">
        <PrintableQrButton
          slug={slug}
          welcomeHeading={welcomeHeading}
          eventName={eventName}
        />
      </div>
    </section>
  );
}
