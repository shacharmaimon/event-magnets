-- ============================================================================
-- Track print-sheet downloads separately from individual downloads.
-- Apply in Supabase dashboard: SQL Editor -> paste -> Run.
--
-- The admin has two independent "download new" flows:
--   downloaded_at -> set when downloading NEW individual magnets (existing).
--   printed_at    -> set when downloading NEW 2-up print sheets (this migration).
-- Keeping them separate means using one flow does not zero the other's counter.
-- NULL = not yet consumed by that flow.
-- ============================================================================

alter table public.submissions
  add column if not exists printed_at timestamptz;

create index if not exists submissions_printed_idx
  on public.submissions(event_id, printed_at);
