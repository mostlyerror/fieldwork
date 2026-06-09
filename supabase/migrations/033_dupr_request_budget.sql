-- Global daily DUPR request budget (docs/dupr-metered-layer.md §2.2).
--
-- Every job (cron or manual) paces itself, but nothing saw the others — the
-- "don't get cut off" ceiling needs to be global. One counter row per UTC day;
-- the scraper client calls take_dupr_budget(1) before each DUPR request and
-- stops gracefully when the day's total passes DUPR_DAILY_CEILING (env,
-- default 1500). The table doubles as a requests/day history for /admin.

CREATE TABLE IF NOT EXISTS dupr_request_log (
  day date PRIMARY KEY,
  requests int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Service-role-only table (scrapers). RLS on with no policies = no anon access.
ALTER TABLE dupr_request_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION take_dupr_budget(n int)
RETURNS int
LANGUAGE sql
AS $$
  INSERT INTO dupr_request_log AS l (day, requests)
  VALUES (current_date, n)
  ON CONFLICT (day) DO UPDATE
    SET requests = l.requests + EXCLUDED.requests,
        updated_at = now()
  RETURNING requests;
$$;
