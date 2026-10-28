/* NutriSafe — SQLite persistence (zero external deps)
 *
 * Uses Node's built-in `node:sqlite` (Node 22.5+). Data lives in
 * server/data/nutrisafe.db (gitignored). If `node:sqlite` is unavailable
 * (older Node), it falls back to the legacy JSON file (db.json).
 *
 * Tables:
 *   users(id TEXT PK, email TEXT UNIQUE, passwordHash TEXT, profile TEXT, createdAt TEXT)
 *   history(id INTEGER PK AUTOINCREMENT, userId TEXT, analysis TEXT, createdAt TEXT)
 *   food_log(id TEXT PK, userId TEXT, date TEXT, meal TEXT, foodName TEXT,
 *            category TEXT, quantity REAL, unit TEXT, status TEXT,
 *            nutritionPerUnit TEXT, createdAt TEXT, updatedAt TEXT)
 *
 * API (unchanged — index.js only touches load()/save()):
 *   load() → { users: {email: user}, userData: {userId: {history: [...], foodLog: [...]}} }
 *   save() → persists the live object (transactional)
 *
 * First run migrates legacy server/data/db.json automatically.
 * Set NUTRISAFE_DB_FILE to override the database path.
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = process.env.NUTRISAFE_DB_FILE || path.join(DATA_DIR, "nutrisafe.db");
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

/** Oldest entries beyond this per user are trimmed on save (bounds rewrite cost). */
const MAX_HISTORY_ITEMS = 500;
/** Food-log entries are small; keep about five years of dense logging. */
const MAX_FOOD_LOG_ITEMS = 2000;

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
  try {
    sql = new sqlite.DatabaseSync(DB_FILE, { timeout: 5000 });
  } catch {
    // Older Node: DatabaseSync may not accept an options argument.
    sql = new sqlite.DatabaseSync(DB_FILE);
  }
  // Best-effort concurrency hardening (single-instance SQLite).
  // WAL lets readers proceed during writes; busy_timeout makes writers
  // wait instead of failing immediately with SQLITE_BUSY.
  try {
    sql.exec("PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;");
  } catch {
    /* ignore — DB remains usable without WAL/timeout */
  }
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
    CREATE TABLE IF NOT EXISTS food_log (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      date TEXT NOT NULL,
      meal TEXT NOT NULL,
      foodName TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'General Food',
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      status TEXT NOT NULL,
      nutritionPerUnit TEXT NOT NULL,
      nutritionSource TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_food_log_user_date ON food_log(userId, date);
  `);

  // Older databases predate nutritionSource; add the column in place.
  const foodLogColumns = sql.prepare("PRAGMA table_info(food_log)").all();
  if (!foodLogColumns.some((column) => column.name === "nutritionSource")) {
    sql.exec("ALTER TABLE food_log ADD COLUMN nutritionSource TEXT");
  }
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
    userData[users[email].id] = { history: [], foodLog: [] };
  }
  // Newest first (index.js prepends new entries).
  const rows = sql.prepare("SELECT userId, analysis FROM history ORDER BY id DESC").all();
  for (const row of rows) {
    try {
      if (!userData[row.userId]) userData[row.userId] = { history: [], foodLog: [] };
      userData[row.userId].history.push(JSON.parse(row.analysis));
    } catch {
      /* skip corrupt rows */
    }
  }

  // Food-log rows are stored oldest-first; the API sorts per day by meal.
  const logRows = sql.prepare("SELECT * FROM food_log ORDER BY createdAt ASC").all();
  for (const row of logRows) {
    try {
      if (!userData[row.userId]) userData[row.userId] = { history: [], foodLog: [] };
      let nutritionPerUnit = {};
      try {
        nutritionPerUnit = JSON.parse(row.nutritionPerUnit);
      } catch {
        nutritionPerUnit = {};
      }
      userData[row.userId].foodLog.push({
        id: row.id,
        date: row.date,
        meal: row.meal,
        foodName: row.foodName,
        category: row.category,
        quantity: row.quantity,
        unit: row.unit,
        status: row.status,
        nutritionPerUnit,
        nutritionSource: row.nutritionSource ?? undefined,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      });
    } catch {
      /* skip corrupt rows */
    }
  }
  return { users, userData };
}

function saveToSqlite() {
  if (!db) return;
  // NOTE: full-history rewrite per user (DELETE all + INSERT all) is kept
  // intentionally: single-instance SQLite, history capped at
  // MAX_HISTORY_ITEMS, and index.js mutates the live object directly via
  // Maps so dirty tracking isn't simple. WAL + busy_timeout above keep
  // this transactional rewrite from failing under brief contention.
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
  const trimHistory = sql.prepare(
    `DELETE FROM history WHERE userId = ?
     AND id NOT IN (SELECT id FROM history WHERE userId = ? ORDER BY id DESC LIMIT ?)`
  );
  const clearFoodLog = sql.prepare("DELETE FROM food_log WHERE userId = ?");
  const insertFoodLog = sql.prepare(`
    INSERT INTO food_log (
      id, userId, date, meal, foodName, category, quantity, unit, status,
      nutritionPerUnit, nutritionSource, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const trimFoodLog = sql.prepare(
    `DELETE FROM food_log WHERE userId = ?
     AND id NOT IN (SELECT id FROM food_log WHERE userId = ? ORDER BY createdAt DESC LIMIT ?)`
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
      trimHistory.run(userId, userId, MAX_HISTORY_ITEMS);
      clearFoodLog.run(userId);
      for (const item of data.foodLog ?? []) {
        insertFoodLog.run(
          item.id,
          userId,
          item.date,
          item.meal,
          item.foodName,
          item.category ?? "General Food",
          Number(item.quantity) || 0,
          item.unit,
          item.status,
          JSON.stringify(item.nutritionPerUnit ?? {}),
          item.nutritionSource ?? null,
          item.createdAt ?? new Date().toISOString(),
          item.updatedAt ?? item.createdAt ?? new Date().toISOString()
        );
      }
      trimFoodLog.run(userId, userId, MAX_FOOD_LOG_ITEMS);
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
    console.log("[store] Migrated legacy db.json → nutrisafe.db");
  } catch (err) {
    console.error("[store] Legacy migration failed:", err.message);
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Ensure every account has the collections index.js expects. */
function normalizeShape(state) {
  for (const data of Object.values(state.userData ?? {})) {
    if (!Array.isArray(data.history)) data.history = [];
    if (!Array.isArray(data.foodLog)) data.foodLog = [];
  }
  return state;
}

function load() {
  if (db) return db;
  if (useJsonFallback) {
    db = normalizeShape(readLegacyJson());
    return db;
  }
  try {
    openSqlite();
    migrateLegacyIfEmpty();
    db = normalizeShape(loadFromSqlite());
    return db;
  } catch (err) {
    console.error("[store] SQLite init failed, using JSON fallback:", err.message);
    useJsonFallback = true;
    db = normalizeShape(readLegacyJson());
    return db;
  }
}

function save() {
  if (!db) return;
  // Enforce the per-user cap in every backend (newest-first order).
  for (const data of Object.values(db.userData)) {
    if (Array.isArray(data.history) && data.history.length > MAX_HISTORY_ITEMS) {
      data.history = data.history.slice(0, MAX_HISTORY_ITEMS);
    }
    // Food log is kept oldest-first; drop the oldest overflow.
    if (Array.isArray(data.foodLog) && data.foodLog.length > MAX_FOOD_LOG_ITEMS) {
      data.foodLog = data.foodLog.slice(-MAX_FOOD_LOG_ITEMS);
    }
  }
  if (useJsonFallback) {
    writeLegacyJson();
    return;
  }
  try {
    ensureDataDir();
  } catch {
    /* ignore — open handle may still be valid */
  }
  try {
    saveToSqlite();
  } catch (err) {
    // Sync code can't await/retry with setTimeout; on SQLITE_BUSY just warn
    // and keep the in-memory state — the next save() will retry. Never throw.
    const msg = (err && err.message) || "";
    const code = err && (err.code || err.errno);
    if (code === "SQLITE_BUSY" || /SQLITE_BUSY|database is locked/i.test(msg)) {
      console.warn(
        "[store] SQLite busy (SQLITE_BUSY) — keeping in-memory state, next save() will retry."
      );
      return;
    }
    console.error("[store] SQLite save failed:", msg || err);
  }
}

module.exports = { load, save };
