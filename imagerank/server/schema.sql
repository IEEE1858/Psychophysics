-- SQLite schema for the imagerank psychophysics study.
-- Loosely based on webapp/schema.sql (PostgreSQL), adapted to imagerank's model:
-- participants do not give a 1-5 rating; instead they pick the *processing level*
-- they judge highest quality and most realistic for each image.

PRAGMA foreign_keys = ON;

-- One row per participant, capturing the demographics questionnaire.
CREATE TABLE IF NOT EXISTS participants (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  age                INTEGER,
  gender             TEXT,
  email              TEXT,
  self_description   TEXT,
  vision_status      TEXT,
  vision_details     TEXT,
  color_blind        TEXT,
  country_of_origin  TEXT,
  display_type       TEXT,
  lighting           TEXT,
  time_budget_minutes INTEGER,                          -- how long the participant said they could spend
  user_agent         TEXT,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at       TEXT                              -- NULL until the study is finished (partial otherwise)
);

-- One row per image a participant graded.
CREATE TABLE IF NOT EXISTS image_rankings (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  participant_id          INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  collection_id           TEXT NOT NULL,                 -- 'hdr' | 'sharpness'
  image_id                TEXT NOT NULL,
  max_level               INTEGER NOT NULL,              -- highest processing level available
  furthest_visited_level  INTEGER NOT NULL,              -- how far into processing they browsed
  most_realistic_level    INTEGER,                       -- chosen level (nullable if skipped)
  highest_quality_level   INTEGER,                       -- chosen level (nullable if skipped)
  grading_ms              INTEGER,                        -- time spent grading this image
  created_at              TEXT NOT NULL DEFAULT (datetime('now')),
  -- A participant grades each image at most once per collection.
  UNIQUE (participant_id, collection_id, image_id)
);

CREATE INDEX IF NOT EXISTS idx_rankings_participant ON image_rankings(participant_id);
CREATE INDEX IF NOT EXISTS idx_rankings_image ON image_rankings(collection_id, image_id);

-- Admin accounts for the /admin dashboard. Passwords are stored as a salted
-- scrypt hash ("<saltHex>:<hashHex>"), never in plaintext.
CREATE TABLE IF NOT EXISTS admin_users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
