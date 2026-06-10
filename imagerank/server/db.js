const fs = require("node:fs");
const path = require("node:path");
const { scryptSync, randomBytes, timingSafeEqual } = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

// DB lives next to the server by default; override with DB_PATH in production
// (e.g. a path under the deploy dir on atlas).
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "data", "psychophysics.db");
const SCHEMA_PATH = path.join(__dirname, "schema.sql");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");
db.exec(fs.readFileSync(SCHEMA_PATH, "utf8"));

// Migration for databases created before completed_at existed. ALTER TABLE
// throws if the column is already present, which is the no-op we want.
try {
  db.exec("ALTER TABLE participants ADD COLUMN completed_at TEXT");
} catch {
  // column already exists
}

const insertParticipantStmt = db.prepare(`
  INSERT INTO participants (
    age, gender, email, self_description, vision_status, vision_details,
    color_blind, country_of_origin, display_type, lighting, user_agent
  ) VALUES (
    :age, :gender, :email, :selfDescription, :visionStatus, :visionDetails,
    :colorBlind, :countryOfOrigin, :displayType, :lighting, :userAgent
  )
`);

// Upsert so a participant re-submitting the same image overwrites the prior row
// (e.g. if they navigate back and change a selection).
const upsertRankingStmt = db.prepare(`
  INSERT INTO image_rankings (
    participant_id, collection_id, image_id, max_level, furthest_visited_level,
    most_realistic_level, highest_quality_level, grading_ms
  ) VALUES (
    :participantId, :collectionId, :imageId, :maxLevel, :furthestVisitedLevel,
    :mostRealisticLevel, :highestQualityLevel, :gradingMs
  )
  ON CONFLICT (participant_id, collection_id, image_id) DO UPDATE SET
    max_level = excluded.max_level,
    furthest_visited_level = excluded.furthest_visited_level,
    most_realistic_level = excluded.most_realistic_level,
    highest_quality_level = excluded.highest_quality_level,
    grading_ms = excluded.grading_ms,
    created_at = datetime('now')
`);

const participantExistsStmt = db.prepare("SELECT id FROM participants WHERE id = ?");

function createParticipant(demographics, userAgent) {
  const result = insertParticipantStmt.run({
    age: demographics.age != null && demographics.age !== "" ? Number(demographics.age) : null,
    gender: demographics.gender ?? null,
    email: demographics.email ?? null,
    selfDescription: demographics.selfDescription ?? null,
    visionStatus: demographics.visionStatus ?? null,
    visionDetails: demographics.visionDetails ?? null,
    colorBlind: demographics.colorBlind ?? null,
    countryOfOrigin: demographics.countryOfOrigin ?? null,
    displayType: demographics.displayType ?? null,
    lighting: demographics.lighting ?? null,
    userAgent: userAgent ?? null,
  });

  return Number(result.lastInsertRowid);
}

function participantExists(participantId) {
  return Boolean(participantExistsStmt.get(participantId));
}

const updateParticipantStmt = db.prepare(`
  UPDATE participants SET
    age = :age, gender = :gender, email = :email, self_description = :selfDescription,
    vision_status = :visionStatus, vision_details = :visionDetails, color_blind = :colorBlind,
    country_of_origin = :countryOfOrigin, display_type = :displayType, lighting = :lighting
  WHERE id = :id
`);

// Update an existing participant's demographics (the "edit demographics" flow).
function updateParticipant(participantId, demographics) {
  updateParticipantStmt.run({
    id: Number(participantId),
    age: demographics.age != null && demographics.age !== "" ? Number(demographics.age) : null,
    gender: demographics.gender ?? null,
    email: demographics.email ?? null,
    selfDescription: demographics.selfDescription ?? null,
    visionStatus: demographics.visionStatus ?? null,
    visionDetails: demographics.visionDetails ?? null,
    colorBlind: demographics.colorBlind ?? null,
    countryOfOrigin: demographics.countryOfOrigin ?? null,
    displayType: demographics.displayType ?? null,
    lighting: demographics.lighting ?? null,
  });
}

// Mark a participant as having completed the study. Until this is set the row
// represents a partial submission.
function markParticipantComplete(participantId) {
  db.prepare("UPDATE participants SET completed_at = datetime('now') WHERE id = ?").run(
    Number(participantId)
  );
}

function recordRanking(ranking) {
  upsertRankingStmt.run({
    participantId: Number(ranking.participantId),
    collectionId: String(ranking.collectionId),
    imageId: String(ranking.imageId),
    maxLevel: Number(ranking.maxLevel),
    furthestVisitedLevel: Number(ranking.furthestVisitedLevel),
    mostRealisticLevel: ranking.mostRealisticLevel == null ? null : Number(ranking.mostRealisticLevel),
    highestQualityLevel: ranking.highestQualityLevel == null ? null : Number(ranking.highestQualityLevel),
    gradingMs: ranking.gradingMs == null ? null : Number(ranking.gradingMs),
  });
}

