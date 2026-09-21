/* Smoke test for server/ai.js with mocked providers — no API keys needed.
 * OpenAI-compatible path mocks global.fetch; Gemini path (official
 * @google/genai SDK) uses ai._setGeminiOverride to avoid network access.
 * Run: node server/ai.smoke-test.js
 */

const assert = require("assert");
const ai = require("./ai");

let mockMode = "";
let mockResponse = null;
let lastUrl = "";
let lastOptions = null;
function installRecorder() {
  global.fetch = async (url, options) => {
    lastUrl = String(url);
    lastOptions = options;
    if (mockMode === "network-error") throw new Error("ECONNREFUSED");
    return {
      ok: mockResponse.ok,
      status: mockResponse.status ?? 200,
      text: async () => JSON.stringify(mockResponse.body ?? {}),
      json: async () => mockResponse.body ?? {},
    };
  };
}
installRecorder();

function setOpenAI(body) {
  mockMode = "openai";
  installRecorder();
  process.env.OPENAI_API_KEY = "test-key";
  delete process.env.GEMINI_API_KEY;
  delete process.env.MUSE_SPARK_API_KEY;
  ai._setGeminiOverride(null);
  mockResponse = { ok: true, body };
}

function setMuse(body) {
  mockMode = "muse";
  installRecorder();
  process.env.MUSE_SPARK_API_KEY = "test-key";
  delete process.env.GEMINI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.MUSE_SPARK_MODEL;
  delete process.env.MUSE_SPARK_BASE_URL;
  ai._setGeminiOverride(null);
  mockResponse = { ok: true, body };
}

let lastGeminiArgs = null;
function setGemini(text) {
  mockMode = "gemini";
  process.env.GEMINI_API_KEY = "test-key";
  delete process.env.OPENAI_API_KEY;
  delete process.env.MUSE_SPARK_API_KEY;
  lastGeminiArgs = null;
  ai._setGeminiOverride(async (args) => {
    lastGeminiArgs = args;
    return text;
  });
}

