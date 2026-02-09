-- Rate limiting table for tournament submissions
CREATE TABLE IF NOT EXISTS submission_rate_limits (
  ip_address TEXT PRIMARY KEY,
  submission_count INT NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for cleanup queries
CREATE INDEX idx_submission_rate_limits_window
  ON submission_rate_limits (window_start);
