-- Prismatic — Message Usage Stats Table
-- Run this once against your Neon PostgreSQL database.

-- Table: prismatic_message_stats
-- Tracks daily message counts per user for admin monitoring and rate limiting.

CREATE TABLE IF NOT EXISTS prismatic_message_stats (
  id            BIGSERIAL PRIMARY KEY,
  user_id       TEXT        NOT NULL,
  date          DATE        NOT NULL,
  message_count INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One row per user per date
  CONSTRAINT prismatic_message_stats_pk
    UNIQUE (user_id, date)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS prismatic_message_stats_user_date_idx
  ON prismatic_message_stats (user_id, date DESC);

CREATE INDEX IF NOT EXISTS prismatic_message_stats_date_idx
  ON prismatic_message_stats (date DESC);

CREATE INDEX IF NOT EXISTS prismatic_message_stats_user_idx
  ON prismatic_message_stats (user_id);

-- Keep updated_at current
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prismatic_message_stats_updated_at ON prismatic_message_stats;
CREATE TRIGGER trg_prismatic_message_stats_updated_at
  BEFORE UPDATE ON prismatic_message_stats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Add foreign key (optional, only if you have ON DELETE CASCADE needs)
-- ALTER TABLE prismatic_message_stats
--   ADD CONSTRAINT prismatic_message_stats_user_fk
--   FOREIGN KEY (user_id) REFERENCES prismatic_users(id) ON DELETE CASCADE;
