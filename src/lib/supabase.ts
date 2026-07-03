import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Supabase connection.
//
// Two clients, two purposes:
//
// 1. supabaseAdmin — uses the SECRET service_role key. It bypasses Row Level
//    Security, so it can read/write anything. It must ONLY ever run on the
//    server (API routes, server components/actions) — never shipped to the
//    browser. All our real data access goes through here.
//
// 2. createPublicClient() — uses the public anon key. Safe to use anywhere,
//    but subject to RLS locks. We use it mainly for auth (login) flows.
//
// Keys come from environment variables (.env.local locally, Vercel env vars in
// production). The service_role key has NO "NEXT_PUBLIC_" prefix on purpose —
// that prefix is what would expose it to the browser, which we must avoid.
// ---------------------------------------------------------------------------

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey) {
  throw new Error(
    "Missing Supabase env vars. Add NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local (see .env.local.example).",
  );
}

/**
 * Server-only admin client. Full access — keep it on the server.
 * Throws if used without the secret key configured.
 */
export function createAdminClient() {
  if (!serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY. This client is server-only.",
    );
  }
  return createClient(supabaseUrl!, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Public client (anon key). Safe anywhere; limited by RLS. */
export function createPublicClient() {
  return createClient(supabaseUrl!, anonKey!);
}
