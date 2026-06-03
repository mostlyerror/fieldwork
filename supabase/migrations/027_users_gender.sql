-- Self-reported division gender, for bracket eligibility ("For you" Field
-- Intelligence). Nullable / optional. A male player is eligible for Men's +
-- Mixed + Open brackets; female for Women's + Mixed + Open.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS gender TEXT
  CHECK (gender IN ('male', 'female'));

COMMENT ON COLUMN users.gender IS
  'Self-reported division gender for bracket eligibility (male | female | null). Mixed/open brackets admit anyone.';
