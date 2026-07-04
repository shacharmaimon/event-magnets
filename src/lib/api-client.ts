"use client";

import { supabaseBrowser } from "@/lib/supabase-browser";

// One place for all admin API calls from the browser. It grabs the current
// session's access token and attaches it as a Bearer header, so the server can
// verify who's calling (see src/lib/auth.ts). Throws on non-2xx responses.
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const { data } = await supabaseBrowser.auth.getSession();
  const token = data.session?.access_token;

  // For file uploads we send FormData — the browser must set its own
  // multipart Content-Type (with boundary), so we skip the JSON header then.
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;

  const res = await fetch(path, {
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? res.statusText);
  }
  return res.json();
}

// Like apiFetch but returns a Blob (for authed file/zip downloads). Attaches the
// same Bearer token so the download stays behind admin auth.
export async function apiFetchBlob(
  path: string,
  options: RequestInit = {},
): Promise<Blob> {
  const { data } = await supabaseBrowser.auth.getSession();
  const token = data.session?.access_token;

  const res = await fetch(path, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? res.statusText);
  }
  return res.blob();
}
