"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { labels } from "@/lib/labels";
import type { EventRecord } from "@/lib/types";

const inputClass =
  "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white";

interface Props {
  mode: "create" | "edit";
  event?: EventRecord; // required in edit mode
  onSaved?: (event: EventRecord) => void; // edit mode: refresh in place
}

// Shared form for creating and editing an event. In create mode it POSTs and
// redirects to the new event's manage page; in edit mode it PATCHes and calls
// onSaved with the updated record.
export default function EventForm({ mode, event, onSaved }: Props) {
  const router = useRouter();
  const [name, setName] = useState(event?.name ?? "");
  const [heading, setHeading] = useState(event?.welcome_heading ?? "");
  const [subheading, setSubheading] = useState(
    event?.welcome_subheading ?? "",
  );
  const [photosPerDevice, setPhotosPerDevice] = useState(
    event?.photos_per_device ?? 1,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    setSaving(true);

    const payload = {
      name,
      welcome_heading: heading,
      welcome_subheading: subheading,
      photos_per_device: photosPerDevice,
    };

    try {
      if (mode === "create") {
        const created = await apiFetch<EventRecord>("/api/events", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        router.push(`/admin/events/${created.id}`);
        return; // navigating away — leave the button disabled
      } else if (event) {
        const updated = await apiFetch<EventRecord>(
          `/api/events/${event.id}`,
          { method: "PATCH", body: JSON.stringify(payload) },
        );
        onSaved?.(updated);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000); // auto-clear the confirmation
      }
    } catch {
      setError(labels.adminEvents.saveError);
    } finally {
      setSaving(false);
    }
  }

  const busyLabel =
    mode === "create" ? labels.adminEvents.creating : labels.adminEvents.saving;
  const actionLabel =
    mode === "create" ? labels.adminEvents.create : labels.adminEvents.save;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {labels.adminEvents.nameLabel}
        </span>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {labels.adminEvents.welcomeHeadingLabel}
        </span>
        <input
          value={heading}
          onChange={(e) => setHeading(e.target.value)}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {labels.adminEvents.welcomeSubheadingLabel}
        </span>
        <input
          value={subheading}
          onChange={(e) => setSubheading(e.target.value)}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {labels.adminEvents.photosPerDeviceLabel}
        </span>
        <input
          type="number"
          min={1}
          value={photosPerDevice}
          onChange={(e) => setPhotosPerDevice(Number(e.target.value))}
          className={`${inputClass} w-24`}
          dir="ltr"
        />
      </label>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="mt-2 flex items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="self-start rounded-lg bg-amber-500 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
        >
          {saving ? busyLabel : actionLabel}
        </button>
        {saved && (
          <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
            {labels.adminEvents.saved}
          </span>
        )}
      </div>
    </form>
  );
}
