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

// Migration for databases created before the time-budget question existed.
try {
  db.exec("ALTER TABLE participants ADD COLUMN time_budget_minutes INTEGER");
} catch {
  // column already exists
}

// Migration for databases created before re-ranking (issue #23) existed.
try {
  db.exec("ALTER TABLE image_rankings ADD COLUMN re_ranked INTEGER NOT NULL DEFAULT 0");
} catch {
  // column already exists
}

// Migration for databases created before "highest quality" was renamed to
// "favorite" (issue #26). RENAME COLUMN preserves every existing value; on a
// fresh DB (where schema.sql already created favorite_level) and on a second
// boot after migrating, the column no longer exists and the ALTER throws,
// which is the no-op we want.
try {
  db.exec("ALTER TABLE image_rankings RENAME COLUMN highest_quality_level TO favorite_level");
} catch {
  // column already renamed (or never existed under the old name)
}

// Migration for databases created before optional participant accounts (issue
// #31). The accounts table is created by schema.sql above; this links existing
// participant rows to an account once they sign in.
try {
  db.exec("ALTER TABLE participants ADD COLUMN account_id INTEGER REFERENCES accounts(id)");
} catch {
  // column already exists
}

const insertParticipantStmt = db.prepare(`
  INSERT INTO participants (
    account_id, age, gender, email, self_description, vision_status, vision_details,
    color_blind, country_of_origin, display_type, lighting, time_budget_minutes,
    user_agent
  ) VALUES (
    :accountId, :age, :gender, :email, :selfDescription, :visionStatus, :visionDetails,
    :colorBlind, :countryOfOrigin, :displayType, :lighting, :timeBudgetMinutes,
    :userAgent
  )
`);

// Upsert so a participant re-submitting the same image overwrites the prior row
// (e.g. if they navigate back and change a selection).
const upsertRankingStmt = db.prepare(`
  INSERT INTO image_rankings (
    participant_id, collection_id, image_id, max_level, furthest_visited_level,
    most_realistic_level, favorite_level, grading_ms
  ) VALUES (
    :participantId, :collectionId, :imageId, :maxLevel, :furthestVisitedLevel,
    :mostRealisticLevel, :favoriteLevel, :gradingMs
  )
  ON CONFLICT (participant_id, collection_id, image_id) DO UPDATE SET
    max_level = excluded.max_level,
    furthest_visited_level = excluded.furthest_visited_level,
    most_realistic_level = excluded.most_realistic_level,
    favorite_level = excluded.favorite_level,
    grading_ms = excluded.grading_ms,
    created_at = datetime('now')
`);

// Re-rank upsert (issue #23): the participant revisited an already-ranked image
// from the /rankings page and revised it. Unlike the normal upsert, the time
// they just spent is *added* to the existing grading time rather than replacing
// it, the row is flagged re_ranked, and furthest_visited_level only grows.
const reRankRankingStmt = db.prepare(`
  INSERT INTO image_rankings (
    participant_id, collection_id, image_id, max_level, furthest_visited_level,
    most_realistic_level, favorite_level, grading_ms, re_ranked
  ) VALUES (
    :participantId, :collectionId, :imageId, :maxLevel, :furthestVisitedLevel,
    :mostRealisticLevel, :favoriteLevel, :gradingMs, 1
  )
  ON CONFLICT (participant_id, collection_id, image_id) DO UPDATE SET
    max_level = excluded.max_level,
    furthest_visited_level = max(image_rankings.furthest_visited_level, excluded.furthest_visited_level),
    most_realistic_level = excluded.most_realistic_level,
    favorite_level = excluded.favorite_level,
    grading_ms = COALESCE(image_rankings.grading_ms, 0) + COALESCE(excluded.grading_ms, 0),
    re_ranked = 1,
    created_at = datetime('now')
`);

const participantExistsStmt = db.prepare("SELECT id FROM participants WHERE id = ?");

function toIntOrNull(value) {
  return value != null && value !== "" && Number.isFinite(Number(value)) ? Number(value) : null;
}

