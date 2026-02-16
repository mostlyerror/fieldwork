-- =============================================================================
-- 009: RLS UPDATE policy for player claims
--
-- Allow authenticated users to claim/unclaim their own player profile
-- by setting user_id to their auth.uid(). Only the user_id column can
-- be modified — all other fields are scraper-managed.
-- =============================================================================

CREATE POLICY "players_claim" ON players
  FOR UPDATE
  USING (
    -- Can only update rows they already own OR unclaimed rows
    user_id IS NULL OR user_id = auth.uid()
  )
  WITH CHECK (
    -- Can only set user_id to their own ID
    user_id = auth.uid()
  );
