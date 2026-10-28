/* NutriSafe — local API server
 *
 * Start with:  node server/index.js     (or  pnpm api)
 * Defaults to port 4000.  Set PORT env var to override.
 *
 * Data persists to server/data/db.json (see store.js).
 * AI (food identification + nutrition analysis) is provided by server/ai.js —
 * set GEMINI_API_KEY or OPENAI_API_KEY to enable; routes degrade gracefully
 * without keys.
 */

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const ai = require("./ai");
const nutrition = require("./nutrition");
const safety = require("./safety-engine");
const store = require("./store");

// ─── Local env files ─────────────────────────────────────────────────────────
// Plain `node` doesn't inject Expo's .env.local — load it (and .env) here so
// GEMINI_API_KEY / OPENAI_* / PORT / JWT_SECRET just work. Real environment
// variables always win; values already set are never overwritten.
// Set NUTRISAFE_SKIP_ENV_FILE=1 to disable (used by hermetic tests).
// Robust loader: handles \r, `export KEY=`, quoted values with # inside,
// and skips multiline values (best-effort, no dep).
if (process.env.NUTRISAFE_SKIP_ENV_FILE !== "1") {
  for (const file of [".env.local", ".env"]) {
    try {
      const p = path.join(process.cwd(), file);
      if (!fs.existsSync(p)) continue;
      const raw = fs.readFileSync(p, "utf8");
      let inMultiline = false;
      let multilineQuote = null;
      for (const rawLine of raw.split(/\r?\n/)) {
        // Skip continuation lines of a multiline value.
        if (inMultiline) {
          if (multilineQuote && rawLine.includes(multilineQuote)) {
            inMultiline = false;
            multilineQuote = null;
          }
          continue;
        }
        let trimmed = rawLine.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        if (trimmed.startsWith("export ")) trimmed = trimmed.slice(7).trim();
        const eq = trimmed.indexOf("=");
        if (eq <= 0) continue;
        const key = trimmed.slice(0, eq).trim();
        let rest = trimmed.slice(eq + 1).trim();
        if (!key) continue;
        let value;
        const first = rest[0];
        if (first === '"' || first === "'" || first === "`") {
          const closing = rest.indexOf(first, 1);
          if (closing === -1) {
            // Unterminated quote → multiline value; skip it entirely.
            inMultiline = true;
            multilineQuote = first;
            continue;
          }
          // Quoted value: keep # inside quotes verbatim, ignore trailing comment.
          value = rest.slice(1, closing);
        } else {
          // Unquoted: strip trailing ` # comment` (a # preceded by whitespace).
          const hashIdx = rest.search(/\s#/);
          if (hashIdx !== -1) rest = rest.slice(0, hashIdx).trim();
          value = rest;
        }
        if (!(key in process.env)) process.env[key] = value;
      }
    } catch (err) {
      console.warn(`Could not load ${file}:`, err.message);
    }
  }
}

// ─── Config ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT ?? 4000;
const JWT_DEV_FALLBACK = "nutrisafe-dev-secret-change-in-prod";
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const _envJwt = process.env.JWT_SECRET;
if (IS_PRODUCTION) {
  if (!_envJwt || _envJwt === JWT_DEV_FALLBACK || _envJwt.length < 32) {
    console.error(
      "FATAL: JWT_SECRET must be set to a strong value (>=32 chars) in production. Refusing to boot."
    );
    process.exit(1);
  }
} else if (!_envJwt || _envJwt === JWT_DEV_FALLBACK) {
  console.warn("JWT_SECRET is using the dev fallback — do not use in production.");
} else if (_envJwt.length < 32) {
  console.warn("JWT_SECRET is short (<32 chars). Use a longer secret in production.");
}
const JWT_SECRET = _envJwt ?? JWT_DEV_FALLBACK;
const JWT_EXPIRES_IN = "7d";
const FOOD_VISION_API_URL = process.env.FOOD_VISION_API_URL ?? ""; // optional direct vision endpoint override

// ─── Persistent stores (SQLite via store.js) ───────────────────────────────────
const db = store.load();
/** @type {Map<string, { id: string; email: string; passwordHash: string; profile: object; createdAt: string }>} */
const usersByEmail = new Map(Object.entries(db.users));
/** @type {Map<string, { history: object[] }>} */
const userDataById = new Map(Object.entries(db.userData));

function persist() {
  db.users = Object.fromEntries(usersByEmail);
  db.userData = Object.fromEntries(userDataById);
  store.save();
}

// ─── Upload dir for scanned food images ───────────────────────────────────────
const uploadDir = path.join(process.cwd(), ".tmp-uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

/** Best-effort tmp-file delete — never throw inside finally blocks. */
function safeUnlink(p) {
  try {
    if (p && fs.existsSync(p)) fs.unlinkSync(p);
  } catch {
    // ignore cleanup errors so they never mask the real response
  }
}

// Startup sweep: delete stale tmp-upload files older than 1h (best-effort).
try {
  const now = Date.now();
  const cutoff = 60 * 60 * 1000;
  for (const entry of fs.readdirSync(uploadDir)) {
    try {
      const fp = path.join(uploadDir, entry);
      const st = fs.statSync(fp);
      if (st.isFile() && now - st.mtimeMs > cutoff) fs.unlinkSync(fp);
    } catch {
      // ignore per-file errors
    }
  }
} catch {
  // ignore sweep errors (e.g. unreadable dir)
}

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are accepted."));
  },
});

