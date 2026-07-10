-- SQLite schema for the imagerank psychophysics study.
-- Loosely based on webapp/schema.sql (PostgreSQL), adapted to imagerank's model:
-- participants do not give a 1-5 rating; instead they pick the *processing level*
-- they judge favorite and most realistic for each image.

PRAGMA foreign_keys = ON;

-- Optional participant accounts (issue #31). Sign-in is optional; anonymous
-- participation still works. An account is keyed to a unique email and can own
-- one or more participant rows, which is how a participant who took the study
-- anonymously and later creates an account with the same email has their prior
-- progress adopted. Passwords are stored as a salted scrypt hash, same format
-- as admin_users; google_sub is Google's stable per-user id for OAuth sign-in.
CREATE TABLE IF NOT EXISTS accounts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT,                                 -- NULL for Google-only accounts
  google_sub    TEXT UNIQUE,                          -- NULL for password-only accounts
  display_name  TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One row per participant, capturing the demographics questionnaire.
CREATE TABLE IF NOT EXISTS participants (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id         INTEGER REFERENCES accounts(id), -- NULL for anonymous participants (issue #31)
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
  favorite_level          INTEGER,                       -- chosen level (nullable if skipped)
  grading_ms              INTEGER,                        -- time spent grading this image (incl. any re-ranking)
  idle_ms                 INTEGER,                        -- portion of grading_ms the participant was inactive (issue #28)
  re_ranked               INTEGER NOT NULL DEFAULT 0,     -- 1 if revisited and revised from the /rankings page
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
