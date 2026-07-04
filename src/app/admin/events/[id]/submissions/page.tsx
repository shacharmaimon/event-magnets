"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import RequireAuth from "@/components/admin/RequireAuth";
import AdminHeader from "@/components/admin/AdminHeader";
import SubmissionsGallery from "@/components/admin/SubmissionsGallery";
import { apiFetch } from "@/lib/api-client";
import { labels } from "@/lib/labels";
import type { EventRecord } from "@/lib/types";

export default function SubmissionsPage() {
  const params = useParams();
  const id = params.id as string;
  const [event, setEvent] = useState<EventRecord | null>(null);

  useEffect(() => {
    apiFetch<EventRecord>(`/api/events/${id}`)
      .then(setEvent)
      .catch(() => {});
  }, [id]);

  return (
    <RequireAuth>
      {(email) => (
        <main className="min-h-screen bg-zinc-50 dark:bg-black">
          <AdminHeader email={email} />

          <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
            <Link
              href={`/admin/events/${id}`}
              className="text-sm text-zinc-500 hover:text-amber-600"
            >
              ← {labels.adminSubmissions.back}
            </Link>

            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
              {event?.name ?? labels.adminSubmissions.title}
            </h1>

            <SubmissionsGallery eventId={id} eventName={event?.name ?? ""} />
          </div>
        </main>
      )}
    </RequireAuth>
  );
}
