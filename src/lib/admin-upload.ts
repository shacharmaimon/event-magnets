"use client";

import { supabaseBrowser } from "@/lib/supabase-browser";
import type { Orientation } from "@/lib/types";

// Uploads ONE admin photo (already shrunk + oriented on the client) to an event.
// Multipart, behind admin Bearer auth. The caller uploads a whole batch by
// invoking this per photo (with a small concurrency pool + progress bar).
export async function uploadOnePhoto(args: {
  eventId: string;
  file: File;
  frameId: string;
  orientation: Orientation;
  copies: number;
}): Promise<{ ok: boolean; created?: number; error?: string }> {
  const { data } = await supabaseBrowser.auth.getSession();
  const token = data.session?.access_token;

  const fd = new FormData();
  fd.append("file", args.file);
  fd.append("frameId", args.frameId);
  fd.append("orientation", args.orientation);
  fd.append("copies", String(args.copies));

  const res = await fetch(`/api/events/${args.eventId}/submissions/upload`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { ok: false, error: body.error ?? String(res.status) };
  }
  const body = await res.json().catch(() => ({}));
  return { ok: true, created: body.created ?? args.copies };
}