// ─── JSON image uploads (preferred mobile path) ──────────────────────────────
// Same vision capabilities as the multipart routes, but the image travels as
// a base64 string in JSON: one representation on every platform, no
// boundary/Content-Type footguns, retry-safe (strings are reusable, unlike
// consumable FormData bodies). Multipart routes stay as fallback.
const JSON_IMAGE_MAX_BYTES = 2_500_000; // decoded bytes

/**
 * Validate + decode a { imageBase64, mime } JSON body.
 * Returns { buffer, mime } or { errStatus, errBody } for an immediate 4xx.
 * Never logs the base64 payload — only mime + byte counts.
 */
function decodeImageJson(body) {
  const imageBase64 = body?.imageBase64;
  const mime = typeof body?.mime === "string" && body.mime ? body.mime.toLowerCase() : "image/jpeg";

  if (typeof imageBase64 !== "string" || imageBase64.length === 0) {
    return { errStatus: 400, errBody: { error: "imageBase64 is required." } };
  }
  if (!mime.startsWith("image/")) {
    return {
      errStatus: 400,
      errBody: {
        status: "failed",
        message: "This file doesn't look like an image. Please pick a JPEG or PNG photo.",
      },
    };
  }
  if (/heic|heif/i.test(mime)) {
    return {
      errStatus: 400,
      errBody: {
        status: "failed",
        message:
          "This photo is in HEIC format (iPhone), which can't be analyzed. Please retake it as JPEG or pick a JPEG/PNG from your gallery.",
      },
    };
  }
  let buffer;
  try {
    buffer = Buffer.from(imageBase64, "base64");
  } catch {
    return { errStatus: 400, errBody: { error: "imageBase64 is not valid base64." } };
  }
  if (buffer.length < 32) {
    return {
      errStatus: 400,
      errBody: {
        status: "failed",
        message: "We couldn't read this photo. Try picking the photo again or retaking it.",
      },
    };
  }
  if (buffer.length > JSON_IMAGE_MAX_BYTES) {
    return {
      errStatus: 413,
      errBody: {
        status: "failed",
        message: "This photo is too large to analyze. Try a smaller photo or retake it.",
      },
    };
  }
  return { buffer, mime };
}

// Map multer errors to clear 4xx responses instead of falling through to 500.
function uploadSingleImage(req, res, next) {
  upload.single("image")(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({ error: "Image too large. Maximum size is 10 MB." });
        }
        if (err.code === "LIMIT_UNEXPECTED_FILE") {
          return res.status(400).json({ error: "Unexpected file field. Use 'image'." });
        }
        return res.status(400).json({ error: err.message || "Invalid file upload." });
      }
      if (err && err.message === "Only image files are accepted.") {
        return res.status(400).json({ error: "Only image files are accepted." });
      }
      return res.status(400).json({ error: (err && err.message) || "Invalid file upload." });
    }
    next();
  });
}

// ─── App setup ─────────────────────────────────────────────────────────────────
const app = express();

// Trust first proxy (Railway / Nginx) so req.ip respects X-Forwarded-For for rate limiting.
app.set("trust proxy", 1);

// Minimal helmet-like security headers (inline, no new dep).
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

// CORS: lock down via CORS_ORIGINS (comma-separated) in production.
// The dev default stays open — Expo Go / LAN devices use unpredictable origins.
const CORS_ORIGINS = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const CORS_OPTIONS = {
  methods: ["GET", "POST", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400,
};
if (CORS_ORIGINS.length > 0) {
  app.use(cors({ origin: CORS_ORIGINS, ...CORS_OPTIONS }));
} else {
  app.use(cors(CORS_OPTIONS));
  console.warn("CORS is open to all origins (dev default). Set CORS_ORIGINS in production.");
}
app.use(express.json({ limit: "5mb" }));

// ─── Rate limiting (in-memory fixed window, zero deps) ────────────────────────
function rateLimit({ windowMs, max }) {
  const buckets = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip ?? "unknown";
    let bucket = buckets.get(key);
    if (!bucket || now - bucket.start > windowMs) {
      bucket = { start: now, count: 0 };
      buckets.set(key, bucket);
      if (buckets.size > 1000) {
        for (const [k, b] of buckets) {
          if (now - b.start > windowMs) buckets.delete(k);
          if (buckets.size <= 1000) break;
        }
      }
    }
    bucket.count += 1;
    if (bucket.count > max) {
      return res.status(429).json({ error: "Too many requests. Slow down and try again." });
    }
    next();
  };
}

const authLimiter = rateLimit({ windowMs: 60_000, max: 60 });
const aiLimiter = rateLimit({ windowMs: 60_000, max: 60 });
const apiLimiter = rateLimit({ windowMs: 60_000, max: 180 });
app.use("/auth", authLimiter);
app.use("/profile", apiLimiter);
app.use("/onboarding", apiLimiter);
app.use("/history", apiLimiter);
app.use("/food-log", apiLimiter);

