-- ============================================================
-- KidQueue — Schedule the scrape-poco Edge Function to run daily
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- Requires: pg_cron extension (enabled by default on Supabase)
-- ============================================================

-- Enable pg_cron if not already enabled
create extension if not exists pg_cron;

-- Run the multi-city scraper every day at 6am Pacific (2pm UTC)
select cron.schedule(
  'kidqueue-scrape-sources',    -- job name
  '0 14 * * *',                 -- cron: daily at 14:00 UTC (6am Pacific)
  $$
  select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/scrape-sources',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- To check scheduled jobs:
-- select * from cron.job;

-- To unschedule old poco-only job:
-- select cron.unschedule('kidqueue-scrape-poco');

-- To unschedule new job:
-- select cron.unschedule('kidqueue-scrape-sources');
