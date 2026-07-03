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
          <Link
            href={`/admin/events/${event.id}`}
            className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-amber-400 dark:border-zinc-800 dark:bg-zinc-900"
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
              {event.is_open ? labels.adminEvents.open : labels.adminEvents.closed}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