// ─── Email + token helpers ─────────────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function normalizeEmail(v) {
  return String(v ?? "")
    .trim()
    .toLowerCase();
}

// ─── Auth helpers ──────────────────────────────────────────────────────────────
function signToken(userId, tokenVersion = 0) {
  return jwt.sign({ sub: userId, tv: tokenVersion }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: "No token provided." });

  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: "Invalid or expired token." });

  // Token-version check: logout / password / email changes bump the user's
  // version, instantly revoking previously issued tokens (no blacklist needed).
  const authUser = findUserById(payload.sub);
  if (!authUser) return res.status(401).json({ error: "Account no longer exists." });
  if ((payload.tv ?? 0) !== (authUser.tokenVersion ?? 0)) {
    return res.status(401).json({ error: "Session revoked. Please sign in again." });
  }

  req.userId = payload.sub;
  next();
}

function findUserById(id) {
  for (const user of usersByEmail.values()) {
    if (user.id === id) return user;
  }
  return null;
}

// ─── Health ────────────────────────────────────────────────────────────────────
app.get("/health", (_req, res) =>
  res.json({
    status: "ok",
    ai: ai.isConfigured() ? ai.describeConfig() : "not_configured",
  })
);

// ─── Auth ──────────────────────────────────────────────────────────────────────
app.post("/auth/signup", async (req, res) => {
  const { password, name } = req.body;
  const email = normalizeEmail(req.body.email);

  if (!email || !password || !name) {
    return res.status(400).json({ error: "email, password and name are required." });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }
  if (usersByEmail.has(email)) {
    return res.status(409).json({ error: "An account with this email already exists." });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const id = `user_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  // Auth-only profile — health details collected in a separate onboarding step.
  const profile = {
    name: String(name).trim(),
    age: null,
    gender: null,
    email,
    city: null,
    primaryCondition: "ckd",
    allergensList: [],
    notes: "",
    doctorName: null,
    onboardingCompleted: false,
  };

  const user = {
    id,
    email,
    passwordHash,
    profile,
    tokenVersion: 0,
    createdAt: new Date().toISOString(),
  };
  usersByEmail.set(email, user);
  userDataById.set(id, { history: [], foodLog: [] });
  persist();

  const token = signToken(id, 0);
  return res.status(201).json({ token, profile });
});

app.post("/auth/login", async (req, res) => {
  const { password } = req.body;
  const email = normalizeEmail(req.body.email);
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required." });
  }

  const user = usersByEmail.get(email);
  if (!user) return res.status(401).json({ error: "Incorrect email or password." });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Incorrect email or password." });

  const token = signToken(user.id, user.tokenVersion ?? 0);
  return res.json({ token, profile: user.profile });
});

app.post("/auth/logout", requireAuth, (req, res) => {
  // Bump the token version so the current token (and any copies of it)
  // stop validating immediately — no blacklist table required.
  const user = findUserById(req.userId);
  if (user) {
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    persist();
  }
  res.json({ message: "Logged out." });
});

// Sliding sessions: a valid (non-revoked, non-expired) token can be
// exchanged for a fresh 7-day token. The client calls this proactively
// before expiry so users aren't force-logged-out mid-use.
app.post("/auth/refresh", requireAuth, (req, res) => {
  const user = findUserById(req.userId);
  if (!user) return res.status(404).json({ error: "User not found." });
  const token = signToken(user.id, user.tokenVersion ?? 0);
  res.json({ token });
});

app.post("/auth/change-password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "currentPassword and newPassword are required." });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: "New password must be at least 8 characters." });
  }

  const user = findUserById(req.userId);
  if (!user) return res.status(404).json({ error: "User not found." });

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Current password is incorrect." });

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  // Revoke all other sessions; hand the caller a fresh token so this
  // session continues uninterrupted.
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  persist();
  res.json({ message: "Password updated.", token: signToken(user.id, user.tokenVersion) });
});

app.post("/auth/change-email", requireAuth, async (req, res) => {
  const { password } = req.body;
  const newEmail = normalizeEmail(req.body.newEmail);
  if (!newEmail || !password) {
    return res.status(400).json({ error: "newEmail and password are required." });
  }
  if (!EMAIL_RE.test(newEmail)) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }
  if (usersByEmail.has(newEmail)) {
    return res.status(409).json({ error: "This email is already in use." });
  }

  const user = findUserById(req.userId);
  if (!user) return res.status(404).json({ error: "User not found." });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Password is incorrect." });

  usersByEmail.delete(user.email);
  user.email = newEmail;
  user.profile.email = newEmail;
  usersByEmail.set(user.email, user);
  // Sessions are keyed to the old identity — re-issue.
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  persist();

  res.json({
    message: "Email updated.",
    profile: user.profile,
    token: signToken(user.id, user.tokenVersion),
  });
});

// ─── Profile ───────────────────────────────────────────────────────────────────
app.get("/profile", requireAuth, (req, res) => {
  const user = findUserById(req.userId);
  if (!user) return res.status(404).json({ error: "User not found." });
  res.json({ profile: user.profile });
});

app.patch("/profile", requireAuth, (req, res) => {
  const allowed = [
    "name",
    "age",
    "gender",
    "city",
    "primaryCondition",
    "conditions",
    "allergensList",
    "notes",
    "doctorName",
    "onboardingCompleted",
  ];
  const user = findUserById(req.userId);
  if (!user) return res.status(404).json({ error: "User not found." });

  // Validate scalar profile fields (400 on invalid).
  if ("name" in req.body) {
    const v = req.body.name;
    if (typeof v !== "string" || !v.trim() || v.length > 100 || v.trim().length > 100) {
      return res.status(400).json({ error: "name must be a string of 1-100 characters." });
    }
  }
  if ("age" in req.body) {
    const v = req.body.age;
    if (v === "") {
      // Empty string clears the field (matches onboarding's null convention).
      req.body.age = null;
    } else if (v !== null && v !== undefined) {
      if (typeof v === "boolean" || (typeof v === "object" && v !== null) || Array.isArray(v)) {
        return res.status(400).json({ error: "age must be a number between 1 and 120." });
      }
      const n = Number(v);
      if (!Number.isFinite(n) || n < 1 || n > 120) {
        return res.status(400).json({ error: "age must be a number between 1 and 120." });
      }
      // Coerce numeric strings ("30") to real numbers so the stored
      // profile keeps its `age: number|null` type (matches /onboarding).
      req.body.age = n;
    }
  }
  const stringField = (key, max) => {
    if (key in req.body) {
      const v = req.body[key];
      if (v !== null && v !== undefined) {
        if (typeof v !== "string" || v.length > max) {
          return `${key} must be a string of at most ${max} characters.`;
        }
      }
    }
    return null;
  };
  for (const [key, max] of [
    ["gender", 50],
    ["city", 100],
    ["notes", 1000],
    ["doctorName", 100],
  ]) {
    const msg = stringField(key, max);
    if (msg) return res.status(400).json({ error: msg });
  }
  // Strict conditions validation: reject unknown entries instead of silently dropping.
  if ("conditions" in req.body) {
    if (!Array.isArray(req.body.conditions)) {
      return res.status(400).json({ error: "conditions must be an array." });
    }
    const invalid = req.body.conditions.filter((c) => !VALID_CONDITIONS.includes(c));
    if (invalid.length > 0) {
      return res.status(400).json({
        error: `conditions contains invalid entr${invalid.length === 1 ? "y" : "ies"}: ${invalid.join(", ")}.`,
      });
    }
  }

  for (const key of allowed) {
    if (key in req.body) user.profile[key] = req.body[key];
  }

  // Keep conditions[] and primaryCondition consistent (primary = first).
  if (Array.isArray(user.profile.conditions) && user.profile.conditions.length > 0) {
    user.profile.conditions = [...new Set(user.profile.conditions)].filter((c) =>
      VALID_CONDITIONS.includes(c)
    );
    if (user.profile.conditions.length === 0) {
      return res
        .status(400)
        .json({ error: "conditions must contain at least one valid condition." });
    }
    user.profile.primaryCondition = user.profile.conditions[0];
  } else if (VALID_CONDITIONS.includes(user.profile.primaryCondition)) {
    user.profile.conditions = [user.profile.primaryCondition];
  }
  persist();

  res.json({ profile: user.profile });
});

// ─── Onboarding (health profile — separate from auth) ─────────────────────────
const VALID_CONDITIONS = ["diabetes", "ckd", "hypertension", "celiac", "allergy"];

app.post("/onboarding", requireAuth, (req, res) => {
  const user = findUserById(req.userId);
  if (!user) return res.status(404).json({ error: "User not found." });

  const { age, gender, city, conditions, primaryCondition, allergensList, notes, doctorName } =
    req.body;

  // Accept a multi-select list of conditions; fall back to the single legacy field.
  // Unknown entries are rejected (400) — same strictness as PATCH /profile —
  // instead of being silently dropped.
  let conditionList;
  if (Array.isArray(conditions)) {
    const invalid = conditions.filter((c) => !VALID_CONDITIONS.includes(c));
    if (invalid.length > 0) {
      return res.status(400).json({
        error: `conditions contains invalid entr${invalid.length === 1 ? "y" : "ies"}: ${invalid.join(", ")}.`,
      });
    }
    conditionList = [...new Set(conditions)];
  } else {
    conditionList = primaryCondition ? [primaryCondition] : [];
    conditionList = conditionList.filter((c) => VALID_CONDITIONS.includes(c));
  }

  if (conditionList.length === 0) {
    return res.status(400).json({ error: "Select at least one medical condition to continue." });
  }

  if (age !== undefined && age !== null) {
    const n = Number(age);
    if (Number.isNaN(n) || n < 1 || n > 120) {
      return res.status(400).json({ error: "Enter a valid age between 1 and 120." });
    }
    user.profile.age = n;
  }

  if (gender !== undefined) user.profile.gender = gender || null;
  if (city !== undefined) user.profile.city = city || null;
  if (notes !== undefined) user.profile.notes = notes ?? "";
  if (doctorName !== undefined) user.profile.doctorName = doctorName || null;
  if (Array.isArray(allergensList)) user.profile.allergensList = allergensList;
  user.profile.conditions = conditionList;
  user.profile.primaryCondition = conditionList[0];
  user.profile.onboardingCompleted = true;
  persist();

  res.json({ profile: user.profile });
});

// ─── History ───────────────────────────────────────────────────────────────────
const HISTORY_PAGE_DEFAULT = 200;
const HISTORY_PAGE_MAX = 500;

app.get("/history", requireAuth, (req, res) => {
  const data = userDataById.get(req.userId);
  const history = data?.history ?? [];
  const rawLimit = parseInt(String(req.query.limit ?? HISTORY_PAGE_DEFAULT), 10);
  const limit = Math.min(
    Math.max(Number.isNaN(rawLimit) ? HISTORY_PAGE_DEFAULT : rawLimit, 1),
    HISTORY_PAGE_MAX
  );
  res.json({ history: history.slice(0, limit) });
});

const VALID_STATUSES = ["safe", "moderation", "not_recommended", "unable_to_verify"];

app.post(
  "/history",
  requireAuth,
  (req, res, next) => {
    const len = Number(req.headers["content-length"]);
    if (Number.isFinite(len) && len > 120 * 1024) {
      return res.status(413).json({ error: "Request body too large." });
    }
    next();
  },
  (req, res) => {
    const { analysis } = req.body;
    if (!analysis || typeof analysis !== "object" || Array.isArray(analysis)) {
      return res.status(400).json({ error: "analysis object is required." });
    }
    if (typeof analysis.id !== "string" || typeof analysis.foodName !== "string") {
      return res.status(400).json({ error: "analysis must include string id and foodName." });
    }
    if (!VALID_STATUSES.includes(analysis.status)) {
      return res.status(400).json({
        error: "analysis.status must be safe, moderation, not_recommended or unable_to_verify.",
      });
    }
    if (JSON.stringify(analysis).length > 100_000) {
      return res.status(413).json({ error: "analysis object is too large." });
    }

    const data = userDataById.get(req.userId);
    if (!data) return res.status(404).json({ error: "User data not found." });

    // Upsert by id: retries/double-taps replace instead of duplicating.
    data.history = [analysis, ...data.history.filter((a) => a?.id !== analysis.id)];
    persist();
    res.status(201).json({ analysis });
  }
);

app.delete("/history/:id", requireAuth, (req, res) => {
  const data = userDataById.get(req.userId);
  if (!data) return res.status(404).json({ error: "User data not found." });
  const before = data.history.length;
  data.history = data.history.filter((a) => a?.id !== req.params.id);
  if (data.history.length === before) {
    return res.status(404).json({ error: "History item not found." });
  }
  persist();
  res.json({ message: "History item deleted." });
});

app.delete("/history", requireAuth, (req, res) => {
  const data = userDataById.get(req.userId);
  if (data) data.history = [];
  persist();
  res.json({ message: "History cleared." });
});

// ─── Food log — planned vs actually eaten food + daily nutrition ──────────────
// Every item stores nutrition for ONE recorded unit. Consumed totals are
// derived (`nutritionPerUnit × quantity`) and include ONLY status="eaten"
// items, so toggling a status or editing a quantity always recalculates.

const VALID_MEALS = ["breakfast", "lunch", "dinner", "snack"];
const VALID_UNITS = nutrition.UNITS;
const VALID_FOOD_LOG_STATUSES = ["eaten", "not_eaten"];
const MEAL_ORDER = { breakfast: 0, lunch: 1, snack: 2, dinner: 3 };
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

function localDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function currentDateKey() {
  return localDateKey(new Date());
}

function isValidDateKey(value) {
  if (typeof value !== "string" || !DATE_KEY_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function parseQuantity(value) {
  if (value === null || value === undefined || typeof value === "boolean") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || n > 10_000) return null;
  return Math.round(n * 100) / 100;
}

function foodLogFor(userId) {
  const data = userDataById.get(userId);
  if (!data) return null;
  if (!Array.isArray(data.foodLog)) data.foodLog = [];
  return data.foodLog;
}

function sortFoodLogItems(items) {
  return [...items].sort(
    (a, b) =>
      (MEAL_ORDER[a.meal] ?? 9) - (MEAL_ORDER[b.meal] ?? 9) ||
      String(a.createdAt).localeCompare(String(b.createdAt))
  );
}

/** Distinct days that have log entries, newest first (for quick history nav). */
function buildFoodLogDays(userId) {
  const log = foodLogFor(userId) ?? [];
  const byDate = new Map();
  for (const item of log) {
    if (!isValidDateKey(item.date)) continue;
    let marker = byDate.get(item.date);
    if (!marker) {
      marker = { date: item.date, calories: 0, eatenCount: 0, itemCount: 0 };
      byDate.set(item.date, marker);
    }
    marker.itemCount += 1;
    if (item.status === "eaten") {
      marker.eatenCount += 1;
      marker.calories += nutrition.scaleNutrition(item.nutritionPerUnit, item.quantity, 2).calories;
    }
  }
  return [...byDate.values()]
    .map((m) => ({ ...m, calories: Math.round(m.calories * 10) / 10 }))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 30);
}

function buildFoodLogDay(userId, date) {
  const items = sortFoodLogItems((foodLogFor(userId) ?? []).filter((i) => i.date === date));
  return {
    date,
    items,
    summary: nutrition.summarizeFoodLog(items),
    days: buildFoodLogDays(userId),
  };
}

/**
 * Validate the mutable food-log fields.
 * Returns `{ error }` or `{ value }` with only the supplied fields (partial).
 */
function parseFoodLogFields(body, { partial = false } = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "A JSON body is required." };
  }
  const out = {};

  if (!partial || "date" in body) {
    const date = body.date ?? currentDateKey();
    if (!isValidDateKey(date)) {
      return { error: "date must be a valid YYYY-MM-DD date." };
    }
    out.date = date;
  }

  if (!partial || "meal" in body) {
    if (!VALID_MEALS.includes(body.meal)) {
      return { error: `meal must be one of: ${VALID_MEALS.join(", ")}.` };
    }
    out.meal = body.meal;
  }

  if (!partial || "foodName" in body) {
    if (
      typeof body.foodName !== "string" ||
      !body.foodName.trim() ||
      body.foodName.trim().length > 120
    ) {
      return { error: "foodName must be a string of 1-120 characters." };
    }
    out.foodName = body.foodName.trim();
  }

  if (!partial || "quantity" in body) {
    const quantity = parseQuantity(body.quantity);
    if (quantity === null) {
      return { error: "quantity must be a number greater than 0 and at most 10000." };
    }
    out.quantity = quantity;
  }

  if (!partial || "unit" in body) {
    if (!VALID_UNITS.includes(body.unit)) {
      return { error: `unit must be one of: ${VALID_UNITS.join(", ")}.` };
    }
    out.unit = body.unit;
  }

  if (!partial || "status" in body) {
    const status = body.status ?? "eaten";
    if (!VALID_FOOD_LOG_STATUSES.includes(status)) {
      return { error: "status must be eaten or not_eaten." };
    }
    out.status = status;
  }

  if ("category" in body) {
    if (
      body.category !== null &&
      (typeof body.category !== "string" || body.category.length > 60)
    ) {
      return { error: "category must be a string of at most 60 characters." };
    }
    out.category = body.category?.trim() || undefined;
  }

  return { value: out };
}

/** Resolve nutrient values from the client or the local catalog/heuristic. */
function resolveFoodLogNutrition(body, foodName, unit, categoryHint) {
  if (body.nutritionPerUnit !== undefined) {
    const manual = nutrition.sanitizeNutrition(body.nutritionPerUnit);
    if (!manual) {
      return {
        error: "nutritionPerUnit must contain numeric, non-negative nutrient values.",
      };
    }
    return {
      value: {
        nutritionPerUnit: manual,
        category: categoryHint || "General Food",
        nutritionSource: "manual",
      },
    };
  }

  const estimate = nutrition.estimateNutrition(foodName, unit);
  return {
    value: {
      nutritionPerUnit: estimate.nutritionPerUnit,
      category: categoryHint || estimate.category,
      nutritionSource: estimate.nutritionSource,
    },
  };
}

app.get("/food-log", requireAuth, (req, res) => {
  if (!userDataById.has(req.userId)) {
    return res.status(404).json({ error: "User data not found." });
  }
  const date = req.query.date === undefined ? currentDateKey() : String(req.query.date);
  if (!isValidDateKey(date)) {
    return res.status(400).json({ error: "date must be a valid YYYY-MM-DD date." });
  }
  res.json(buildFoodLogDay(req.userId, date));
});

app.post("/food-log", requireAuth, (req, res) => {
  const body = req.body ?? {};
  const parsed = parseFoodLogFields(body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  const value = parsed.value;
  const resolved = resolveFoodLogNutrition(body, value.foodName, value.unit, value.category);
  if (resolved.error) return res.status(400).json({ error: resolved.error });

  const log = foodLogFor(req.userId);
  if (!log) return res.status(404).json({ error: "User data not found." });

  const now = new Date().toISOString();
  const item = {
    id: `food_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ...value,
    ...resolved.value,
    createdAt: now,
    updatedAt: now,
  };
  log.push(item);
  persist();

  res.status(201).json({ item, day: buildFoodLogDay(req.userId, item.date) });
});

