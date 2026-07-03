"use client";

import { createClient } from "@supabase/supabase-js";

// Browser-side Supabase client, used for auth (login/logout) in the admin UI.
// Uses the publishable key (safe to expose). It persists the session in the
// browser so the admin stays logged in across page reloads.
//
// A single shared instance so the whole app reuses one session.
export const supabaseBrowser = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
