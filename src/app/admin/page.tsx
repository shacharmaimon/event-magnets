"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { labels } from "@/lib/labels";

export default function AdminDashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  // On load, check whether there's a logged-in session. If not, redirect to login.
  useEffect(() => {
    supabaseBrowser.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/admin/login");
        return;
      }
      setEmail(data.session.user.email ?? null);
      setChecking(false);
    });
  }, [router]);

  async function handleLogout() {
    await supabaseBrowser.auth.signOut();
    router.replace("/admin/login");
    router.refresh();
  }

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-zinc-500">{labels.admin.loading}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-black">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-xl font-bold text-zinc-900 dark:text-white">
          {labels.admin.dashboardTitle}
        </h1>
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

      <div className="p-6">
        <p className="text-zinc-600 dark:text-zinc-400">
          {/* Placeholder — events management arrives in Phase 3. */}
          🎉
        </p>
      </div>
    </main>
  );
}