app.patch("/food-log/:id", requireAuth, (req, res) => {
  const log = foodLogFor(req.userId);
  if (!log) return res.status(404).json({ error: "User data not found." });
  const item = log.find((entry) => entry.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Food log item not found." });

  const body = req.body ?? {};
  const parsed = parseFoodLogFields(body, { partial: true });
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  const patch = parsed.value;
  const nextFoodName = patch.foodName ?? item.foodName;
  const nextUnit = patch.unit ?? item.unit;
  const identityChanged = nextFoodName !== item.foodName || nextUnit !== item.unit;
  const hasManualNutrition = body.nutritionPerUnit !== undefined;

  if (hasManualNutrition || identityChanged) {
    const categoryHint = identityChanged ? patch.category : (patch.category ?? item.category);
    const resolved = resolveFoodLogNutrition(body, nextFoodName, nextUnit, categoryHint);
    if (resolved.error) return res.status(400).json({ error: resolved.error });
    Object.assign(item, resolved.value);
  } else if (patch.category !== undefined) {
    item.category = patch.category;
  }

  for (const key of ["date", "meal", "foodName", "quantity", "unit", "status"]) {
    if (key in patch) item[key] = patch[key];
  }
  item.updatedAt = new Date().toISOString();
  persist();

  res.json({ item, day: buildFoodLogDay(req.userId, item.date) });
});

app.delete("/food-log/:id", requireAuth, (req, res) => {
  const log = foodLogFor(req.userId);
  if (!log) return res.status(404).json({ error: "User data not found." });
  const index = log.findIndex((entry) => entry.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: "Food log item not found." });

  const [removed] = log.splice(index, 1);
  persist();

  res.json({
    deleted: true,
    item: removed,
    day: buildFoodLogDay(req.userId, removed.date),
  });
});

