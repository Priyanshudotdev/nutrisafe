/* NutriCheck — JSON-file persistence
 *
 * Keeps accounts & history across server restarts with zero external deps.
 * Data lives in server/data/db.json (gitignored). Writes are atomic (tmp + rename).
 * For production, swap this module for a real DB — the rest of the server only
 * touches load()/save().
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

const EMPTY_DB = { users: {}, userData: {} };

let db = null;

function load() {
  if (db) return db;
  try {
    if (fs.existsSync(DB_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
      db = {
        users: parsed.users && typeof parsed.users === "object" ? parsed.users : {},
        userData: parsed.userData && typeof parsed.userData === "object" ? parsed.userData : {},
      };
      return db;
    }
  } catch (err) {
    console.error("Failed to read db.json — starting fresh:", err.message);
  }
  db = JSON.parse(JSON.stringify(EMPTY_DB));
  return db;
}

function save() {
  if (!db) return;
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2), "utf8");
    fs.renameSync(tmp, DB_FILE);
  } catch (err) {
    console.error("Failed to persist db.json:", err.message);
  }
}

module.exports = { load, save };
