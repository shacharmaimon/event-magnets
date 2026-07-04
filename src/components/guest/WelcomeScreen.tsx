"use client";

import { labels } from "@/lib/labels";

// The first screen a guest sees: custom (per-event) heading + subheading, a fun
// 3-step "how it works" explainer, and a single primary button to start.
export default function WelcomeScreen({
  heading,
  subheading,
  onStart,
}: {
  heading: string;
  subheading: string;
  onStart: () => void;
}) {
  const steps = [
    {
      n: "1",
      title: labels.guest.step1Title,
      body: labels.guest.step1Body,
    },
    {
      n: "2",
      title: labels.guest.step2Title,
      body: labels.guest.step2Body,
    },
    {
      n: "3",
      title: labels.guest.step3Title,
      body: labels.guest.step3Body,
    },
  ];

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-gradient-to-b from-white to-zinc-100 px-6 py-12 text-center dark:from-zinc-950 dark:to-black">
      <div className="flex flex-col items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl dark:text-white">
          {heading || labels.site.title}
        </h1>
        {subheading && (
          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            {subheading}
          </p>
        )}
      </div>

      {/* How it works — 3 fun steps */}
      <div className="flex w-full max-w-md flex-col gap-4">
        {steps.map((step) => (
          <div
            key={step.n}
            className="flex items-start gap-4 rounded-2xl border border-zinc-200 bg-white p-4 text-right dark:border-zinc-800 dark:bg-zinc-900"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500 text-lg font-bold text-white">
              {step.n}
            </span>
            <div className="flex flex-col gap-0.5">
              <span className="font-semibold text-zinc-900 dark:text-white">
                {step.title}
              </span>
              <span className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                {step.body}
              </span>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={onStart}
        className="rounded-full bg-amber-500 px-10 py-4 text-lg font-semibold text-white shadow-lg transition-colors hover:bg-amber-600"
      >
        {labels.guest.startButton}
      </button>
    </main>
  );
}
