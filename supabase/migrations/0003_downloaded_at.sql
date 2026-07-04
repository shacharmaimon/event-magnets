-- ============================================================================
-- Track which submissions have been downloaded (for print-as-you-go workflow).
-- Apply in Supabase dashboard: SQL Editor -> paste -> Run.
--
-- downloaded_at is set when the admin downloads a photo via "download new".
-- NULL = not yet downloaded. Lets the admin grab only new photos mid-event.
-- ============================================================================

alter table public.submissions
  add column if not exists downloaded_at timestamptz;

create index if not exists submissions_downloaded_idx
  on public.submissions(event_id, downloaded_at);
