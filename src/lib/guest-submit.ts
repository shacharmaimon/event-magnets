"use client";

import type { Orientation } from "@/lib/types";

// Submits a guest's chosen photo + frame. Public (no auth token — guests aren't
// logged in). Sends multipart/form-data, matching the admin frames-upload
// convention. Phase 6 implements the server route; until then it returns 501.
export async function submitMagnet(args: {
  slug: string;
  photoFile: File;
  frameId: string;
  orientation: Orientation;
  deviceId: string;
}): Promise<{ ok: boolean; error?: string; url?: string | null }> {
  const fd = new FormData();
  fd.append("file", args.photoFile);
  fd.append("frameId", args.frameId);
  fd.append("orientation", args.orientation);
  fd.append("deviceId", args.deviceId);

  const res = await fetch(`/api/e/${args.slug}/submit`, {
    method: "POST",
    body: fd,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { ok: false, error: body.error ?? String(res.status) };
  }
  const body = await res.json().catch(() => ({}));
  return { ok: true, url: body.url ?? null };
}
