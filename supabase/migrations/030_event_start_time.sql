-- Per-bracket start times. PickleballBrackets' tourneyEvents API exposes a
-- per-event date like "Jun 7 2026 8:30 AM" (and a multipleDates flag). Different
-- brackets in the same tournament start at different times, so store it per event.
-- start_time_raw keeps the exact source string (faithful display, no tz ambiguity);
-- start_time is the parsed America/Chicago instant for sorting / calendar export.
ALTER TABLE tournament_events
  ADD COLUMN IF NOT EXISTS start_time timestamptz,
  ADD COLUMN IF NOT EXISTS start_time_raw text;
