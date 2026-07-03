"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { labels } from "@/lib/labels";

// Shared admin top bar: a title (links back to the dashboard) + who's logged in
// + a logout button.
export default function AdminHeader({ email }: { email: string }) {
  const router = useRouter();

  async function handleLogout() {
    await supabaseBrowser.auth.signOut();
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
      <Link
        href="/admin"
        className="text-xl font-bold text-zinc-900 dark:text-white"
      >
        {labels.admin.dashboardTitle}
      </Link>
      <div className="flex items-center gap-4">
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          {labels.admin.welcomeBack}, {email}
        </span>
        <button
          onClick={handleLogout}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          {labels.admin.logout}
        </button>
      </div>
    </header>
  );
}
