import { createClient } from "@supabase/supabase-js";

// Server-side auth check for API routes.
//
// Because our admin session lives in the browser (no @supabase/ssr cookie
// handling), the browser sends its access token in the "Authorization: Bearer"
// header on each API call. Here we verify that token with Supabase and return
// the user — or null if it's missing/invalid. Route handlers reject when null.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Verify the Bearer token on a request and return the logged-in user, or null.
 * (Optional future hardening: also require user.email === process.env.ADMIN_EMAIL.)
 */
export async function getUserFromRequest(request: Request) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length);

  // A throwaway anon client used only to validate the token.
  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}