(async () => {
  // ── extractJson ──
  assert.deepStrictEqual(ai.extractJson('{"a":1}'), { a: 1 });
  assert.deepStrictEqual(ai.extractJson('Sure!\n```json\n{"a":1}\n```\nDone.'), { a: 1 });
  assert.deepStrictEqual(ai.extractJson('blah {"a":{"b":2}} blah'), { a: { b: 2 } });
  console.log("✓ extractJson handles plain / fenced / noisy responses");

  // invalid JSON must throw AiError (not raw SyntaxError)
  await assert.rejects(
    () => Promise.resolve().then(() => ai.extractJson('{"a":}')),
    (err) => {
      assert.strictEqual(err.name, "AiError");
      assert.match(err.message, /did not contain valid JSON/);
      return true;
    }
  );
  await assert.rejects(
    () => Promise.resolve().then(() => ai.extractJson('```json\n{"a":}\n```')),
    (err) => {
      assert.strictEqual(err.name, "AiError");
      return true;
    }
  );
  console.log("✓ extractJson invalid JSON throws AiError");

  // ── provider resolution ──
  delete process.env.GEMINI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.MUSE_SPARK_API_KEY;
  assert.strictEqual(ai.isConfigured(), false);
  process.env.OPENAI_API_KEY = "k";
  assert.strictEqual(ai.isConfigured(), true);
  assert.ok(ai.describeConfig().includes("openai-compatible"));
  delete process.env.OPENAI_API_KEY;
  process.env.GEMINI_API_KEY = "k";
  assert.ok(ai.describeConfig().includes("gemini"));
  delete process.env.GEMINI_API_KEY;
  process.env.MUSE_SPARK_API_KEY = "k";
  assert.strictEqual(ai.isConfigured(), true);
  assert.ok(ai.describeConfig().includes("muse-spark"));
  // First match wins: muse beats gemini + openai when all are set.
  process.env.GEMINI_API_KEY = "k";
  process.env.OPENAI_API_KEY = "k";
  assert.ok(ai.describeConfig().includes("muse-spark"));
  delete process.env.GEMINI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.MUSE_SPARK_API_KEY;
  console.log("✓ provider detection (none / openai / gemini / muse + priority)");

  // ── identifyFood via OpenAI-compatible ──
  setOpenAI({
    choices: [
      {
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
      },
    ],
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
  await assert.rejects(
    () => ai.identifyFood(Buffer.from("x"), "image/jpeg"),
    /reach the food recognition/
  );
  console.log("✓ identifyFood network error mapping");

  // ── identifyFood via Gemini ──
  setGemini(
    '```json\n{"foodName":"Idli","confidence":0.88,"candidates":[{"name":"Idli","confidence":0.88}]}\n```'
  );
  r = await ai.identifyFood(Buffer.from("fake"), "image/jpeg");
  assert.strictEqual(r.status, "success");
  assert.strictEqual(r.foodName, "Idli");
  console.log("✓ identifyFood success path (Gemini SDK)");

  // SDK must receive camelCase inlineData/mimeType — snake_case
  // inline_data/mime_type was the P0 400 bug. The SDK also keeps the key
  // out of the URL entirely (apiKey passed to the client, not query).
  {
    assert.ok(lastGeminiArgs, "Gemini override must have been called");
    assert.ok(
      typeof lastGeminiArgs.model === "string" && lastGeminiArgs.model.length > 0,
      "Gemini model id must be set"
    );
    const userParts = lastGeminiArgs.parts ?? [];
    const imgPart = userParts.find((p) => p.inlineData);
    assert.ok(imgPart, "Gemini vision parts must contain inlineData");
    assert.strictEqual(imgPart.inlineData.mimeType, "image/jpeg");
    assert.ok(typeof imgPart.inlineData.data === "string" && imgPart.inlineData.data.length > 0);
    assert.ok(
      !userParts.some((p) => p.inline_data),
      "Gemini parts must not use snake_case inline_data"
    );
    console.log("✓ Gemini SDK vision uses inlineData.mimeType (not inline_data.mime_type)");
  }

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
  const analysis = await ai.analyzeNutrition("banana", "ckd", {
    age: 32,
    allergensList: ["Peanuts"],
  });
  assert.strictEqual(analysis.status, "moderation");
  assert.strictEqual(analysis.statusHeadline, "Consume in Moderation");
  assert.strictEqual(analysis.condition, "ckd");
  assert.strictEqual(analysis.factors.length, 2);
  assert.strictEqual(analysis.factors[1].level, "Moderate"); // normalized
  assert.strictEqual(analysis.factors[1].impact, "neutral"); // normalized
  assert.strictEqual(analysis.alternatives[0].icon, "nutrition-outline"); // whitelisted
  console.log("✓ analyzeNutrition normalizes malformed AI output");

  // P0 regression: analyzeNutrition must supply parts + systemInstruction
  // for Gemini (the SDK ignores OpenAI-style `messages`).
  {
    assert.ok(lastGeminiArgs, "Gemini override must have been called for nutrition");
    assert.ok(
      typeof lastGeminiArgs.systemPrompt === "string" &&
        lastGeminiArgs.systemPrompt.includes("clinical dietitian"),
      "Gemini nutrition must carry the dietitian system prompt"
    );
    const nutriText = (lastGeminiArgs.parts?.[0]?.text ?? "");
    assert.ok(nutriText.includes('Food: "banana"'), "Gemini nutrition parts must carry the food prompt");
    console.log("✓ analyzeNutrition sends parts + systemInstruction for Gemini SDK");
  }

  // P0 regression: extractPrescription must send the prescription schema
  // (PRESCRIPTION_SYSTEM_PROMPT) — without it the model returns prose.
  setGemini(
    JSON.stringify({
      readable: true,
      documentType: "prescription",
      conditions: ["diabetes"],
      allergensList: [],
      notes: "Take with food.",
      doctorName: "Dr. Test",
      summary: "Diabetes prescription.",
    })
  );
  {
    const rx = await ai.extractPrescription(Buffer.from("fake"), "image/jpeg");
    assert.strictEqual(rx.status, "success");
    assert.deepStrictEqual(rx.conditions, ["diabetes"]);
    assert.ok(
      typeof lastGeminiArgs.systemPrompt === "string" &&
        lastGeminiArgs.systemPrompt.includes("medical records assistant"),
      "Gemini prescription must carry the extraction schema as system prompt"
    );
    const rxParts = lastGeminiArgs.parts ?? [];
    assert.ok(rxParts.some((p) => p.inlineData), "Gemini prescription must include inlineData image");
    console.log("✓ extractPrescription sends schema via systemInstruction + inlineData image");
  }

  // invalid condition rejected
  await assert.rejects(() => ai.analyzeNutrition("rice", "gout", {}), /Invalid medical condition/);
  console.log("✓ analyzeNutrition rejects unknown conditions");

  // OpenAI 400 → retry without response_format still works
  mockMode = "openai";
  delete process.env.GEMINI_API_KEY;
  process.env.OPENAI_API_KEY = "test-key";
  ai._setGeminiOverride(null);
  let callCount = 0;
  global.fetch = async (_url, options) => {
    callCount++;
    const body = JSON.parse(options.body);
    if (body.response_format && callCount === 1) {
      return {
        ok: false,
        status: 400,
        text: async () => "response_format unsupported",
        json: async () => ({}),
      };
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

  // ── identifyFood via Muse Spark (Meta Model API, Responses API) ──
  setMuse({
    output: [
      {
        type: "message",
        role: "assistant",
        content: [
          {
            type: "output_text",
            text: JSON.stringify({
              foodName: "Masala Dosa",
              confidence: 0.91,
              candidates: [{ name: "Masala Dosa", confidence: 0.91 }],
            }),
          },
        ],
      },
    ],
  });
  r = await ai.identifyFood(Buffer.from("fake"), "image/jpeg");
  assert.strictEqual(r.status, "success");
  assert.strictEqual(r.foodName, "Masala Dosa");
  assert.ok(
    String(lastUrl).endsWith("/v1/responses"),
    `Muse URL must hit Meta Responses API, got: ${lastUrl}`
  );
  assert.ok(!lastUrl.includes("test-key"), "Muse URL must not leak API key");
  assert.strictEqual(lastOptions.headers.Authorization, "Bearer test-key");
  {
    const museBody = JSON.parse(lastOptions.body);
    assert.strictEqual(museBody.model, "muse-spark-1.3-contributor");
    assert.strictEqual(museBody.stream, false);
    assert.strictEqual(museBody.store, false);
    assert.ok(!("temperature" in museBody), "Responses must omit temperature");
    assert.ok(!("response_format" in museBody), "Responses must omit response_format");
    const userMsg = (museBody.input ?? []).find((i) => i.role === "user");
    const imgBlock = (userMsg?.content ?? []).find((p) => p.type === "input_image");
    assert.ok(
      typeof imgBlock?.image_url === "string" &&
        imgBlock.image_url.startsWith("data:image/jpeg;base64,"),
      "Muse vision must send input_image data URL string"
    );
    console.log("✓ identifyFood success path (Muse Spark Responses API)");
  }

  // ── analyzeNutrition via Muse Spark carries instructions ──
  setMuse({
    output: [
      {
        type: "message",
        role: "assistant",
        content: [
          {
            type: "output_text",
            text: JSON.stringify({
              foodName: "Apple",
              category: "Fruit",
              status: "safe",
              summary: "Low potassium.",
              detailedWhy: "Safe for CKD in normal portions.",
              factors: [{ name: "Potassium", level: "Low", impact: "positive", detail: "~195mg" }],
              alternatives: [],
              portionGuidance: "One medium apple.",
            }),
          },
        ],
      },
    ],
  });
  {
    const apple = await ai.analyzeNutrition("apple", "ckd", {});
    assert.strictEqual(apple.status, "safe");
    const museBody = JSON.parse(lastOptions.body);
    assert.ok(
      String(museBody.instructions).includes("clinical dietitian"),
      "Muse nutrition must carry the dietitian instructions"
    );
    console.log("✓ analyzeNutrition via Muse Spark sends instructions");
  }

  // Muse 404 model_not_found → retry once with tier counterpart
  {
    const seenModels = [];
    global.fetch = async (_url, options) => {
      const body = JSON.parse(options.body);
      seenModels.push(body.model);
      if (seenModels.length === 1) {
        return {
          ok: false,
          status: 404,
          text: async () => '{"error":{"code":"model_not_found"}}',
          json: async () => ({}),
        };
      }
      return {
        ok: true,
        status: 200,
        text: async () => "",
        json: async () => ({
          output: [
            {
              type: "message",
              role: "assistant",
              content: [
                {
                  type: "output_text",
                  text: '{"foodName":"Idli","confidence":0.9,"candidates":[]}',
                },
              ],
            },
          ],
        }),
      };
    };
    process.env.MUSE_SPARK_API_KEY = "test-key";
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    ai._setGeminiOverride(null);
    r = await ai.identifyFood(Buffer.from("fake"), "image/jpeg");
    assert.deepStrictEqual(seenModels, ["muse-spark-1.3-contributor", "muse-spark-1.3"]);
    assert.strictEqual(r.foodName, "Idli");
    console.log("✓ Muse Spark tier fallback on model_not_found");
  }

  console.log("\nAll AI smoke tests passed.");
})().catch((err) => {
  console.error("SMOKE TEST FAILED:", err);
  process.exit(1);
});
