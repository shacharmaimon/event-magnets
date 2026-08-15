-- ============================================================================
-- Store each frame's transparent OPENING (the hole the photo shows through),
-- as fractions (0..1) of the frame's width/height.
-- Apply in Supabase dashboard: SQL Editor -> paste -> Run.
--
-- Used to place the whole photo INSIDE the frame's opening (nothing cropped)
-- instead of covering the magnet and laying the frame on top. Detected once
-- from the frame's alpha channel: at upload for new frames, and lazily on first
-- read for existing frames (see src/lib/frames.ts). NULL = not yet detected;
-- the compositor falls back to the legacy cover behavior until it's filled.
-- ============================================================================

alter table public.frames
  add column if not exists window_x real,
  add column if not exists window_y real,
  add column if not exists window_w real,
  add column if not exists window_h real;
