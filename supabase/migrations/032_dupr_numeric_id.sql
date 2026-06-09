-- Cache DUPR's internal numeric player id.
--
-- Every match-history pull used to burn a /player/v1.0/search request just to
-- re-resolve the numeric id from the alphanumeric dupr_id — the numeric id
-- never changes. Resolve once, store here, and repeat pulls skip the search
-- (~1/3 of repeat-pull request volume against DUPR's API).

ALTER TABLE players ADD COLUMN IF NOT EXISTS dupr_numeric_id BIGINT;
