-- ============================================================================
-- Phase 2 — initial schema for Event Magnets
-- Tables: events, frames, submissions
--
-- Apply this in the Supabase dashboard: SQL Editor -> paste -> Run.
-- (Kept in the repo so the schema is version-controlled and repeatable.)
-- ============================================================================

-- Needed for gen_random_uuid() (usually already enabled on Supabase).
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- events: one row per event you create in the admin.
-- ----------------------------------------------------------------------------
create table if not exists public.events (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  welcome_heading     text not null default '',
  welcome_subheading  text not null default '',
  is_open             boolean not null default false,
  photos_per_device   integer not null default 1 check (photos_per_device >= 1),
  -- short, unguessable code used in the guest URL/QR (e.g. /e/ab12cd34)
  public_slug         text not null unique,
  created_at          timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- frames: decorative PNG overlays, belonging to an event.
-- orientation is derived from the uploaded image's dimensions.
-- ----------------------------------------------------------------------------
create table if not exists public.frames (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events(id) on delete cascade,
  storage_path  text not null,                 -- path in the storage bucket
  orientation   text not null check (orientation in ('portrait', 'landscape')),
  display_order integer not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists frames_event_id_idx on public.frames(event_id);

-- ----------------------------------------------------------------------------
-- submissions: one row per photo a guest submits.
-- ----------------------------------------------------------------------------
create table if not exists public.submissions (
  id                   uuid primary key default gen_random_uuid(),
  event_id             uuid not null references public.events(id) on delete cascade,
  frame_id             uuid references public.frames(id) on delete set null,
  device_id            text not null,           -- anonymous per-browser id
  raw_storage_path     text,                    -- original photo (no frame)
  finished_storage_path text,                   -- composited, print-ready photo
  orientation          text check (orientation in ('portrait', 'landscape')),
  created_at           timestamptz not null default now()
);

create index if not exists submissions_event_id_idx on public.submissions(event_id);
create index if not exists submissions_device_idx on public.submissions(event_id, device_id);

-- ----------------------------------------------------------------------------
-- Row Level Security: enabled on all tables (locked by default).
-- We add NO public policies — all access goes through the server using the
-- secret key, which bypasses RLS. This keeps the data private by default.
-- ----------------------------------------------------------------------------
alter table public.events      enable row level security;
alter table public.frames      enable row level security;
alter table public.submissions enable row level security;
