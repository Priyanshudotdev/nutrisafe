/* End-to-end food-log test.
 * Starts the NutriSafe server against a throwaway SQLite database, then
 * exercises /food-log CRUD and verifies that daily totals only count items
 * marked "eaten", rescale with quantity, and survive a server restart.
 * Run: node server/foodlog.e2e-test.js
 */

const { spawn } = require("child_process");
const fs = require("fs");
const http = require("http");
const net = require("net");
const os = require("os");
const path = require("path");
const sqlite = require("node:sqlite");

const DAY = "2026-01-15";
const OTHER_DAY = "2026-01-16";
const JWT_SECRET = "foodlog-e2e-secret";

function getFreePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

function waitFor(url, timeoutMs = 15_000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      http
        .get(url, (res) => {
          res.resume();
          resolve();
        })
        .on("error", () => {
          if (Date.now() - start > timeoutMs) reject(new Error(`Timeout waiting for ${url}`));
          else setTimeout(tick, 250);
        });
    };
    tick();
  });
}

function request(port, method, reqPath, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path: reqPath,
        method,
        headers: {
          ...(payload ? { "Content-Type": "application/json" } : {}),
          ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
          ...headers,
        },
      },
      (res) => {
        let out = "";
        res.on("data", (chunk) => (out += chunk));
        res.on("end", () => {
          let parsed = {};
          try {
            parsed = out ? JSON.parse(out) : {};
          } catch {
            parsed = { raw: out };
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );
    req.on("error", reject);
    req.end(payload ?? undefined);
  });
}

function assertOk(cond, label) {
  if (!cond) throw new Error(`Assertion failed: ${label}`);
}

function assertClose(actual, expected, label, tolerance = 0.15) {
  assertOk(
    typeof actual === "number" && Math.abs(actual - expected) <= tolerance,
    `${label} (expected ≈${expected}, got ${actual})`
  );
}

