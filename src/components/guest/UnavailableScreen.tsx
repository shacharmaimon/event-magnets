import { labels } from "@/lib/labels";

// Shown when an event is missing or closed.
export default function UnavailableScreen() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gradient-to-b from-white to-zinc-100 px-6 text-center dark:from-zinc-950 dark:to-black">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
        {labels.guest.unavailableTitle}
      </h1>
      <p className="max-w-sm text-zinc-500 dark:text-zinc-400">
        {labels.guest.unavailableBody}
      </p>
    </main>
  );
}
