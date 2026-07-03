"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import RequireAuth from "@/components/admin/RequireAuth";
import AdminHeader from "@/components/admin/AdminHeader";
import EventForm from "@/components/admin/EventForm";
import GuestLinkCard from "@/components/admin/GuestLinkCard";
import { apiFetch } from "@/lib/api-client";
import { labels } from "@/lib/labels";
import type { EventRecord } from "@/lib/types";

export default function ManageEventPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [event, setEvent] = useState<EventRecord | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiFetch<EventRecord>(`/api/events/${id}`)
      .then(setEvent)
      .catch(() => setError(labels.adminEvents.loadError));
  }, [id]);

  async function toggleOpen() {
    if (!event) return;
    setBusy(true);
    try {
      const updated = await apiFetch<EventRecord>(`/api/events/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_open: !event.is_open }),
      });
      setEvent(updated);
    } catch {
      setError(labels.adminEvents.saveError);
    }
    setBusy(false);
  }

  async function handleDelete() {
    if (!confirm(labels.adminEvents.confirmDelete)) return;
    setBusy(true);
    try {
      await apiFetch(`/api/events/${id}`, { method: "DELETE" });
      router.push("/admin");
    } catch {
      setError(labels.adminEvents.saveError);
      setBusy(false);
    }
  }

  return (
    <RequireAuth>
      {(email) => (
        <main className="min-h-screen bg-zinc-50 dark:bg-black">
          <AdminHeader email={email} />

          <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
            <Link
              href="/admin"
              className="text-sm text-zinc-500 hover:text-amber-600"
            >
              ← {labels.adminEvents.back}
            </Link>

            {error && (
              <p className="text-red-600 dark:text-red-400">{error}</p>
            )}

            {!event ? (
              <p className="text-zinc-500">{labels.admin.loading}</p>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">
                  {event.name}
                </h2>

                {/* Open / closed status + toggle */}
                <section className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-zinc-500">
                      {labels.adminEvents.statusLabel}:
                    </span>
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
                  </div>
                  <button
                    onClick={toggleOpen}
                    disabled={busy}
                    className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
                  >
                    {event.is_open
                      ? labels.adminEvents.toggleToClosed
                      : labels.adminEvents.toggleToOpen}
                  </button>
                </section>

                {/* Guest link + QR */}
                <GuestLinkCard slug={event.public_slug} />

                {/* Edit form */}
                <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                  <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">
                    {labels.adminEvents.editTitle}
                  </h3>
                  <EventForm mode="edit" event={event} onSaved={setEvent} />
                </section>

                {/* Delete */}
                <button
                  onClick={handleDelete}
                  disabled={busy}
                  className="self-start rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                >
                  {labels.adminEvents.delete}
                </button>
              </>
            )}
          </div>
        </main>
      )}
    </RequireAuth>
  );
}
