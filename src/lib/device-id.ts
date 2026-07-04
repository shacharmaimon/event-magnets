"use client";

// An anonymous, per-browser id used to count photos per device (no login).
// Stored in localStorage; clearing browser data resets it (acceptable for v1).
const KEY = "em_device_id";

export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}
