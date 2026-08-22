/* End-to-end AI integration test.
 * Starts a mock OpenAI-compatible provider + the NutriCheck server (with AI env),
 * then exercises /vision/identify and /nutrition/analyze for real.
 * Run: node server/ai.e2e-test.js
 */

const { spawn } = require("child_process");
const http = require("http");
const path = require("path");

const MOCK_PORT = 5001;
const API_PORT = 4002; // avoid clashing with any dev server on 4000

function waitFor(url, timeoutMs = 10_000) {
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
          else setTimeout(tick, 300);
        });
    };
    tick();
  });
}

function post(port, reqPath, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      { host: "localhost", port, path: reqPath, method: "POST", headers: { "Content-Type": "application/json", ...headers } },
      (res) => {
        let out = "";
        res.on("data", (c) => (out += c));
        res.on("end", () => resolve({ status: res.statusCode, body: out ? JSON.parse(out) : {} }));
      }
    );
    req.on("error", reject);
    req.end(data);
  });
}

// 1x1 red PNG
const PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

(async () => {
  // ── Mock OpenAI-compatible provider ──
  const mock = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const parsed = JSON.parse(body);
      const userContent = parsed.messages?.find((m) => m.role === "user")?.content;
      const textPart = Array.isArray(userContent)
        ? userContent.find((p) => p.type === "text")?.text ?? ""
        : userContent ?? "";
      const hasImage = Array.isArray(userContent) && userContent.some((p) => p.type === "image_url");

      let reply;
      if (hasImage) {
        reply = {
          foodName: "Margherita Pizza",
          confidence: 0.92,
          candidates: [
            { name: "Margherita Pizza", confidence: 0.92 },
            { name: "Cheese Pizza", confidence: 0.06 },
          ],
        };
      } else if (textPart.includes('Food: "Banana"')) {
        reply = {
          foodName: "Banana",
          category: "Fruit",
          status: "moderation",
          summary: "Banana is relatively high in potassium.",
          detailedWhy: "Potassium load warrants portion care for CKD patients.",
          factors: [{ name: "Potassium", level: "High", impact: "warning", detail: "~422mg" }],
          alternatives: [{ name: "Apple", reason: "Lower potassium", icon: "nutrition-outline" }],
          portionGuidance: "Half a banana max.",
        };
      } else {
        reply = { error: "unexpected prompt" };
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(reply) } }] }));
    });
  });
  await new Promise((r) => mock.listen(MOCK_PORT, r));
  console.log("✓ mock provider listening");

  // ── NutriCheck server with AI env ──
  const server = spawn(process.execPath, [path.join(__dirname, "index.js")], {
    env: {
      ...process.env,
      PORT: String(API_PORT),
      OPENAI_API_KEY: "test-key",
      OPENAI_BASE_URL: `http://localhost:${MOCK_PORT}/v1`,
      OPENAI_MODEL: "mock-model",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let serverLog = "";
  server.stdout.on("data", (d) => (serverLog += d));
  server.stderr.on("data", (d) => (serverLog += d));

  try {
    await waitFor(`http://localhost:${API_PORT}/health`);
    console.log("✓ NutriCheck server up with AI env");

    // Signup → token
    const signup = await post(API_PORT, "/auth/signup", {
      email: `e2e-${Date.now()}@test.com`,
      password: "password123",
      name: "E2E Tester",
    });
    assertOk(signup.status === 201 && signup.body.token, "signup");
    const auth = { Authorization: `Bearer ${signup.body.token}` };
    console.log("✓ signup");

    // Nutrition analyze via AI
    const nut = await post(
      API_PORT,
      "/nutrition/analyze",
      { foodName: "Banana", condition: "ckd", patient: { age: 32, allergensList: ["Peanuts"] } },
      auth
    );
    assertOk(nut.status === 200, "nutrition status");
    assertOk(nut.body.source === "ai", "nutrition source=ai");
    assertOk(nut.body.analysis?.foodName === "Banana", "nutrition foodName");
    assertOk(nut.body.analysis?.status === "moderation", "nutrition status value");
    assertOk(Array.isArray(nut.body.analysis?.factors) && nut.body.analysis.factors.length > 0, "factors");
    console.log("✓ /nutrition/analyze returns full AI analysis");
    console.log(`   → ${nut.body.analysis.statusHeadline}: ${nut.body.analysis.summary}`);

    // Vision identify via AI (multipart by hand)
    const boundary = "----nutrichecktest" + Date.now();
    const multipart = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="food.png"\r\nContent-Type: image/png\r\n\r\n`
    );
    const mpEnd = Buffer.from(`\r\n--${boundary}--\r\n`);
    const imgBuf = Buffer.from(PNG_B64, "base64");
    const bodyBuf = Buffer.concat([multipart, imgBuf, mpEnd]);

    const visionRes = await new Promise((resolve, reject) => {
      const req = http.request(
        {
          host: "localhost",
          port: API_PORT,
          path: "/vision/identify",
          method: "POST",
          headers: {
            ...auth,
            "Content-Type": `multipart/form-data; boundary=${boundary}`,
            "Content-Length": bodyBuf.length,
          },
        },
        (res) => {
          let out = "";
          res.on("data", (c) => (out += c));
          res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(out) }));
        }
      );
      req.on("error", reject);
      req.end(bodyBuf);
    });

    assertOk(visionRes.status === 200, "vision status");
    assertOk(visionRes.body.status === "success", "vision success");
    assertOk(visionRes.body.foodName === "Margherita Pizza", "vision foodName");
    assertOk(Math.abs(visionRes.body.confidence - 0.92) < 1e-9, "vision confidence");
    console.log("✓ /vision/identify identifies food via AI");
    console.log(`   → ${visionRes.body.foodName} (${Math.round(visionRes.body.confidence * 100)}% confidence)`);

    console.log("\nAll E2E AI tests passed.");
  } catch (err) {
    console.error("E2E TEST FAILED:", err.message);
    console.error("--- server log ---\n" + serverLog);
    process.exitCode = 1;
  } finally {
    server.kill();
    mock.close();
  }

  function assertOk(cond, label) {
    if (!cond) throw new Error(`Assertion failed: ${label}`);
  }
})();
