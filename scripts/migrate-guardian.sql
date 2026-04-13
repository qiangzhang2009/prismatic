-- Prismatic — Guardian Schedule & Persona Interaction System
-- Run once against your Neon PostgreSQL database.

-- ── Guardian Schedule ───────────────────────────────────────────────────────
-- Defines which personas are on duty each day (3 per day).
-- If a row doesn't exist for a date, the system auto-generates it.

CREATE TABLE IF NOT EXISTS prismatic_guardian_schedule (
  id              BIGSERIAL PRIMARY KEY,
  date            DATE        NOT NULL,
  slot            SMALLINT    NOT NULL CHECK (slot IN (1, 2, 3)),
  persona_id      TEXT        NOT NULL,
  shift_theme     TEXT,                        -- optional: today's special theme
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT prismatic_guardian_schedule_pk UNIQUE (date, slot)
);

CREATE INDEX IF NOT EXISTS prismatic_guardian_schedule_date_idx
  ON prismatic_guardian_schedule (date DESC);

-- ── Persona Interactions ────────────────────────────────────────────────────
-- Records each time a persona replies/interacts with a comment.
-- This powers the "reactions from wisdom" feature.

CREATE TABLE IF NOT EXISTS prismatic_persona_interactions (
  id              BIGSERIAL PRIMARY KEY,
  persona_id      TEXT        NOT NULL,
  comment_id      TEXT        NOT NULL,
  interaction_type TEXT      NOT NULL CHECK (interaction_type IN ('reply', 'reaction', 'quote', 'mention')),
  content         TEXT,                        -- the persona's reply/quote content
  emoji           TEXT,                        -- if it's an emoji reaction
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS prismatic_persona_interactions_persona_idx
  ON prismatic_persona_interactions (persona_id, created_at DESC);

CREATE INDEX IF NOT EXISTS prismatic_persona_interactions_comment_idx
  ON prismatic_persona_interactions (comment_id);

-- ── Guardian Shift Log ──────────────────────────────────────────────────────
-- Daily stats for each guardian shift

CREATE TABLE IF NOT EXISTS prismatic_guardian_stats (
  id              BIGSERIAL PRIMARY KEY,
  date            DATE        NOT NULL,
  persona_id      TEXT        NOT NULL,
  comments_reviewed INTEGER   NOT NULL DEFAULT 0,
  interactions      INTEGER   NOT NULL DEFAULT 0,  -- replies + reactions
  mentions_received INTEGER   NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT prismatic_guardian_stats_pk UNIQUE (date, persona_id)
);
