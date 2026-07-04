"use client";

import { labels } from "@/lib/labels";

// The first screen a guest sees: custom (per-event) heading + subheading and a
// single primary button to start.
export default function WelcomeScreen({
  heading,
  subheading,
  onStart,
}: {
  heading: string;
  subheading: string;
  onStart: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-gradient-to-b from-white to-zinc-100 px-6 text-center dark:from-zinc-950 dark:to-black">
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl dark:text-white">
          {heading || labels.site.title}
        </h1>
        {subheading && (
          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            {subheading}
          </p>
        )}
      </div>

      <button
        onClick={onStart}
        className="rounded-full bg-amber-500 px-8 py-4 text-lg font-semibold text-white shadow-lg transition-colors hover:bg-amber-600"
      >
        {labels.guest.startButton}
      </button>
    </main>
  );
}
