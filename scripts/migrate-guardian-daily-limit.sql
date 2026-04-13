-- Prismatic — Guardian Daily Interaction Limit
-- Add daily interaction limits to the guardian system

-- Add max_interactions column to guardian_schedule (limits per guardian per day)
ALTER TABLE prismatic_guardian_schedule
  ADD COLUMN IF NOT EXISTS max_interactions INTEGER NOT NULL DEFAULT 20;

-- Add current interactions counter to guardian_stats
ALTER TABLE prismatic_guardian_stats
  ADD COLUMN IF NOT EXISTS interactions INTEGER NOT NULL DEFAULT 0;

-- Update existing stats with default 0 for interactions
UPDATE prismatic_guardian_stats
  SET interactions = COALESCE(interactions, 0)
  WHERE interactions IS NULL;
