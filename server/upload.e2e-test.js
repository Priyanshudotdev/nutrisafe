/* NutriSafe — image upload end-to-end test (real network, real AI).
 *
 * Exercises the full multipart path a phone takes:
 *   signup → POST /vision/identify → POST /prescription/extract
 * using a RANDOM remote image (picsum), plus negative cases
 * (no token → 401, no file → 400).
 *
 * Usage:
 *   node server/upload.e2e-test.js                                  (local :4000)
 *   TARGET=https://nutrisafe-server.onrender.com node server/upload.e2e-test.js
 */
"use strict";

const assert = require("node:assert/strict");

const TARGET = (process.env.TARGET ?? "http://localhost:4000").replace(/\/$/, "");
const IMAGE_URL = `https://picsum.photos/seed/nutrisafe-${Date.now()}/1200/900`;

let failures = 0;
function check(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => console.log(`✓ ${name}`))
    .catch((err) => {
      failures += 1;
      console.error(`✗ ${name}\n  → ${err.message}`);
    });
}

async function downloadTestImage() {
  const res = await fetch(IMAGE_URL, { redirect: "follow" });
  assert.ok(res.ok, `image download failed: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  assert.ok(buf.length > 10_000, `suspiciously small image (${buf.length} bytes)`);
  const type = res.headers.get("content-type") ?? "image/jpeg";
  console.log(`  test image: ${buf.length} bytes (${type})`);
  return { buf, type: type.split(";")[0] };
}

async function signup() {
  const email = `uploadtest_${Date.now()}@example.com`;
  const res = await fetch(`${TARGET}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "password123", name: "Upload Test" }),
  });
  assert.equal(res.status, 201, `signup failed: HTTP ${res.status}`);
  const data = await res.json();
  assert.ok(data.token, "signup returned no token");
  return data.token;
}

async function postImage(path, token, { buf, type }, filename = "photo.jpg") {
  const form = new FormData();
  form.append("image", new Blob([buf], { type }), filename);
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const started = Date.now();
  const res = await fetch(`${TARGET}${path}`, { method: "POST", body: form, headers });
  const ms = Date.now() - started;
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body, ms };
}

(async () => {
  console.log(`Target: ${TARGET}`);
  const image = await downloadTestImage();
  const token = await signup();
  console.log("✓ signup");

  await check("POST /vision/identify → 200 + known status", async () => {
    const { status, body, ms } = await postImage("/vision/identify", token, image);
    console.log(`  → HTTP ${status} in ${ms}ms: ${JSON.stringify(body).slice(0, 160)}`);
    assert.equal(status, 200, `expected 200, got ${status}: ${JSON.stringify(body).slice(0, 200)}`);
    assert.ok(
      ["success", "uncertain", "failed", "not_configured"].includes(body.status),
      `unexpected status value: ${body.status}`
    );
  });

  await check("POST /prescription/extract → 200 + known status", async () => {
    const { status, body, ms } = await postImage("/prescription/extract", token, image);
    console.log(`  → HTTP ${status} in ${ms}ms: ${JSON.stringify(body).slice(0, 160)}`);
    assert.equal(status, 200, `expected 200, got ${status}: ${JSON.stringify(body).slice(0, 200)}`);
    assert.ok(
      ["success", "unreadable", "failed", "not_configured"].includes(body.status),
      `unexpected status value: ${body.status}`
    );
  });

  await check("POST /vision/identify without token → 401", async () => {
    const { status } = await postImage("/vision/identify", null, image);
    assert.equal(status, 401, `expected 401, got ${status}`);
  });

  await check("POST /vision/identify without file → 400", async () => {
    const res = await fetch(`${TARGET}/vision/identify`, {
      method: "POST",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 400, `expected 400, got ${res.status}`);
  });

  if (failures > 0) {
    console.error(`\n${failures} upload test(s) FAILED`);
    process.exit(1);
  }
  console.log("\nAll upload E2E tests passed.");
})().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
