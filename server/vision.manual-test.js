/* NutriSafe — manual image test (real server, your own photo).
 *
 * Exercises the upload + AI routes exactly like the mobile app does:
 *   signup → GET /health → POST /vision/identify-json → POST /vision/identify
 *   → POST /nutrition/analyze → (optional --rx: both prescription routes)
 *   → negative: no token → 401
 *
 * Usage:
 *   IMAGE="C:\\path\\to\\food.jpg" TARGET=https://nutrisafe-server.onrender.com node server/vision.manual-test.js [--rx]
 *   TARGET defaults to http://localhost:4000. IMAGE may also be passed as
 *   argv[2]. Prints timings + truncated bodies, exits 1 on any failure.
 *   Never logs base64 payloads or tokens.
 */
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const TARGET = (process.env.TARGET ?? "http://localhost:4000").replace(/\/$/, "");
const IMAGE = process.env.IMAGE ?? process.argv[2] ?? "";
const WITH_RX = process.argv.includes("--rx");

const MIME_BY_EXT = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

let failures = 0;
async function check(name, fn) {
  const started = Date.now();
  try {
    const extra = await fn();
    console.log(`✓ ${name} (${Date.now() - started}ms)${extra ? ` ${extra}` : ""}`);
  } catch (err) {
    failures += 1;
    console.error(`✗ ${name}\n  → ${err.message}`);
  }
}

function short(obj, n = 220) {
  return JSON.stringify(obj).slice(0, n);
}

async function main() {
  assert.ok(IMAGE, "Set IMAGE env (or argv[2]) to a local .jpg/.png/.webp photo.");
  assert.ok(fs.existsSync(IMAGE), `Image not found: ${IMAGE}`);
  const buf = fs.readFileSync(IMAGE);
  assert.ok(buf.length > 100, `Image suspiciously small (${buf.length} bytes).`);
  const mime = MIME_BY_EXT[path.extname(IMAGE).toLowerCase()] ?? "image/jpeg";
  console.log(`Target: ${TARGET}`);
  console.log(`Image: ${IMAGE} (${buf.length} bytes, ${mime})`);

  // 1. provider proof
  await check("GET /health shows AI provider", async () => {
    const res = await fetch(`${TARGET}/health`);
    assert.equal(res.status, 200, `HTTP ${res.status}`);
    const body = await res.json();
    return `ai=${body.ai}`;
  });

  // 2. auth (throwaway account, like the app signup)
  const email = `manualtest_${Date.now()}@example.com`;
  const signup = await fetch(`${TARGET}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "password123", name: "Manual Test" }),
  });
  assert.equal(signup.status, 201, `signup failed: HTTP ${signup.status}`);
  const { token } = await signup.json();
  assert.ok(token, "signup returned no token");
  const auth = { Authorization: `Bearer ${token}` };
  console.log("✓ signup (throwaway account)");

  const base64 = buf.toString("base64");

  // 3. JSON upload path (preferred mobile path)
  await check("POST /vision/identify-json", async () => {
    const res = await fetch(`${TARGET}/vision/identify-json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...auth },
      body: JSON.stringify({ imageBase64: base64, mime }),
    });
    const body = await res.json().catch(() => ({}));
    assert.equal(res.status, 200, `HTTP ${res.status}: ${short(body)}`);
    assert.ok(
      ["success", "failed"].includes(body.status),
      `unexpected status: ${short(body)}`
    );
    return short(body);
  });

  // 4. multipart path (legacy fallback)
  await check("POST /vision/identify (multipart)", async () => {
    const form = new FormData();
    form.append("image", new Blob([buf], { type: mime }), `photo${path.extname(IMAGE) || ".jpg"}`);
    const res = await fetch(`${TARGET}/vision/identify`, {
      method: "POST",
      headers: { Accept: "application/json", ...auth },
      body: form,
    });
    const body = await res.json().catch(() => ({}));
    assert.equal(res.status, 200, `HTTP ${res.status}: ${short(body)}`);
    return short(body);
  });

  // 5. analysis route (text check, like manual search in the app)
  await check("POST /nutrition/analyze (Banana + ckd)", async () => {
    const res = await fetch(`${TARGET}/nutrition/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...auth },
      body: JSON.stringify({ foodName: "Banana", condition: "ckd" }),
    });
    const body = await res.json().catch(() => ({}));
    assert.equal(res.status, 200, `HTTP ${res.status}: ${short(body)}`);
    assert.ok(["ai", "local-rules-engine"].includes(body.source), `source=${body.source}`);
    return `source=${body.source} status=${body.analysis?.status ?? body.source}`;
  });

  if (WITH_RX) {
    await check("POST /prescription/extract-json", async () => {
      const res = await fetch(`${TARGET}/prescription/extract-json`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", ...auth },
        body: JSON.stringify({ imageBase64: base64, mime }),
      });
      const body = await res.json().catch(() => ({}));
      assert.equal(res.status, 200, `HTTP ${res.status}: ${short(body)}`);
      return short(body);
    });
  }

  // 6. negative: auth layer
  await check("POST /vision/identify-json without token → 401", async () => {
    const res = await fetch(`${TARGET}/vision/identify-json`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64: base64, mime }),
    });
    assert.equal(res.status, 401, `expected 401, got ${res.status}`);
  });

  if (failures > 0) {
    console.error(`\n${failures} manual test(s) FAILED`);
    process.exit(1);
  }
  console.log("\nAll manual image tests passed.");
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
