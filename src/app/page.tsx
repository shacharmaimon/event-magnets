import { labels } from "@/lib/labels";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-white to-zinc-100 px-6 text-center dark:from-zinc-950 dark:to-black">
      <div className="flex flex-col items-center gap-6">
        <span className="rounded-full border border-amber-300/60 bg-amber-50 px-4 py-1 text-sm font-medium text-amber-700 dark:border-amber-400/30 dark:bg-amber-950/40 dark:text-amber-300">
          {labels.home.badge}
        </span>

        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-6xl dark:text-white">
          {labels.home.heading}
        </h1>

        <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          {labels.home.subheading}
        </p>
      </div>
    </main>
  );
}