// ─── Vision — food identification from an image ──────────────────────────────
// Priority: 1) explicit FOOD_VISION_API_URL proxy, 2) built-in AI layer, 3) clear error.
app.post("/vision/identify", requireAuth, aiLimiter, uploadSingleImage, async (req, res) => {
  const imagePath = req.file?.path;

  if (!imagePath) {
    return res.status(400).json({ error: "No image file received." });
  }

  // HEIC/HEIF (iPhone) is rejected by most vision providers. The client
  // normalizes to JPEG before upload — if one still arrives, fail fast with
  // an actionable message instead of burning a provider call.
  if (/heic|heif/i.test(req.file?.mimetype || "")) {
    safeUnlink(imagePath);
    return res.status(400).json({
      status: "failed",
      message:
        "This photo is in HEIC format (iPhone), which can't be analyzed. Please retake it as JPEG or pick a JPEG/PNG from your gallery.",
    });
  }

  try {
    // Option A: explicit external vision endpoint (legacy override).
    if (FOOD_VISION_API_URL) {
      const imageBuffer = fs.readFileSync(imagePath);
      const blob = new Blob([imageBuffer], { type: req.file.mimetype || "image/jpeg" });
      const form = new FormData();
      form.append("image", blob, "food.jpg");

      const response = await fetch(FOOD_VISION_API_URL, {
        method: "POST",
        body: form,
      });

      if (!response.ok) {
        return res.status(502).json({
          status: "failed",
          message:
            "The food recognition service returned an error. Try a clearer photo or search manually.",
        });
      }

      const data = await response.json();
      return res.json(data);
    }

    // Option B: built-in AI layer (Muse Spark / Gemini / OpenAI-compatible).
    if (!ai.isConfigured()) {
      return res.status(503).json({
        status: "not_configured",
        message:
          "Food image recognition is not configured. Set MUSE_SPARK_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY on the server, or use manual food search.",
      });
    }

    const imageBuffer = fs.readFileSync(imagePath);
    const result = await ai.identifyFood(imageBuffer, req.file.mimetype);
    return res.json(result);
  } catch (err) {
    console.error("Vision error:", err);
    return res.status(502).json({
      status: "failed",
      message:
        "We couldn't reach the food recognition service. Check your connection and try again.",
    });
  } finally {
    safeUnlink(imagePath);
  }
});

