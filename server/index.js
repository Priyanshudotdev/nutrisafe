/* NutriCheck — local API server
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
const store = require("./store");

// ─── Local env files ─────────────────────────────────────────────────────────
// Plain `node` doesn't inject Expo's .env.local — load it (and .env) here so
// GEMINI_API_KEY / OPENAI_* / PORT / JWT_SECRET just work. Real environment
// variables always win; values already set are never overwritten.
// Set NUTRICHECK_SKIP_ENV_FILE=1 to disable (used by hermetic tests).
// Robust loader: handles \r, `export KEY=`, quoted values with # inside,
// and skips multiline values (best-effort, no dep).
if (process.env.NUTRICHECK_SKIP_ENV_FILE !== "1") {
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
const JWT_DEV_FALLBACK = "nutricheck-dev-secret-change-in-prod";
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const _envJwt = process.env.JWT_SECRET;
if (IS_PRODUCTION) {
  if (! _envJwt || _envJwt === JWT_DEV_FALLBACK || _envJwt.length < 32) {
    console.error(
      "FATAL: JWT_SECRET must be set to a strong value (>=32 chars) in production. Refusing to boot."
    );
    process.exit(1);
  }
} else if (! _envJwt || _envJwt === JWT_DEV_FALLBACK) {
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
app.use("/auth", authLimiter);

// ─── Auth helpers ──────────────────────────────────────────────────────────────
function signToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
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
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: "email, password and name are required." });
  }
  if (usersByEmail.has(email.toLowerCase())) {
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
    email: email.toLowerCase(),
    city: null,
    primaryCondition: "ckd",
    allergensList: [],
    notes: "",
    doctorName: null,
    onboardingCompleted: false,
  };

  const user = { id, email: email.toLowerCase(), passwordHash, profile, createdAt: new Date().toISOString() };
  usersByEmail.set(email.toLowerCase(), user);
  userDataById.set(id, { history: [] });
  persist();

  const token = signToken(id);
  return res.status(201).json({ token, profile });
});

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required." });
  }

  const user = usersByEmail.get(email.toLowerCase());
  if (!user) return res.status(401).json({ error: "Incorrect email or password." });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Incorrect email or password." });

  const token = signToken(user.id);
  return res.json({ token, profile: user.profile });
});

app.post("/auth/logout", requireAuth, (_req, res) => {
  // JWTs are stateless; client discards token.  For a blacklist, store token IDs in a Set here.
  res.json({ message: "Logged out." });
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
  persist();
  res.json({ message: "Password updated." });
});

app.post("/auth/change-email", requireAuth, async (req, res) => {
  const { newEmail, password } = req.body;
  if (!newEmail || !password) {
    return res.status(400).json({ error: "newEmail and password are required." });
  }
  if (usersByEmail.has(newEmail.toLowerCase())) {
    return res.status(409).json({ error: "This email is already in use." });
  }

  const user = findUserById(req.userId);
  if (!user) return res.status(404).json({ error: "User not found." });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Password is incorrect." });

  usersByEmail.delete(user.email);
  user.email = newEmail.toLowerCase();
  user.profile.email = newEmail.toLowerCase();
  usersByEmail.set(user.email, user);
  persist();

  res.json({ message: "Email updated.", profile: user.profile });
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
    if (v !== null && v !== undefined && v !== "") {
      if (typeof v === "boolean" || (typeof v === "object" && v !== null) || Array.isArray(v)) {
        return res.status(400).json({ error: "age must be a number between 1 and 120." });
      }
      const n = Number(v);
      if (!Number.isFinite(n) || n < 1 || n > 120) {
        return res.status(400).json({ error: "age must be a number between 1 and 120." });
      }
    } else if (v !== null && v !== undefined && v !== "") {
      return res.status(400).json({ error: "age must be a number between 1 and 120." });
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
  for (const [key, max] of [["gender", 50], ["city", 100], ["notes", 1000], ["doctorName", 100]]) {
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
      return res.status(400).json({ error: "conditions must contain at least one valid condition." });
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

  const { age, gender, city, conditions, primaryCondition, allergensList, notes, doctorName } = req.body;

  // Accept a multi-select list of conditions; fall back to the single legacy field.
  let conditionList = Array.isArray(conditions)
    ? [...new Set(conditions)]
    : primaryCondition
      ? [primaryCondition]
      : [];
  conditionList = conditionList.filter((c) => VALID_CONDITIONS.includes(c));

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
  const limit = Math.min(Math.max(Number.isNaN(rawLimit) ? HISTORY_PAGE_DEFAULT : rawLimit, 1), HISTORY_PAGE_MAX);
  res.json({ history: history.slice(0, limit) });
});

const VALID_STATUSES = ["safe", "moderation", "not_recommended"];

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
    return res.status(400).json({ error: "analysis.status must be safe, moderation or not_recommended." });
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

// ─── Vision — food identification from an image ──────────────────────────────
// Priority: 1) explicit FOOD_VISION_API_URL proxy, 2) built-in AI layer, 3) clear error.
app.post("/vision/identify", requireAuth, aiLimiter, uploadSingleImage, async (req, res) => {
  const imagePath = req.file?.path;

  if (!imagePath) {
    return res.status(400).json({ error: "No image file received." });
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
          message: "The food recognition service returned an error. Try a clearer photo or search manually.",
        });
      }

      const data = await response.json();
      return res.json(data);
    }

    // Option B: built-in AI layer (Gemini / OpenAI-compatible).
    if (!ai.isConfigured()) {
      return res.status(503).json({
        status: "not_configured",
        message:
          "Food image recognition is not configured. Set GEMINI_API_KEY or OPENAI_API_KEY on the server, or use manual food search.",
      });
    }

    const imageBuffer = fs.readFileSync(imagePath);
    const result = await ai.identifyFood(imageBuffer, req.file.mimetype);
    return res.json(result);
  } catch (err) {
    console.error("Vision error:", err);
    return res.status(502).json({
      status: "failed",
      message: "We couldn't reach the food recognition service. Check your connection and try again.",
    });
  } finally {
    if (imagePath && fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
  }
});

// ─── Nutrition analysis ───────────────────────────────────────────────────────
// With an AI provider configured this returns a full structured analysis
// ({ source: "ai", analysis }) evaluated against ALL of the patient's
// conditions (worst-case verdict). Without one it signals the client to use
// the deterministic rules engine in src/data/foodSafety.ts.
app.post("/nutrition/analyze", requireAuth, aiLimiter, async (req, res) => {
  const { foodName, condition, conditions, patient } = req.body;
  if (!foodName || (!conditions && !condition)) {
    return res.status(400).json({ error: "foodName and condition(s) are required." });
  }

  if (!ai.isConfigured()) {
    return res.json({
      source: "local-rules-engine",
      message:
        "No AI provider configured. Set GEMINI_API_KEY or OPENAI_API_KEY to enable AI analysis; the app will use its local clinical rules engine.",
    });
  }

  const conditionList = Array.isArray(conditions) ? conditions : [condition];
  try {
    const analysis = await ai.analyzeNutrition(String(foodName), conditionList, patient);
    return res.json({ source: "ai", analysis });
  } catch (err) {
    console.error("Nutrition AI error:", err);
    if (err.code === "invalid_condition") {
      return res.status(400).json({ error: err.message });
    }
    return res.status(502).json({
      source: "ai_failed",
      message: "The AI analysis service returned an error. The app will fall back to its local rules engine.",
    });
  }
});

// ─── Prescription extraction — read a doctor's prescription/report photo ─────
app.post("/prescription/extract", requireAuth, aiLimiter, uploadSingleImage, async (req, res) => {
  const imagePath = req.file?.path;

  if (!imagePath) {
    return res.status(400).json({ error: "No image file received." });
  }

  try {
    if (!ai.isConfigured()) {
      return res.status(503).json({
        status: "not_configured",
        message:
          "Prescription scanning needs an AI provider. Set GEMINI_API_KEY or OPENAI_API_KEY on the server — or fill your health profile manually below.",
      });
    }

    const imageBuffer = fs.readFileSync(imagePath);
    const result = await ai.extractPrescription(imageBuffer, req.file.mimetype);
    return res.json(result);
  } catch (err) {
    console.error("Prescription extraction error:", err);
    return res.status(502).json({
      status: "failed",
      message: "We couldn't read the prescription right now. Try a clearer, well-lit photo or enter details manually.",
    });
  } finally {
    if (imagePath && fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
  }
});

// ─── Error handler ─────────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message ?? "Unexpected server error." });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`NutriCheck API server running on http://0.0.0.0:${PORT}`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Data:    SQLite → ${process.env.NUTRICHECK_DB_FILE || path.join(__dirname, "data", "nutricheck.db")}`);
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
