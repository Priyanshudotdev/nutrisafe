/* End-to-end API tests for the deterministic safety engine.
 *
 * Starts the real server against a throwaway SQLite database with AI keys
 * removed, then verifies the public /nutrition/analyze contract and history
 * persistence. Run: node server/safety.e2e-test.js
 */

const { spawn } = require("child_process");
const http = require("http");
const net = require("net");
const os = require("os");
const path = require("path");

const JWT_SECRET = "safety-e2e-secret-0123456789abcdef";

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

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`✗ ${name}`);
    console.error(`  ${err.message}`);
  }
}

function assertOk(cond, label) {
  if (!cond) throw new Error(`Assertion failed: ${label}`);
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
  const dbFile = path.join(os.tmpdir(), `nutrisafe-safety-${Date.now()}-${port}.db`);
  const server = startServer(port, dbFile);

  try {
    await waitFor(`http://127.0.0.1:${port}/health`);
    console.log("✓ server up with throwaway database and no AI keys");

    const signup = await request(port, "POST", "/auth/signup", {
      email: `safety-${Date.now()}@test.com`,
      password: "password123",
      name: "Safety Tester",
    });
    assertOk(signup.status === 201 && signup.body.token, "signup");
    const auth = { Authorization: `Bearer ${signup.body.token}` };

    const unauth = await request(port, "POST", "/nutrition/analyze", {
      foodName: "Gulab jamun",
      conditions: ["diabetes"],
    });
    assertOk(unauth.status === 401, "nutrition analysis requires auth");

    // ── Critical regression 1 ──────────────────────────────────────────────
    const gulab = await request(
      port,
      "POST",
      "/nutrition/analyze",
      { foodName: "Gulab jamun", conditions: ["diabetes"] },
      auth
    );
    await test("API: gulab jamun + diabetes is Not Recommended with sugar evidence", () => {
      assertOk(gulab.status === 200, "status 200");
      assertOk(gulab.body.source === "rules-engine", "source is rules-engine");
      const a = gulab.body.analysis;
      assertOk(a.status === "not_recommended", "not_recommended");
      assertOk(a.statusHeadline === "Not Recommended", "headline");
      assertOk(a.ruleVersion === "2026.10.1", "rule version");
      assertOk(a.foodReference?.foodId === "gulab-jamun", "canonical food id");
      assertOk(a.serving?.label === "1 serving (100 g)", "serving basis");
      const sugar = a.evidence.find((e) => e.nutrient === "sugar");
      assertOk(sugar && sugar.value === 45 && sugar.unit === "g", "sugar evidence");
      assertOk(/45 g/.test(a.summary), "summary cites 45 g");
      assertOk(!/low glycemic|gi </i.test(a.detailedWhy), "no invented GI");
    });

    // ── Client-supplied verdicts are ignored ───────────────────────────────
    await test("API: client-supplied status/nutrients cannot override the engine", async () => {
      const res = await request(
        port,
        "POST",
        "/nutrition/analyze",
        {
          foodName: "Gulab jamun",
          conditions: ["diabetes"],
          status: "safe",
          analysis: { status: "safe", summary: "Low Glycemic Food" },
          nutrition: { sugar: 0, carbs: 0 },
        },
        auth
      );
      assertOk(res.status === 200, "status 200");
      assertOk(res.body.analysis.status === "not_recommended", "server verdict wins");
      assertOk(/low glycemic/i.test(res.body.analysis.summary) === false, "no injected summary");
    });

    // ── Critical regression 2 ──────────────────────────────────────────────
    await test("API: diabetes + hypertension both appear in the verdict", async () => {
      const res = await request(
        port,
        "POST",
        "/nutrition/analyze",
        { foodName: "Gulab jamun", conditions: ["diabetes", "hypertension"] },
        auth
      );
      const a = res.body.analysis;
      assertOk(res.status === 200, "status 200");
      assertOk(a.status === "not_recommended", "not_recommended");
      assertOk(a.conditionOutcomes.length === 2, "two condition outcomes");
      assertOk(
        a.conditionOutcomes.some((o) => o.condition === "diabetes") &&
          a.conditionOutcomes.some((o) => o.condition === "hypertension"),
        "both conditions present"
      );
    });

    // ── Critical regression 3 ──────────────────────────────────────────────
    await test("API: unknown food returns Unable to Verify, never safe", async () => {
      const res = await request(
        port,
        "POST",
        "/nutrition/analyze",
        { foodName: "Martian rock stew", conditions: ["diabetes"] },
        auth
      );
      const a = res.body.analysis;
      assertOk(res.status === 200, "status 200");
      assertOk(a.status === "unable_to_verify", "unable_to_verify");
      assertOk(a.statusHeadline === "Unable to Verify", "headline");
      assertOk(a.dataGaps.length > 0, "data gap explained");
      assertOk(a.serving === null, "no invented serving");
    });

    await test("API: unconfirmed identity returns Unable to Verify", async () => {
      const res = await request(
        port,
        "POST",
        "/nutrition/analyze",
        {
          foodName: "Gulab jamun",
          conditions: ["diabetes"],
          identity: { confirmed: false, source: "scan", confidence: 0.4 },
        },
        auth
      );
      assertOk(res.body.analysis.status === "unable_to_verify", "unable_to_verify");
    });

    // ── Critical regression 4 ──────────────────────────────────────────────
    await test("API: celiac + dairy allergy hard restrictions aggregate", async () => {
      const res = await request(
        port,
        "POST",
        "/nutrition/analyze",
        {
          foodName: "Gulab jamun",
          conditions: ["ckd", "celiac", "allergy"],
          patient: { allergensList: ["Dairy"], notes: "sensitive free text" },
        },
        auth
      );
      const a = res.body.analysis;
      assertOk(a.status === "not_recommended", "not_recommended");
      const celiac = a.conditionOutcomes.find((o) => o.condition === "celiac");
      const allergy = a.conditionOutcomes.find((o) => o.condition === "allergy");
      assertOk(celiac.status === "not_recommended", "celiac hard restriction");
      assertOk(allergy.status === "not_recommended", "allergy hard restriction");
      assertOk(
        !JSON.stringify(a).includes("sensitive free text"),
        "free-text notes are not echoed"
      );
    });

    // ── Validation / failure paths ─────────────────────────────────────────
    await test("API: invalid payloads are rejected with 400", async () => {
      const cases = [
        [{ conditions: ["diabetes"] }, "missing foodName"],
        [{ foodName: "   ", conditions: ["diabetes"] }, "blank foodName"],
        [{ foodName: "x".repeat(200), conditions: ["diabetes"] }, "oversized foodName"],
        [{ foodName: "Gulab jamun" }, "missing conditions"],
        [{ foodName: "Gulab jamun", conditions: ["not-a-condition"] }, "unknown condition"],
        [{ foodName: "Gulab jamun", conditions: "diabetes" }, "conditions not an array"],
      ];
      for (const [body, label] of cases) {
        const res = await request(port, "POST", "/nutrition/analyze", body, auth);
        assertOk(res.status === 400, `${label} → 400 (got ${res.status})`);
      }
    });

    await test("API: malformed allergen/identity fields are sanitized, not trusted", async () => {
      const res = await request(
        port,
        "POST",
        "/nutrition/analyze",
        {
          foodName: "Gulab jamun",
          conditions: ["allergy"],
          patient: { allergensList: [42, null, "  Dairy  ", ""] },
          identity: { confirmed: true, confidence: 99, source: 7 },
        },
        auth
      );
      assertOk(res.status === 200, "status 200");
      assertOk(res.body.analysis.status === "not_recommended", "dairy match still applies");
    });

    // ── History persistence ────────────────────────────────────────────────
    await test("API: saved history preserves the authoritative verdict and explanation", async () => {
      const a = gulab.body.analysis;
      const saved = await request(port, "POST", "/history", { analysis: a }, auth);
      assertOk(saved.status === 201, "POST /history 201");

      const list = await request(port, "GET", "/history", undefined, auth);
      assertOk(list.status === 200, "GET /history 200");
      const stored = list.body.history.find((h) => h.id === a.id);
      assertOk(stored, "history item exists");
      assertOk(stored.status === a.status, "status matches");
      assertOk(stored.statusHeadline === a.statusHeadline, "headline matches");
      assertOk(stored.summary === a.summary, "summary matches");
      assertOk(stored.ruleVersion === a.ruleVersion, "rule version retained");
      assertOk(Array.isArray(stored.evidence) && stored.evidence.length > 0, "evidence retained");
    });

    await test("API: history accepts unable_to_verify and rejects unknown statuses", async () => {
      const unable = {
        id: `unable-${Date.now()}`,
        foodName: "Unknown dish",
        status: "unable_to_verify",
        statusHeadline: "Unable to Verify",
        summary: "No reference composition found.",
      };
      const ok = await request(port, "POST", "/history", { analysis: unable }, auth);
      assertOk(ok.status === 201, "unable_to_verify accepted");

      const bad = await request(
        port,
        "POST",
        "/history",
        { analysis: { ...unable, id: "bad-status", status: "maybe" } },
        auth
      );
      assertOk(bad.status === 400, "unknown status rejected");
    });

    // ── Structured audit logging ───────────────────────────────────────────
    await test("API: [safety] audit line is structured and carries no medical free text", () => {
      const line = server.log.split(/\r?\n/).find((l) => l.startsWith("[safety] "));
      assertOk(line, "audit line emitted");
      const payload = JSON.parse(line.slice("[safety] ".length));
      assertOk(payload.event === "safety_analysis", "event name");
      assertOk(payload.ruleVersion === "2026.10.1", "rule version");
      assertOk(Array.isArray(payload.outcomes) && payload.outcomes.length > 0, "outcomes logged");
      assertOk(typeof payload.finalStatus === "string", "final status logged");
      assertOk(!/sensitive free text/i.test(line), "no profile free text");
      assertOk(!/"allergensList"|"dairy"/i.test(line), "no allergen list or values logged");
    });
  } catch (err) {
    failed += 1;
    console.error("✗ fatal:", err);
    console.error(server.log);
  } finally {
    await stopServer(server);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})();
