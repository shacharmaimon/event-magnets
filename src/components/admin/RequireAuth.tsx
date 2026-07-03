"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { labels } from "@/lib/labels";

// Wraps any admin page. Checks for a logged-in session; if none, redirects to
// the login page. While checking, shows a small loading message. Children only
// render once we know the user is authenticated.
export default function RequireAuth({
  children,
}: {
  children: (email: string) => React.ReactNode;
}) {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabaseBrowser.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/admin/login");
        return;
      }
      setEmail(data.session.user.email ?? "");
      setChecking(false);
    });
  }, [router]);

  if (checking || email === null) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-zinc-500">{labels.admin.loading}</p>
      </main>
    );
  }

  return <>{children(email)}</>;
}