// ─── Vision (JSON) — same identification, base64 body, no multer ─────────────
app.post("/vision/identify-json", requireAuth, aiLimiter, async (req, res) => {
  const decoded = decodeImageJson(req.body);
  if (decoded.errStatus) return res.status(decoded.errStatus).json(decoded.errBody);

  try {
    if (!ai.isConfigured()) {
      return res.status(503).json({
        status: "not_configured",
        message:
          "Food image recognition is not configured. Set MUSE_SPARK_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY on the server, or use manual food search.",
      });
    }
    const result = await ai.identifyFood(decoded.buffer, decoded.mime);
    return res.json(result);
  } catch (err) {
    console.error("Vision (JSON) error:", err);
    return res.status(502).json({
      status: "failed",
      message:
        "We couldn't reach the food recognition service. Check your connection and try again.",
    });
  }
});

// ─── Nutrition analysis ───────────────────────────────────────────────────────
// The verdict is produced only by the deterministic engine in safety-engine.js.
// AI never supplies a status, nutrient value, or explanation here. The engine
// is shared with the mobile client so on-device fallback can never diverge.
app.post("/nutrition/analyze", requireAuth, apiLimiter, (req, res) => {
  const { foodName, condition, conditions, patient, identity } = req.body ?? {};
  if (typeof foodName !== "string" || !foodName.trim()) {
    return res.status(400).json({ error: "foodName is required." });
  }
  if (foodName.length > 160) {
    return res.status(400).json({ error: "foodName is too long." });
  }

  const rawConditions = Array.isArray(conditions) ? conditions : condition ? [condition] : [];
  const conditionList = [...new Set(rawConditions)].filter((c) => VALID_CONDITIONS.includes(c));
  if (conditionList.length === 0) {
    return res.status(400).json({ error: "At least one valid condition is required." });
  }

  // Only the fields the engine uses are forwarded. Free-text profile notes are
  // never logged or used for the verdict.
  const safePatient = {
    allergensList: Array.isArray(patient?.allergensList)
      ? patient.allergensList
          .filter((a) => typeof a === "string" && a.trim())
          .map((a) => a.trim().slice(0, 60))
          .slice(0, 20)
      : [],
  };

  const safeIdentity =
    identity && typeof identity === "object"
      ? {
          confirmed: identity.confirmed === true,
          source: typeof identity.source === "string" ? identity.source.slice(0, 20) : "text",
          confidence:
            typeof identity.confidence === "number" && Number.isFinite(identity.confidence)
              ? Math.min(1, Math.max(0, identity.confidence))
              : undefined,
        }
      : undefined;

  const analysis = safety.analyzeFood(foodName.trim(), conditionList, {
    patient: safePatient,
    identity: safeIdentity,
  });

  // Structured audit trail: enough to reproduce a decision, no medical free
  // text, no allergen values, no tokens. One JSON line per analysis.
  try {
    console.log(
      `[safety] ${JSON.stringify({
        event: "safety_analysis",
        analysisId: analysis.id,
        foodId: analysis.foodReference?.foodId ?? null,
        foodName: analysis.foodName,
        foodSource: analysis.foodReference?.sourceType ?? "unresolved",
        matchType: analysis.foodReference?.matchType ?? "none",
        conditions: analysis.conditions,
        serving: analysis.serving?.label ?? null,
        nutritionSource: analysis.foodReference?.source ?? null,
        ruleVersion: analysis.ruleVersion,
        outcomes: analysis.conditionOutcomes.map((o) => ({
          condition: o.condition,
          status: o.status,
          rules: o.evidence.map((e) => e.ruleId),
          gaps: o.missing.length,
        })),
        finalStatus: analysis.status,
        evidenceCount: analysis.evidence.length,
        dataGapCount: analysis.dataGaps.length,
        alternatives: analysis.alternatives.length,
        allergenScreenRun: conditionList.includes("allergy"),
      })}`
    );
  } catch (logErr) {
    console.warn("[safety] audit log failed:", logErr.message);
  }

  return res.json({ source: "rules-engine", analysis });
});