function getParticipantWithRankings(participantId) {
  const participant = db.prepare("SELECT * FROM participants WHERE id = ?").get(participantId);
  if (!participant) {
    return null;
  }

  const rankings = db
    .prepare("SELECT * FROM image_rankings WHERE participant_id = ? ORDER BY id")
    .all(participantId);

  return { participant, rankings };
}

function exportAll() {
  return {
    participants: db.prepare("SELECT * FROM participants ORDER BY id").all(),
    rankings: db.prepare("SELECT * FROM image_rankings ORDER BY id").all(),
  };
}

// One denormalized row per ranking, with the participant's demographics joined
// in — the convenient shape for analysis / CSV export.
function exportRankingsFlat() {
  return db
    .prepare(
      `SELECT
         r.id                AS ranking_id,
         p.id                AS participant_id,
         p.age, p.gender, p.email, p.self_description, p.vision_status,
         p.vision_details, p.color_blind, p.country_of_origin, p.display_type,
         p.lighting,
         r.collection_id, r.image_id, r.max_level, r.furthest_visited_level,
         r.most_realistic_level, r.highest_quality_level, r.grading_ms,
         r.created_at        AS ranked_at,
         p.created_at        AS participant_created_at,
         p.user_agent
       FROM image_rankings r
       JOIN participants p ON p.id = r.participant_id
       ORDER BY r.id`
    )
    .all();
}

// --- Admin auth -----------------------------------------------------------

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hashHex] = String(stored).split(":");
  if (!salt || !hashHex) {
    return false;
  }
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function adminUserExists(username) {
  return Boolean(db.prepare("SELECT id FROM admin_users WHERE username = ?").get(username));
}

function createAdminUser(username, password) {
  db.prepare("INSERT INTO admin_users (username, password_hash) VALUES (?, ?)").run(
    username,
    hashPassword(password)
  );
}

// Idempotently create an admin account (no-op if the username already exists).
function ensureAdminUser(username, password) {
  if (!adminUserExists(username)) {
    createAdminUser(username, password);
  }
}

function listAdminUsers() {
  return db.prepare("SELECT id, username, created_at FROM admin_users ORDER BY username").all();
}

function verifyAdmin(username, password) {
  if (!username || !password) {
    return false;
  }
  const row = db.prepare("SELECT password_hash FROM admin_users WHERE username = ?").get(username);
  if (!row) {
    return false;
  }
  return verifyPassword(password, row.password_hash);
}

// Seed an admin account from env vars on startup (no credentials in source).
// Set ADMIN_SEED_USERNAME and ADMIN_SEED_PASSWORD (e.g. via server/.env in dev,
// or the process environment in production). Idempotent — safe to leave set.
if (process.env.ADMIN_SEED_USERNAME && process.env.ADMIN_SEED_PASSWORD) {
  ensureAdminUser(process.env.ADMIN_SEED_USERNAME, process.env.ADMIN_SEED_PASSWORD);
}

// --- Admin reporting --------------------------------------------------------

// One row per participant with the aggregates the admin dashboard needs.
// AVG(...) ignores NULLs, so unanswered selections don't skew the averages.
function listSubmissions() {
  return db
    .prepare(
      `SELECT
         p.id,
         p.email,
         p.created_at AS started_at,
         p.completed_at,
         COALESCE(SUM(r.grading_ms), 0) AS total_test_time_ms,
         SUM(CASE WHEN r.collection_id = 'hdr' THEN 1 ELSE 0 END) AS hdr_count,
         SUM(CASE WHEN r.collection_id = 'sharpness' THEN 1 ELSE 0 END) AS sharpness_count,
         AVG(CASE WHEN r.collection_id = 'hdr' THEN r.highest_quality_level END) AS hdr_quality_avg,
         AVG(CASE WHEN r.collection_id = 'hdr' THEN r.most_realistic_level END) AS hdr_realism_avg,
         AVG(CASE WHEN r.collection_id = 'sharpness' THEN r.highest_quality_level END) AS sharpness_quality_avg,
         AVG(CASE WHEN r.collection_id = 'sharpness' THEN r.most_realistic_level END) AS sharpness_realism_avg
       FROM participants p
       LEFT JOIN image_rankings r ON r.participant_id = p.id
       GROUP BY p.id
       ORDER BY p.created_at DESC, p.id DESC`
    )
    .all();
}

function getSubmissionDetail(participantId) {
  const participant = db.prepare("SELECT * FROM participants WHERE id = ?").get(participantId);
  if (!participant) {
    return null;
  }
  const rankings = db
    .prepare(
      "SELECT * FROM image_rankings WHERE participant_id = ? ORDER BY collection_id, image_id"
    )
    .all(participantId);
  return { participant, rankings };
}

module.exports = {
  db,
  DB_PATH,
  verifyAdmin,
  adminUserExists,
  createAdminUser,
  listAdminUsers,
  listSubmissions,
  getSubmissionDetail,
  createParticipant,
  updateParticipant,
  markParticipantComplete,
  participantExists,
  recordRanking,
  getParticipantWithRankings,
  exportAll,
  exportRankingsFlat,
};
