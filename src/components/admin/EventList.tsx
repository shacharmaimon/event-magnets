"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import { labels } from "@/lib/labels";
import type { EventRecord } from "@/lib/types";

// Fetches and displays all events as a vertical stack of cards.
export default function EventList() {
  const [events, setEvents] = useState<EventRecord[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<EventRecord[]>("/api/events")
      .then(setEvents)
      .catch(() => setError(labels.adminEvents.loadError));
  }, []);

  if (error) {
    return <p className="text-red-600 dark:text-red-400">{error}</p>;
  }
  if (events === null) {
    return <p className="text-zinc-500">{labels.admin.loading}</p>;
  }
  if (events.length === 0) {
    return <p className="text-zinc-500">{labels.adminEvents.noEvents}</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {events.map((event) => (
        <li key={event.id}>
          {/* Card is a flex row: the main body links to the manage page; a
              separate trailing button jumps straight to that event's photos +
              print page (avoids nesting a link inside a link). */}
          <div className="flex items-stretch gap-2 rounded-xl border border-zinc-200 bg-white transition-colors hover:border-amber-400 dark:border-zinc-800 dark:bg-zinc-900">
            <Link
              href={`/admin/events/${event.id}`}
              className="flex flex-1 items-center justify-between p-4"
            >
              <div className="flex flex-col gap-1">
                <span className="font-semibold text-zinc-900 dark:text-white">
                  {event.name}
                </span>
                <span className="text-xs text-zinc-400">
                  {labels.adminEvents.createdAt}{" "}
                  {new Date(event.created_at).toLocaleDateString("he-IL")}
                </span>
              </div>
              <span
                className={
                  event.is_open
                    ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                    : "rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                }
              >
                {event.is_open
                  ? labels.adminEvents.open
                  : labels.adminEvents.closed}
              </span>
            </Link>
            <Link
              href={`/admin/events/${event.id}/submissions`}
              className="flex items-center gap-1 border-s border-zinc-200 px-4 text-sm font-medium text-amber-600 transition-colors hover:bg-amber-50 dark:border-zinc-800 dark:hover:bg-amber-950/30"
              title={labels.adminEvents.prints}
            >
              {labels.adminEvents.prints}
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
