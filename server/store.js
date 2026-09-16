/* NutriCheck — SQLite persistence (zero external deps)
 *
 * Uses Node's built-in `node:sqlite` (Node 22.5+). Data lives in
 * server/data/nutricheck.db (gitignored). If `node:sqlite` is unavailable
 * (older Node), it falls back to the legacy JSON file (db.json).
 *
 * Tables:
 *   users(id TEXT PK, email TEXT UNIQUE, passwordHash TEXT, profile TEXT, createdAt TEXT)
 *   history(id INTEGER PK AUTOINCREMENT, userId TEXT, analysis TEXT, createdAt TEXT)
 *
 * API (unchanged — index.js only touches load()/save()):
 *   load() → { users: {email: user}, userData: {userId: {history: [...]}} } (live object)
 *   save() → persists the live object (transactional)
 *
 * First run migrates legacy server/data/db.json automatically.
 * Set NUTRICHECK_DB_FILE to override the database path.
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = process.env.NUTRICHECK_DB_FILE || path.join(DATA_DIR, "nutricheck.db");
const LEGACY_JSON = path.join(DATA_DIR, "db.json");

let sqlite = null;
try {
  sqlite = require("node:sqlite");
} catch {
  console.warn("[store] node:sqlite unavailable — falling back to JSON file persistence.");
}

let db = null; // live in-memory shape: { users, userData }
let sql = null; // DatabaseSync handle (sqlite mode only)
let useJsonFallback = !sqlite;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ─── Legacy JSON fallback (also used for one-time migration) ────────────────

function readLegacyJson() {
  try {
    if (fs.existsSync(LEGACY_JSON)) {
      const parsed = JSON.parse(fs.readFileSync(LEGACY_JSON, "utf8"));
      return {
        users: parsed.users && typeof parsed.users === "object" ? parsed.users : {},
        userData: parsed.userData && typeof parsed.userData === "object" ? parsed.userData : {},
      };
    }
  } catch (err) {
    console.error("Failed to read legacy db.json:", err.message);
  }
  return { users: {}, userData: {} };
}

function writeLegacyJson() {
  try {
    ensureDataDir();
    const tmp = `${LEGACY_JSON}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2), "utf8");
    fs.renameSync(tmp, LEGACY_JSON);
  } catch (err) {
    console.error("Failed to persist db.json:", err.message);
  }
}

// ─── SQLite mode ─────────────────────────────────────────────────────────────

function openSqlite() {
  ensureDataDir();
  sql = new sqlite.DatabaseSync(DB_FILE);
  sql.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      passwordHash TEXT NOT NULL,
      profile TEXT NOT NULL DEFAULT '{}',
      createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      analysis TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_history_user ON history(userId, id DESC);
  `);
}

function loadFromSqlite() {
  const users = {};
  for (const row of sql.prepare("SELECT * FROM users").all()) {
    let profile = {};
    try {
      profile = JSON.parse(row.profile);
    } catch {
      profile = {};
    }
    users[row.email] = {
      id: row.id,
      email: row.email,
      passwordHash: row.passwordHash,
      profile,
      createdAt: row.createdAt,
    };
  }

  const userData = {};
  for (const email of Object.keys(users)) {
    userData[users[email].id] = { history: [] };
  }
  // Newest first (index.js prepends new entries).
  const rows = sql.prepare("SELECT userId, analysis FROM history ORDER BY id DESC").all();
  for (const row of rows) {
    try {
      if (!userData[row.userId]) userData[row.userId] = { history: [] };
      userData[row.userId].history.push(JSON.parse(row.analysis));
    } catch {
      /* skip corrupt rows */
    }
  }
  return { users, userData };
}

function saveToSqlite() {
  const insertUser = sql.prepare(`
    INSERT INTO users (id, email, passwordHash, profile, createdAt)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      email = excluded.email,
      passwordHash = excluded.passwordHash,
      profile = excluded.profile
  `);
  const clearHistory = sql.prepare("DELETE FROM history WHERE userId = ?");
  const insertHistory = sql.prepare(
    "INSERT INTO history (userId, analysis, createdAt) VALUES (?, ?, ?)"
  );

  // node:sqlite has no transaction() helper — use explicit BEGIN/COMMIT.
  sql.exec("BEGIN");
  try {
    for (const user of Object.values(db.users)) {
      insertUser.run(
        user.id,
        user.email,
        user.passwordHash,
        JSON.stringify(user.profile ?? {}),
        user.createdAt ?? new Date().toISOString()
      );
    }
    for (const [userId, data] of Object.entries(db.userData)) {
      clearHistory.run(userId);
      // Stored oldest-first so DESC reads come back newest-first.
      const items = [...(data.history ?? [])].reverse();
      for (const analysis of items) {
        insertHistory.run(userId, JSON.stringify(analysis), new Date().toISOString());
      }
    }
    sql.exec("COMMIT");
  } catch (err) {
    try {
      sql.exec("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw err;
  }
}

function migrateLegacyIfEmpty() {
  const userCount = sql.prepare("SELECT COUNT(*) AS n FROM users").get().n;
  if (userCount > 0 || !fs.existsSync(LEGACY_JSON)) return;
  const legacy = readLegacyJson();
  if (Object.keys(legacy.users).length === 0) return;
  db = legacy;
  try {
    saveToSqlite();
    fs.renameSync(LEGACY_JSON, `${LEGACY_JSON}.migrated`);
    console.log("[store] Migrated legacy db.json → nutricheck.db");
  } catch (err) {
    console.error("[store] Legacy migration failed:", err.message);
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

function load() {
  if (db) return db;
  if (useJsonFallback) {
    db = readLegacyJson();
    return db;
  }
  try {
    openSqlite();
    migrateLegacyIfEmpty();
    db = loadFromSqlite();
    return db;
  } catch (err) {
    console.error("[store] SQLite init failed, using JSON fallback:", err.message);
    useJsonFallback = true;
    db = readLegacyJson();
    return db;
  }
}

function save() {
  if (!db) return;
  if (useJsonFallback) {
    writeLegacyJson();
    return;
  }
  try {
    saveToSqlite();
  } catch (err) {
    console.error("[store] SQLite save failed:", err.message);
  }
}

module.exports = { load, save };