function createParticipant(demographics, userAgent, accountId = null) {
  const result = insertParticipantStmt.run({
    accountId: accountId == null ? null : Number(accountId),
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
    timeBudgetMinutes: toIntOrNull(demographics.timeBudgetMinutes),
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
    country_of_origin = :countryOfOrigin, display_type = :displayType, lighting = :lighting,
    time_budget_minutes = :timeBudgetMinutes
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
    timeBudgetMinutes: toIntOrNull(demographics.timeBudgetMinutes),
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
  const statement = ranking.reRank ? reRankRankingStmt : upsertRankingStmt;
  statement.run({
    participantId: Number(ranking.participantId),
    collectionId: String(ranking.collectionId),
    imageId: String(ranking.imageId),
    maxLevel: Number(ranking.maxLevel),
    furthestVisitedLevel: Number(ranking.furthestVisitedLevel),
    mostRealisticLevel: ranking.mostRealisticLevel == null ? null : Number(ranking.mostRealisticLevel),
    favoriteLevel: ranking.favoriteLevel == null ? null : Number(ranking.favoriteLevel),
    gradingMs: ranking.gradingMs == null ? null : Number(ranking.gradingMs),
  });
}

// Average time participants have spent grading a single image, across all
// recorded rankings. Used to size each new participant's image set to their
// stated time budget; ignores rows without a usable timing (NULL or <= 0).
function getAverageGradingMs() {
  const row = db
    .prepare(
      "SELECT AVG(grading_ms) AS avg_ms, COUNT(*) AS sample_count FROM image_rankings WHERE grading_ms IS NOT NULL AND grading_ms > 0"
    )
    .get();
  return {
    avgMs: row?.avg_ms != null ? Number(row.avg_ms) : null,
    sampleCount: Number(row?.sample_count ?? 0),
  };
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
         p.lighting, p.time_budget_minutes,
         r.collection_id, r.image_id, r.max_level, r.furthest_visited_level,
         r.most_realistic_level, r.favorite_level, r.grading_ms, r.re_ranked,
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

// --- Participant accounts (issue #31) ---------------------------------------

// Row shape returned to callers; never includes password_hash.
function publicAccount(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name ?? null,
    hasPassword: Boolean(row.password_hash),
    hasGoogle: Boolean(row.google_sub),
  };
}

function getAccountById(id) {
  return db.prepare("SELECT * FROM accounts WHERE id = ?").get(Number(id)) ?? null;
}

function getAccountByEmail(email) {
  if (!email) {
    return null;
  }
  return db.prepare("SELECT * FROM accounts WHERE email = ? COLLATE NOCASE").get(String(email)) ?? null;
}

function getAccountByGoogleSub(sub) {
  if (!sub) {
    return null;
  }
  return db.prepare("SELECT * FROM accounts WHERE google_sub = ?").get(String(sub)) ?? null;
}

// Create an account. `password` is optional (Google-only accounts have none);
// `googleSub` is optional (password-only accounts have none). Returns the new
// account id.
function createAccount({ email, password = null, googleSub = null, displayName = null }) {
  const result = db
    .prepare(
      "INSERT INTO accounts (email, password_hash, google_sub, display_name) VALUES (?, ?, ?, ?)"
    )
    .run(
      String(email),
      password ? hashPassword(password) : null,
      googleSub ? String(googleSub) : null,
      displayName ?? null
    );
  return Number(result.lastInsertRowid);
}

// Verify an email+password login. Returns the account row on success, else null.
function verifyAccountPassword(email, password) {
  if (!email || !password) {
    return null;
  }
  const account = getAccountByEmail(email);
  if (!account || !account.password_hash || !verifyPassword(password, account.password_hash)) {
    return null;
  }
  return account;
}

// Link a Google identity to an existing (password) account, so a participant
// who signed up with a password can later sign in with Google on the same email.
function attachGoogleToAccount(accountId, googleSub) {
  db.prepare("UPDATE accounts SET google_sub = ? WHERE id = ? AND google_sub IS NULL").run(
    String(googleSub),
    Number(accountId)
  );
}

// Adopt every anonymous (unlinked) participant row whose email matches the
// account's, keying prior anonymous progress to the account (issue #31).
function linkParticipantsByEmail(accountId, email) {
  if (!email) {
    return;
  }
  db.prepare(
    "UPDATE participants SET account_id = ? WHERE account_id IS NULL AND email = ? COLLATE NOCASE"
  ).run(Number(accountId), String(email));
}

// Link one specific participant row to an account (the "I'm mid-study and just
// signed in" case). No-op if it already belongs to a different account.
function setParticipantAccount(participantId, accountId) {
  db.prepare(
    "UPDATE participants SET account_id = ? WHERE id = ? AND (account_id IS NULL OR account_id = ?)"
  ).run(Number(accountId), Number(participantId), Number(accountId));
}

// The participant row an account should resume into: prefer an unfinished
// session, otherwise the most recently active one. Returns the id or null.
function getLatestParticipantForAccount(accountId) {
  const row = db
    .prepare(
      `SELECT id FROM participants
       WHERE account_id = ?
       ORDER BY (completed_at IS NULL) DESC, created_at DESC, id DESC
       LIMIT 1`
    )
    .get(Number(accountId));
  return row ? Number(row.id) : null;
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
         AVG(CASE WHEN r.collection_id = 'hdr' THEN r.favorite_level END) AS hdr_favorite_avg,
         AVG(CASE WHEN r.collection_id = 'hdr' THEN r.most_realistic_level END) AS hdr_realism_avg,
         AVG(CASE WHEN r.collection_id = 'sharpness' THEN r.favorite_level END) AS sharpness_favorite_avg,
         AVG(CASE WHEN r.collection_id = 'sharpness' THEN r.most_realistic_level END) AS sharpness_realism_avg
       FROM participants p
       LEFT JOIN image_rankings r ON r.participant_id = p.id
       GROUP BY p.id
       ORDER BY p.created_at DESC, p.id DESC`
    )
    .all();
}

// Raw rows for the analytics dashboard (issue #24). Aggregation/normalization
// happens in the route layer (server/stats.js) — study datasets are small, so
// computing in JS keeps the SQL simple and the stats logic in one place.
function getRankingRowsForStats() {
  return db
    .prepare(
      `SELECT collection_id, image_id, max_level, most_realistic_level, favorite_level
       FROM image_rankings`
    )
    .all();
}

// Total participants and how many have finished (completed_at set).
function getParticipantCounts() {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN completed_at IS NOT NULL THEN 1 ELSE 0 END) AS completed
       FROM participants`
    )
    .get();
  return { total: Number(row?.total ?? 0), completed: Number(row?.completed ?? 0) };
}

// Every ranking recorded for one image, with the participant's email joined in.
// Backs the shareable per-image detail page (/admin/images/:collection/:image).
function getImageRankingDetail(collectionId, imageId) {
  return db
    .prepare(
      `SELECT r.id, r.participant_id, p.email,
              r.max_level, r.furthest_visited_level,
              r.most_realistic_level, r.favorite_level,
              r.grading_ms, r.re_ranked, r.created_at
       FROM image_rankings r
       JOIN participants p ON p.id = r.participant_id
       WHERE r.collection_id = ? AND r.image_id = ?
       ORDER BY r.created_at`
    )
    .all(String(collectionId), String(imageId));
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
  publicAccount,
  getAccountById,
  getAccountByEmail,
  getAccountByGoogleSub,
  createAccount,
  verifyAccountPassword,
  attachGoogleToAccount,
  linkParticipantsByEmail,
  setParticipantAccount,
  getLatestParticipantForAccount,
  listSubmissions,
  getSubmissionDetail,
  getRankingRowsForStats,
  getParticipantCounts,
  getImageRankingDetail,
  createParticipant,
  updateParticipant,
  markParticipantComplete,
  participantExists,
  recordRanking,
  getParticipantWithRankings,
  getAverageGradingMs,
  exportAll,
  exportRankingsFlat,
};
