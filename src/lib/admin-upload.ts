"use client";

import { supabaseBrowser } from "@/lib/supabase-browser";
import type { Orientation } from "@/lib/types";

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabaseBrowser.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Upload ONE original photo (unframed, ~3000px) to the event's originals album.
// Returns the created original's id so the magnet step can reference it.
export async function uploadOriginal(args: {
  eventId: string;
  file: File;
  orientation: Orientation;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const fd = new FormData();
  fd.append("file", args.file);
  fd.append("orientation", args.orientation);

  const res = await fetch(`/api/events/${args.eventId}/originals`, {
    method: "POST",
    headers: await authHeader(),
    body: fd,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { ok: false, error: body.error ?? String(res.status) };
  }
  const body = await res.json().catch(() => ({}));
  return { ok: true, id: body.id };
}

// Mark the originals album complete (host link goes live; starts expiry clock).
export async function publishOriginals(
  eventId: string,
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/events/${eventId}/originals/publish`, {
    method: "POST",
    headers: await authHeader(),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { ok: false, error: body.error ?? String(res.status) };
  }
  return { ok: true };
}

// Commit a magnet BY REFERENCE to an already-uploaded original (no image bytes).
// The server composites from the stored original. Returns 409 "original_not_ready"
// if that upload hasn't landed yet — the caller can retry.
export async function commitMagnet(args: {
  eventId: string;
  originalId: string;
  frameId: string;
  orientation: Orientation;
  copies: number;
}): Promise<{ ok: boolean; created?: number; error?: string }> {
  const res = await fetch(`/api/events/${args.eventId}/submissions/upload`, {
    method: "POST",
    headers: { ...(await authHeader()), "Content-Type": "application/json" },
    body: JSON.stringify({
      originalId: args.originalId,
      frameId: args.frameId,
      orientation: args.orientation,
      copies: args.copies,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { ok: false, error: body.error ?? String(res.status) };
  }
  const body = await res.json().catch(() => ({}));
  return { ok: true, created: body.created ?? args.copies };
}
