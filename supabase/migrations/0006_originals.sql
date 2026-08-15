-- ============================================================================
-- Originals album for the admin computer-upload flow.
-- Apply in Supabase dashboard: SQL Editor -> paste -> Run.
--
-- When Shachar bulk-uploads camera photos, ALL of them are stored (unframed,
-- ~3000px) as an event's "originals album" for the host to view/download for a
-- limited time — separate from the framed magnets. A subset become magnets.
--
-- original_photos: one row per uploaded original (stored under
--   submissions bucket, path prefix originals/{event_id}/...).
-- events.originals_published_at: set when the whole batch finishes uploading;
--   also the 30-day expiry clock. NULL = no active originals album (album link
--   falls back to the finished-magnets view — keeps guest events unchanged).
-- ============================================================================

create table if not exists public.original_photos (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events(id) on delete cascade,
  storage_path  text not null,
  orientation   text check (orientation in ('portrait', 'landscape')),
  created_at    timestamptz not null default now()
);

create index if not exists original_photos_event_id_idx
  on public.original_photos(event_id);

alter table public.original_photos enable row level security;

alter table public.events
  add column if not exists originals_published_at timestamptz;

create index if not exists events_originals_published_idx
  on public.events(originals_published_at);
