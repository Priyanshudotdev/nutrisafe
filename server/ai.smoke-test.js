/* Smoke test for server/ai.js with a mocked fetch — no API keys needed.
 * Run: node server/ai.smoke-test.js
 */

const assert = require("assert");
const ai = require("./ai");

let mockMode = "";
let mockResponse = null;
global.fetch = async () => {
  if (mockMode === "network-error") throw new Error("ECONNREFUSED");
  return {
    ok: mockResponse.ok,
    status: mockResponse.status ?? 200,
    text: async () => JSON.stringify(mockResponse.body ?? {}),
    json: async () => mockResponse.body ?? {},
  };
};

function setOpenAI(body) {
  mockMode = "openai";
  process.env.OPENAI_API_KEY = "test-key";
  delete process.env.GEMINI_API_KEY;
  mockResponse = { ok: true, body };
}

function setGemini(text) {
  mockMode = "gemini";
  process.env.GEMINI_API_KEY = "test-key";
  delete process.env.OPENAI_API_KEY;
  mockResponse = { ok: true, body: { candidates: [{ content: { parts: [{ text }] } }] } };
}

(async () => {
  // ── extractJson ──
  assert.deepStrictEqual(ai.extractJson('{"a":1}'), { a: 1 });
  assert.deepStrictEqual(ai.extractJson('Sure!\n```json\n{"a":1}\n```\nDone.'), { a: 1 });
  assert.deepStrictEqual(ai.extractJson('blah {"a":{"b":2}} blah'), { a: { b: 2 } });
  console.log("✓ extractJson handles plain / fenced / noisy responses");

  // ── provider resolution ──
  delete process.env.GEMINI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  assert.strictEqual(ai.isConfigured(), false);
  process.env.OPENAI_API_KEY = "k";
  assert.strictEqual(ai.isConfigured(), true);
  assert.ok(ai.describeConfig().includes("openai-compatible"));
  delete process.env.OPENAI_API_KEY;
  process.env.GEMINI_API_KEY = "k";
  assert.ok(ai.describeConfig().includes("gemini"));
  console.log("✓ provider detection (none / openai / gemini)");

  // ── identifyFood via OpenAI-compatible ──
  setOpenAI({
    choices: [{
      message: {
        content: JSON.stringify({
          foodName: "Margherita Pizza",
          confidence: 0.93,
          candidates: [
            { name: "Margherita Pizza", confidence: 0.93 },
            { name: "Cheese Pizza", confidence: 0.05 },
          ],
        }),
      },
    }],
  });
  let r = await ai.identifyFood(Buffer.from("fake"), "image/jpeg");
  assert.strictEqual(r.status, "success");
  assert.strictEqual(r.foodName, "Margherita Pizza");
  assert.strictEqual(r.candidates.length, 2);
  console.log("✓ identifyFood success path (OpenAI-compatible)");

  // no food detected
  setOpenAI({ choices: [{ message: { content: '{"foodName": null}' } }] });
  r = await ai.identifyFood(Buffer.from("fake"), "image/jpeg");
  assert.strictEqual(r.status, "failed");
  console.log("✓ identifyFood no-food path");

  // network failure → friendly AiError
  mockMode = "network-error";
  await assert.rejects(() => ai.identifyFood(Buffer.from("x"), "image/jpeg"), /reach the food recognition/);
  console.log("✓ identifyFood network error mapping");

  // ── identifyFood via Gemini ──
  setGemini('```json\n{"foodName":"Idli","confidence":0.88,"candidates":[{"name":"Idli","confidence":0.88}]}\n```');
  r = await ai.identifyFood(Buffer.from("fake"), "image/jpeg");
  assert.strictEqual(r.status, "success");
  assert.strictEqual(r.foodName, "Idli");
  console.log("✓ identifyFood success path (Gemini)");

  // ── analyzeNutrition + normalizeAnalysis ──
  setGemini(
    JSON.stringify({
      foodName: "Banana",
      category: "Fruit",
      status: "moderation",
      statusHeadline: "WRONG HEADLINE", // must be overridden by canonical headline
      summary: "High potassium.",
      detailedWhy: "Potassium load for CKD.",
      factors: [
        { name: "Potassium", level: "High", impact: "warning", detail: "~422mg" },
        { name: "Bad", level: "Nope", impact: "nope" }, // invalid → filtered/normalized
      ],
      alternatives: [{ name: "Apple", reason: "Low K", icon: "not-an-icon" }],
    })
  );
  const analysis = await ai.analyzeNutrition("banana", "ckd", { age: 32, allergensList: ["Peanuts"] });
  assert.strictEqual(analysis.status, "moderation");
  assert.strictEqual(analysis.statusHeadline, "Consume in Moderation");
  assert.strictEqual(analysis.condition, "ckd");
  assert.strictEqual(analysis.factors.length, 2);
  assert.strictEqual(analysis.factors[1].level, "Moderate"); // normalized
  assert.strictEqual(analysis.factors[1].impact, "neutral"); // normalized
  assert.strictEqual(analysis.alternatives[0].icon, "nutrition-outline"); // whitelisted
  console.log("✓ analyzeNutrition normalizes malformed AI output");

  // invalid condition rejected
  await assert.rejects(() => ai.analyzeNutrition("rice", "gout", {}), /Invalid medical condition/);
  console.log("✓ analyzeNutrition rejects unknown conditions");

  // OpenAI 400 → retry without response_format still works
  mockMode = "openai";
  delete process.env.GEMINI_API_KEY;
  process.env.OPENAI_API_KEY = "test-key";
  let callCount = 0;
  global.fetch = async (_url, options) => {
    callCount++;
    const body = JSON.parse(options.body);
    if (body.response_format && callCount === 1) {
      return { ok: false, status: 400, text: async () => "response_format unsupported", json: async () => ({}) };
    }
    return {
      ok: true,
      status: 200,
      text: async () => "",
      json: async () => ({
        choices: [{ message: { content: '{"foodName":"Dosa","confidence":0.9,"candidates":[]}' } }],
      }),
    };
  };
  r = await ai.identifyFood(Buffer.from("fake"), "image/jpeg");
  assert.strictEqual(callCount, 2);
  assert.strictEqual(r.foodName, "Dosa");
  console.log("✓ OpenAI-compatible retry without response_format");

  console.log("\nAll AI smoke tests passed.");
})().catch((err) => {
  console.error("SMOKE TEST FAILED:", err);
  process.exit(1);
});