// ─── Prescription extraction — read a doctor's prescription/report photo ─────
app.post("/prescription/extract", requireAuth, aiLimiter, uploadSingleImage, async (req, res) => {
  const imagePath = req.file?.path;

  if (!imagePath) {
    return res.status(400).json({ error: "No image file received." });
  }

  if (/heic|heif/i.test(req.file?.mimetype || "")) {
    safeUnlink(imagePath);
    return res.status(400).json({
      status: "failed",
      message:
        "This photo is in HEIC format (iPhone), which can't be analyzed. Please retake it as JPEG or pick a JPEG/PNG from your gallery.",
    });
  }

  try {
    if (!ai.isConfigured()) {
      return res.status(503).json({
        status: "not_configured",
        message:
          "Prescription scanning needs an AI provider. Set MUSE_SPARK_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY on the server — or fill your health profile manually below.",
      });
    }

    const imageBuffer = fs.readFileSync(imagePath);
    const result = await ai.extractPrescription(imageBuffer, req.file.mimetype);
    return res.json(result);
  } catch (err) {
    console.error("Prescription extraction error:", err);
    return res.status(502).json({
      status: "failed",
      message:
        "We couldn't read the prescription right now. Try a clearer, well-lit photo or enter details manually.",
    });
  } finally {
    safeUnlink(imagePath);
  }
});

