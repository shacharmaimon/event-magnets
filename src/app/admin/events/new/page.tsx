"use client";

import Link from "next/link";
import RequireAuth from "@/components/admin/RequireAuth";
import AdminHeader from "@/components/admin/AdminHeader";
import EventForm from "@/components/admin/EventForm";
import { labels } from "@/lib/labels";

export default function NewEventPage() {
  return (
    <RequireAuth>
      {(email) => (
        <main className="min-h-screen bg-zinc-50 dark:bg-black">
          <AdminHeader email={email} />

          <div className="mx-auto max-w-2xl p-6">
            <Link
              href="/admin"
              className="mb-4 inline-block text-sm text-zinc-500 hover:text-amber-600"
            >
              ← {labels.adminEvents.back}
            </Link>
            <h2 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-white">
              {labels.adminEvents.createTitle}
            </h2>
            <EventForm mode="create" />
          </div>
        </main>
      )}
    </RequireAuth>
  );
}
