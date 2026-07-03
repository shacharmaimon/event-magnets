"use client";

import Link from "next/link";
import RequireAuth from "@/components/admin/RequireAuth";
import AdminHeader from "@/components/admin/AdminHeader";
import EventList from "@/components/admin/EventList";
import { labels } from "@/lib/labels";

export default function AdminDashboardPage() {
  return (
    <RequireAuth>
      {(email) => (
        <main className="min-h-screen bg-zinc-50 dark:bg-black">
          <AdminHeader email={email} />

          <div className="mx-auto max-w-3xl p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">
                {labels.adminEvents.pageTitle}
              </h2>
              <Link
                href="/admin/events/new"
                className="rounded-lg bg-amber-500 px-4 py-2 font-semibold text-white transition-colors hover:bg-amber-600"
              >
                {labels.adminEvents.newEvent}
              </Link>
            </div>

            <EventList />
          </div>
        </main>
      )}
    </RequireAuth>
  );
}
