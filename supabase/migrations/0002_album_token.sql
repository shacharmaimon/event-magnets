-- ============================================================================
-- Phase 8 — album_token for shareable, read-only host albums.
-- Apply in Supabase dashboard: SQL Editor -> paste -> Run.
--
-- album_token is a LONG, unguessable secret used in the album URL
-- (/album/<album_token>). It is deliberately SEPARATE from public_slug — the
-- short, guessable guest-submit code — so guessing the guest link never grants
-- access to the full album.
-- ============================================================================

create extension if not exists "pgcrypto";

-- 1. Add the column with a secure default so NEW rows auto-generate a token.
--    16 random bytes -> 32 hex chars -> 128 bits of entropy.
alter table public.events
  add column if not exists album_token text
  default encode(gen_random_bytes(16), 'hex');

-- 2. Backfill existing rows (safety net).
update public.events
  set album_token = encode(gen_random_bytes(16), 'hex')
  where album_token is null;

-- 3. Lock it down: required + unique.
alter table public.events
  alter column album_token set not null;

create unique index if not exists events_album_token_idx
  on public.events(album_token);