function startServer(port, dbFile) {
  const childEnv = { ...process.env };
  delete childEnv.GEMINI_API_KEY;
  delete childEnv.OPENAI_API_KEY;
  const child = spawn(process.execPath, [path.join(__dirname, "index.js")], {
    env: {
      ...childEnv,
      PORT: String(port),
      NUTRISAFE_SKIP_ENV_FILE: "1",
      NUTRISAFE_DB_FILE: dbFile,
      JWT_SECRET,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const state = { child, log: "" };
  child.stdout.on("data", (d) => (state.log += d));
  child.stderr.on("data", (d) => (state.log += d));
  return state;
}

function stopServer(state) {
  return new Promise((resolve) => {
    if (state.child.exitCode !== null) return resolve();
    const timer = setTimeout(() => {
      state.child.kill("SIGKILL");
      resolve();
    }, 5_000);
    state.child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
    state.child.kill();
  });
}

(async () => {
  const port = await getFreePort();
  const dbFile = path.join(os.tmpdir(), `nutrisafe-foodlog-${Date.now()}-${port}.db`);
  let server = startServer(port, dbFile);

  try {
    await waitFor(`http://127.0.0.1:${port}/health`);
    console.log("✓ server up with throwaway database");

    // ── Auth ──
    const signup = await request(port, "POST", "/auth/signup", {
      email: `foodlog-${Date.now()}@test.com`,
      password: "password123",
      name: "Food Log Tester",
    });
    assertOk(signup.status === 201 && signup.body.token, "signup");
    const auth = { Authorization: `Bearer ${signup.body.token}` };
    console.log("✓ signup");

    const unauth = await request(port, "GET", `/food-log?date=${DAY}`);
    assertOk(unauth.status === 401, "food-log requires auth");

    // ── Empty day ──
    const empty = await request(port, "GET", `/food-log?date=${DAY}`, undefined, auth);
    assertOk(empty.status === 200, "GET empty day status");
    assertOk(empty.body.date === DAY, "GET echoes requested date");
    assertOk(Array.isArray(empty.body.items) && empty.body.items.length === 0, "empty items");
    assertOk(empty.body.summary?.eatenCount === 0, "empty eaten count");
    assertOk(empty.body.summary?.notEatenCount === 0, "empty not-eaten count");
    assertOk(empty.body.summary?.totals?.calories === 0, "empty calories");
    assertOk(Array.isArray(empty.body.days) && empty.body.days.length === 0, "empty recent days");
    console.log("✓ empty day returns zeroed summary");

    // ── Add an eaten item (catalog nutrition) ──
    const bananaRes = await request(
      port,
      "POST",
      "/food-log",
      {
        date: DAY,
        meal: "breakfast",
        foodName: "Banana",
        quantity: 1,
        unit: "piece",
        status: "eaten",
      },
      auth
    );
    assertOk(bananaRes.status === 201, "POST banana status");
    const banana = bananaRes.body.item;
    assertOk(banana.id, "banana has id");
    assertOk(banana.nutritionSource === "catalog", "banana nutrition source=catalog");
    assertOk(banana.category === "Fruit", "banana category");
    assertClose(banana.nutritionPerUnit?.calories, 105.02, "banana calories per piece");
    assertClose(banana.nutritionPerUnit?.potassium, 422.44, "banana potassium per piece");
    assertClose(bananaRes.body.day.summary.totals.calories, 105.02, "day calories after banana");
    assertOk(bananaRes.body.day.summary.eatenCount === 1, "eaten count=1");
    assertOk(bananaRes.body.day.summary.notEatenCount === 0, "not-eaten count=0");
    console.log("✓ eaten item adds catalog nutrition to the day");

    // ── Not-eaten item must not change totals ──
    const appleRes = await request(
      port,
      "POST",
      "/food-log",
      {
        date: DAY,
        meal: "snack",
        foodName: "Apple",
        quantity: 1,
        unit: "piece",
        status: "not_eaten",
      },
      auth
    );
    assertOk(appleRes.status === 201, "POST apple status");
    const apple = appleRes.body.item;
    assertOk(apple.status === "not_eaten", "apple saved as not_eaten");
    assertClose(appleRes.body.day.summary.totals.calories, 105.02, "not-eaten apple excluded");
    assertOk(appleRes.body.day.summary.eatenCount === 1, "eaten count still 1");
    assertOk(appleRes.body.day.summary.notEatenCount === 1, "not-eaten count=1");
    assertOk(appleRes.body.day.items.length === 2, "both items returned");
    console.log("✓ not-eaten item is stored but excluded from totals");

    // ── Nutrition summary exposes every tracked nutrient ──
    const totals = appleRes.body.day.summary.totals;
    for (const key of [
      "calories",
      "protein",
      "carbs",
      "fat",
      "fiber",
      "sugar",
      "sodium",
      "potassium",
      "phosphorus",
      "saturatedFat",
      "cholesterol",
    ]) {
      assertOk(typeof totals[key] === "number", `totals.${key} is numeric`);
    }
    console.log("✓ summary includes all tracked nutrients");

    // ── Status toggle recalculates ──
    const eaten = await request(port, "PATCH", `/food-log/${apple.id}`, { status: "eaten" }, auth);
    assertOk(eaten.status === 200, "PATCH status→eaten");
    assertOk(eaten.body.item.status === "eaten", "item status updated");
    assertClose(eaten.body.day.summary.totals.calories, 199.66, "toggle recalculates totals");
    assertOk(eaten.body.day.summary.eatenCount === 2, "eaten count=2");
    assertOk(eaten.body.day.summary.notEatenCount === 0, "not-eaten count=0");

    const uneaten = await request(
      port,
      "PATCH",
      `/food-log/${apple.id}`,
      { status: "not_eaten" },
      auth
    );
    assertOk(uneaten.status === 200, "PATCH status→not_eaten");
    assertClose(
      uneaten.body.day.summary.totals.calories,
      105.02,
      "reverting status reverts totals"
    );
    console.log("✓ status toggle recalculates the daily report both ways");

    // ── Quantity scaling ──
    const doubled = await request(port, "PATCH", `/food-log/${banana.id}`, { quantity: 2 }, auth);
    assertOk(doubled.status === 200, "PATCH quantity");
    assertClose(doubled.body.item.nutritionPerUnit.calories, 105.02, "per-unit value is stable");
    assertClose(doubled.body.day.summary.totals.calories, 210.04, "totals scale with quantity");
    console.log("✓ quantity change rescales totals without mutating per-unit data");

    // ── Date isolation + recent days ──
    const otherPost = await request(
      port,
      "POST",
      "/food-log",
      {
        date: OTHER_DAY,
        meal: "lunch",
        foodName: "Oats",
        quantity: 100,
        unit: "g",
        status: "eaten",
      },
      auth
    );
    assertOk(otherPost.status === 201, "POST other day");
    const otherDay = await request(port, "GET", `/food-log?date=${OTHER_DAY}`, undefined, auth);
    assertOk(otherDay.body.items.length === 1, "other day has its own item");
    assertOk(otherDay.body.items[0].id === otherPost.body.item.id, "other day item id");
    const dayAgain = await request(port, "GET", `/food-log?date=${DAY}`, undefined, auth);
    assertOk(dayAgain.body.items.length === 2, "original day still has 2 items");
    assertClose(dayAgain.body.summary.totals.calories, 210.04, "original day totals unchanged");
    assertOk(dayAgain.body.days.length === 2, "recent days lists both dates");
    assertOk(dayAgain.body.days[0].date === OTHER_DAY, "recent days sorted newest first");
    assertClose(dayAgain.body.days[1].calories, 210.04, "recent day calories match");
    console.log("✓ dates are isolated and recent days are listed newest first");

    // ── Validation ──
    const badCases = [
      ["missing foodName", { date: DAY, meal: "lunch", quantity: 1, unit: "g" }],
      ["zero quantity", { date: DAY, meal: "lunch", foodName: "Rice", quantity: 0, unit: "g" }],
      ["unknown unit", { date: DAY, meal: "lunch", foodName: "Rice", quantity: 1, unit: "lb" }],
      [
        "unknown status",
        { date: DAY, meal: "lunch", foodName: "Rice", quantity: 1, unit: "g", status: "maybe" },
      ],
      ["bad meal", { date: DAY, meal: "brunch", foodName: "Rice", quantity: 1, unit: "g" }],
      ["bad date", { date: "15-01-2026", meal: "lunch", foodName: "Rice", quantity: 1, unit: "g" }],
      [
        "bad manual nutrition",
        {
          date: DAY,
          meal: "lunch",
          foodName: "Rice",
          quantity: 1,
          unit: "g",
          nutritionPerUnit: { calories: "lots" },
        },
      ],
    ];
    for (const [label, payload] of badCases) {
      const res = await request(port, "POST", "/food-log", payload, auth);
      assertOk(res.status === 400, `POST ${label} → 400 (got ${res.status})`);
    }
    const badQuery = await request(port, "GET", "/food-log?date=tomorrow", undefined, auth);
    assertOk(badQuery.status === 400, "GET invalid date → 400");
    const missingItem = await request(
      port,
      "PATCH",
      "/food-log/food_missing",
      { status: "eaten" },
      auth
    );
    assertOk(missingItem.status === 404, "PATCH unknown item → 404");
    const missingDelete = await request(port, "DELETE", "/food-log/food_missing", undefined, auth);
    assertOk(missingDelete.status === 404, "DELETE unknown item → 404");
    console.log("✓ invalid payloads and unknown ids are rejected");

    // ── Delete ──
    const removed = await request(port, "DELETE", `/food-log/${apple.id}`, undefined, auth);
    assertOk(removed.status === 200 && removed.body.deleted === true, "DELETE apple");
    assertOk(removed.body.day.items.length === 1, "day has one item after delete");
    assertClose(removed.body.day.summary.totals.calories, 210.04, "totals after delete");
    assertOk(removed.body.day.summary.notEatenCount === 0, "not-eaten count after delete");
    console.log("✓ delete removes the item and recalculates");

    // ── Persistence across restart ──
    await stopServer(server);
    server = startServer(port, dbFile);
    await waitFor(`http://127.0.0.1:${port}/health`);
    const reloaded = await request(port, "GET", `/food-log?date=${DAY}`, undefined, auth);
    assertOk(reloaded.status === 200, "GET after restart");
    assertOk(reloaded.body.items.length === 1, "item persisted across restart");
    assertOk(reloaded.body.items[0].id === banana.id, "persisted item id matches");
    assertOk(
      reloaded.body.items[0].nutritionSource === "catalog",
      "nutritionSource persisted across restart"
    );
    assertClose(reloaded.body.summary.totals.calories, 210.04, "persisted totals");
    console.log("✓ food log persists in SQLite across a server restart");

    // ── Legacy schema migration (food_log without nutritionSource) ──
    const legacyDb = path.join(os.tmpdir(), `nutrisafe-foodlog-legacy-${Date.now()}.db`);
    const legacySql = new sqlite.DatabaseSync(legacyDb);
    legacySql.exec(`
      CREATE TABLE food_log (
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
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
    `);
    legacySql.close();

    const legacyPort = await getFreePort();
    const legacyState = startServer(legacyPort, legacyDb);
    try {
      await waitFor(`http://127.0.0.1:${legacyPort}/health`);
      const legacySignup = await request(legacyPort, "POST", "/auth/signup", {
        email: `legacy-${Date.now()}@test.com`,
        password: "password123",
        name: "Legacy Tester",
      });
      assertOk(legacySignup.status === 201, "legacy signup");
      const legacyAuth = { Authorization: `Bearer ${legacySignup.body.token}` };
      const legacyPost = await request(
        legacyPort,
        "POST",
        "/food-log",
        { date: DAY, meal: "lunch", foodName: "Banana", quantity: 1, unit: "piece" },
        legacyAuth
      );
      assertOk(legacyPost.status === 201, "legacy schema accepts new items");
      assertOk(legacyPost.body.item.nutritionSource === "catalog", "legacy schema item nutrition");
      console.log("✓ legacy food_log schema migrates in place");
    } finally {
      await stopServer(legacyState);
      for (const suffix of ["", "-wal", "-shm"]) {
        fs.rmSync(`${legacyDb}${suffix}`, { force: true });
      }
    }

    console.log("\nAll food-log E2E tests passed.");
  } catch (err) {
    console.error("FOOD-LOG E2E TEST FAILED:", err.message);
    console.error("--- server log ---\n" + server.log);
    process.exitCode = 1;
  } finally {
    await stopServer(server);
    for (const suffix of ["", "-wal", "-shm"]) {
      fs.rmSync(`${dbFile}${suffix}`, { force: true });
    }
  }
})();
