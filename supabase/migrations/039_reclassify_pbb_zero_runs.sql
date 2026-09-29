-- PickleballBrackets was blocked (HTTP 403) from 2026-08-28 and every run that
-- found 0 tournaments was saved as `success`. The scraper's suspicious-zero
-- check uses a source's last 10 `success` runs as its baseline. Left alone,
-- that baseline is all zeros, so the check would treat PBB's outage as normal
-- and never alert. Relabel those runs so the baseline goes back to the last
-- healthy runs from before the outage.
--
-- Only touches PBB zero-result runs since the outage began. Safe to re-run.
update public.scraper_runs
set status = 'suspicious_zero'
where source_platform = 'pickleballbrackets'
  and status = 'success'
  and tournaments_found = 0
  and started_at >= '2026-08-28';