// ─── Prescription extraction (JSON) — base64 body, no multer ──────────────────
app.post("/prescription/extract-json", requireAuth, aiLimiter, async (req, res) => {
  const decoded = decodeImageJson(req.body);
  if (decoded.errStatus) return res.status(decoded.errStatus).json(decoded.errBody);

  try {
    if (!ai.isConfigured()) {
      return res.status(503).json({
        status: "not_configured",
        message:
          "Prescription scanning needs an AI provider. Set MUSE_SPARK_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY on the server — or fill your health profile manually below.",
      });
    }
    const result = await ai.extractPrescription(decoded.buffer, decoded.mime);
    return res.json(result);
  } catch (err) {
    console.error("Prescription extraction (JSON) error:", err);
    return res.status(502).json({
      status: "failed",
      message:
        "We couldn't read the prescription right now. Try a clearer, well-lit photo or enter details manually.",
    });
  }
});

// ─── Error handler ─────────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message ?? "Unexpected server error." });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`NutriSafe API server running on http://0.0.0.0:${PORT}`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(
    `  Data:    SQLite → ${process.env.NUTRISAFE_DB_FILE || path.join(__dirname, "data", "nutrisafe.db")}`
  );
  if (JWT_SECRET === JWT_DEV_FALLBACK && process.env.NODE_ENV === "production") {
    console.error("  ✗  Running with the default JWT_SECRET in production — set JWT_SECRET.");
  }
  if (FOOD_VISION_API_URL) {
    console.log(`  ✓  Vision proxy → ${FOOD_VISION_API_URL}`);
  } else if (ai.isConfigured()) {
    console.log(`  ✓  AI layer → ${ai.describeConfig()} (vision + nutrition analysis enabled)`);
  } else {
    console.log("  ⚠  No AI provider configured — set GEMINI_API_KEY or OPENAI_API_KEY.");
    console.log("     Scans will fail gracefully and nutrition checks use the local rules engine.");
  }
});
