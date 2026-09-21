/* NutriSafe — AI layer (server-side only, keys never reach the client)
 *
 * Providers (first match wins):
 *   1. Muse Spark (Meta Model API) → MUSE_SPARK_API_KEY (optional MUSE_SPARK_MODEL,
 *      default muse-spark-1.3-contributor; optional MUSE_SPARK_BASE_URL,
 *      default https://api.meta.ai/v1). Served on the Responses API
 *      (POST /v1/responses); vision via input_image data-URL blocks,
 *      system guidance via instructions. On model_not_found the tier
 *      counterpart (contributor ↔ standard) is retried once.
 *   2. Google Gemini          → GEMINI_API_KEY            (optional GEMINI_MODEL, default gemini-2.5-flash)
 *   3. OpenAI-compatible      → OPENAI_API_KEY            (optional OPENAI_BASE_URL, OPENAI_MODEL)
 *      Works with OpenAI, OpenRouter, Groq, Together, Ollama, LM Studio, ...
 *
 * Capabilities:
 *   - identifyFood(image)        → { status, foodName, confidence, candidates }
 *   - analyzeNutrition(...)      → structured clinical-style verdict for one condition
 *
 * Without any key, isConfigured() returns false and routes degrade gracefully.
 */

// NOTE: contributor-tier default matches the sample pairing in the Meta docs
// (contributor key + contributor model on the Responses API). Keys without
// Contributor entitlement auto-fall-back to the standard id on model_not_found;
// MUSE_SPARK_MODEL overrides either way.
const DEFAULT_MUSE_SPARK_MODEL = "muse-spark-1.3-contributor";
const DEFAULT_MUSE_SPARK_BASE_URL = "https://api.meta.ai/v1";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";

const VISION_TIMEOUT_MS = 45_000;
const TEXT_TIMEOUT_MS = 30_000;

// ─── Provider resolution ───────────────────────────────────────────────────────

function resolveProvider() {
  // Muse Spark (Meta Model API) — Responses API (POST /v1/responses).
  // Key is server-side only; never ship it in the app bundle.
  const museKey = process.env.MUSE_SPARK_API_KEY?.trim();
  if (museKey) {
    return {
      name: "muse",
      apiKey: museKey,
      model: process.env.MUSE_SPARK_MODEL?.trim() || DEFAULT_MUSE_SPARK_MODEL,
      baseUrl: (process.env.MUSE_SPARK_BASE_URL?.trim() || DEFAULT_MUSE_SPARK_BASE_URL).replace(
        /\/$/,
        ""
      ),
    };
  }

  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (geminiKey) {
    return {
      name: "gemini",
      apiKey: geminiKey,
      model: process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL,
    };
  }

  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  if (openaiKey) {
    return {
      name: "openai",
      apiKey: openaiKey,
      model: process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL,
      baseUrl: (process.env.OPENAI_BASE_URL?.trim() || DEFAULT_OPENAI_BASE_URL).replace(/\/$/, ""),
    };
  }

  return null;
}

function isConfigured() {
  return resolveProvider() !== null;
}

function describeConfig() {
  const p = resolveProvider();
  if (!p) return "not configured";
  if (p.name === "muse") return `muse-spark (${p.model})`;
  return p.name === "gemini" ? `gemini (${p.model})` : `openai-compatible (${p.model})`;
}

class AiError extends Error {
  constructor(message, code = "ai_failed") {
    super(message);
    this.name = "AiError";
    this.code = code;
  }
}

// ─── Low-level provider calls ──────────────────────────────────────────────────

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Extract the first JSON object from a model response (handles fences/prose). */
function extractJson(text) {
  // Content-level failures (blocked/empty/unparseable model output) carry a
  // distinct code so callers can return a graceful "unreadable" result
  // instead of surfacing a 502 transport-style error.
  if (!text) throw new AiError("Empty AI response.", "unreadable_content");
  const cleaned = text.replace(/```json\s*/gi, "```").trim();
  const fenced = cleaned.match(/```([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : cleaned;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new AiError("AI response did not contain JSON.", "unreadable_content");
  }
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    throw new AiError("AI response did not contain valid JSON.", "unreadable_content");
  }
}

/** Test hook: when set, callGemini routes through this fn instead of the
 *  real @google/genai client. Smoke tests use it to avoid network access.
 *  fn receives { model, parts, systemPrompt } and must resolve to raw text. */
let _geminiOverride = null;
function _setGeminiOverride(fn) {
  _geminiOverride = fn;
}

async function callGemini({ parts, systemPrompt, timeoutMs }) {
  const provider = resolveProvider();

  // Normalize caller-supplied parts to the SDK shape.
  // Legacy callers used snake_case { inline_data: { mime_type, data } } —
  // the API requires camelCase { inlineData: { mimeType, data } }.
  const normalizedParts = (Array.isArray(parts) ? parts : []).map((p) => {
    if (p && typeof p === "object" && p.inline_data) {
      const mimeType = p.inline_data.mime_type || p.inline_data.mimeType || "image/jpeg";
      return { inlineData: { mimeType, data: p.inline_data.data } };
    }
    return p;
  });

  if (_geminiOverride) {
    const text = await _geminiOverride({
      model: provider.model,
      parts: normalizedParts,
      systemPrompt,
    });
    return extractJson(text);
  }

  // Official SDK — handles auth header, wire format, and model routing.
  // Never put the key in the URL (avoids leaking in logs/proxies).
  let GoogleGenAI;
  try {
    ({ GoogleGenAI } = require("@google/genai"));
  } catch (err) {
    throw new AiError(`Gemini SDK unavailable: ${err.message || err}`);
  }
  const ai = new GoogleGenAI({ apiKey: provider.apiKey });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await ai.models.generateContent({
      model: provider.model,
      contents: [{ role: "user", parts: normalizedParts }],
      config: {
        temperature: 0.3,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
        ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
        abortSignal: controller.signal,
      },
    });
    const text = typeof response.text === "string" ? response.text : "";
    return extractJson(text);
  } catch (err) {
    if (err instanceof AiError) throw err;
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    if (/abort/i.test(msg)) throw new AiError(`Gemini request timed out after ${timeoutMs}ms.`);
    throw new AiError(`Gemini request failed: ${msg.slice(0, 300)}`);
  } finally {
    clearTimeout(timer);
  }
}

/** REST fallback — kept for reference/debugging (SDK is the live path). */
async function callGeminiRest({ parts, systemPrompt, timeoutMs }) {
  const provider = resolveProvider();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${provider.model}:generateContent`;

  const normalizedParts = (Array.isArray(parts) ? parts : []).map((p) => {
    if (p && typeof p === "object" && p.inline_data) {
      const mimeType = p.inline_data.mime_type || p.inline_data.mimeType || "image/jpeg";
      return { inlineData: { mimeType, data: p.inline_data.data } };
    }
    return p;
  });

  const contents = [{ role: "user", parts: normalizedParts }];

  const payload = {
    contents,
    generationConfig: {
      temperature: 0.3,
      responseMimeType: "application/json",
      maxOutputTokens: 2048,
    },
  };
  if (systemPrompt) {
    payload.systemInstruction = { parts: [{ text: systemPrompt }] };
  }

  const response = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": provider.apiKey },
      body: JSON.stringify(payload),
    },
    timeoutMs
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new AiError(`Gemini request failed (${response.status}): ${body.slice(0, 300)}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  return extractJson(text);
}

async function callOpenAI({ messages, timeoutMs }) {
  const provider = resolveProvider();
  const url = `${provider.baseUrl}/chat/completions`;

  const body = {
    model: provider.model,
    messages,
    temperature: 0.3,
    response_format: { type: "json_object" },
  };

  let response = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify(body),
    },
    timeoutMs
  );

  // Some OpenAI-compatible providers reject response_format — retry once without it.
  // Clone before mutating so the original `body` object is never mutated in place.
  if (!response.ok && response.status === 400) {
    const retryBody = { ...body };
    delete retryBody.response_format;
    response = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify(retryBody),
      },
      timeoutMs
    );
  }

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    throw new AiError(`AI request failed (${response.status}): ${errBody.slice(0, 300)}`);
  }

  const data = await response.json();
  return extractJson(data?.choices?.[0]?.message?.content ?? "");
}

/**
 * Muse Spark (Meta Model API) via the Responses API (POST /v1/responses) —
 * the endpoint Meta recommends, and the one contributor-tier keys are
 * served on. Chat Completions 404s model_not_found for these keys, so it
 * is not used here.
 *
 * Shape (per dev.meta.ai/docs):
 *   request:  { model, instructions?, input: [{type:"message",role:"user",
 *               content:[{type:"input_text",text},{type:"input_image",image_url}]}],
 *               stream:false, store:false, max_output_tokens }
 *   response: { output: [{type:"message",role:"assistant",
 *               content:[{type:"output_text",text}]}] }
 * System guidance goes in top-level `instructions` (developer-level).
 * temperature/top_p/response_format are intentionally OMITTED — the model
 * is tuned to its defaults and compat-only fields don't take effect here.
 * store:false keeps medical images out of server-side history.
 */
function museInputFromMessages(messages) {
  return (Array.isArray(messages) ? messages : [])
    .filter((m) => m && m.role === "user")
    .map((m) => {
      if (typeof m.content === "string") {
        return { type: "message", role: "user", content: [{ type: "input_text", text: m.content }] };
      }
      const content = (Array.isArray(m.content) ? m.content : [])
        .map((p) => {
          if (!p || typeof p !== "object") return null;
          if (p.type === "text" && typeof p.text === "string") {
            return { type: "input_text", text: p.text };
          }
          if (p.type === "image_url") {
            const url = typeof p.image_url?.url === "string" ? p.image_url.url : "";
            if (!url) return null;
            return { type: "input_image", image_url: url };
          }
          return null;
        })
        .filter(Boolean);
      return { type: "message", role: "user", content };
    });
}

function museTextFromResponse(data) {
  const out = Array.isArray(data?.output) ? data.output : [];
  const texts = [];
  for (const item of out) {
    if (!item || item.type !== "message" || !Array.isArray(item.content)) continue;
    for (const part of item.content) {
      if (part && part.type === "output_text" && typeof part.text === "string") {
        texts.push(part.text);
      }
    }
  }
  return texts.join("");
}

/** Tier counterpart for model_not_found fallback (contributor ↔ standard). */
function museCounterpart(model) {
  if (typeof model !== "string") return null;
  if (model.endsWith("-contributor")) return model.slice(0, -"-contributor".length);
  const m = model.match(/^(muse-spark-\d+\.\d+)$/);
  return m ? `${m[1]}-contributor` : null;
}

/**
 * Ordered model ids to try: configured → tier counterpart → free-tier id.
 * Different keys are entitled to different catalog entries; each 404 moves
 * to the next candidate. Only failure paths pay extra requests.
 */
function museModelCandidates(configured) {
  const out = [];
  for (const m of [configured, museCounterpart(configured), "muse-spark-1.3-contributor-free"]) {
    if (typeof m === "string" && m && !out.includes(m)) out.push(m);
  }
  return out;
}

async function musePost({ apiKey, baseUrl, body, timeoutMs }) {
  return fetchWithTimeout(
    `${baseUrl}/responses`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    },
    timeoutMs
  );
}

async function callMuseSpark({ messages, systemPrompt, timeoutMs }) {
  const provider = resolveProvider();

  const input = museInputFromMessages(messages);
  const buildBody = (model) => ({
    model,
    ...(systemPrompt ? { instructions: systemPrompt } : {}),
    input,
    stream: false,
    store: false,
    max_output_tokens: 2048,
  });

  const modelsToTry = museModelCandidates(provider.model);

  let lastError = null;
  for (const model of modelsToTry) {
    let response;
    try {
      response = await musePost({
        apiKey: provider.apiKey,
        baseUrl: provider.baseUrl,
        body: buildBody(model),
        timeoutMs,
      });
    } catch (err) {
      throw new AiError(
        `Muse Spark request failed: ${(err instanceof Error ? err.message : String(err)).slice(0, 200)}`
      );
    }

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      lastError = new AiError(
        `Muse Spark request failed (${response.status}): ${errBody.slice(0, 300)}`
      );
      // Wrong-tier model id → try the next candidate (log it; no secrets).
      if (response.status === 404 && model !== modelsToTry[modelsToTry.length - 1]) {
        console.warn(`[ai] muse model ${model} not found, trying next candidate`);
        continue;
      }
      throw lastError;
    }

    if (model !== provider.model) {
      console.log(`[ai] muse model fallback in use: ${model}`);
    }
    const data = await response.json();
    return extractJson(museTextFromResponse(data));
  }
  throw lastError ?? new AiError("Muse Spark request failed.");
}

function callModel({ parts, systemPrompt, messages, timeoutMs }) {
  const provider = resolveProvider();
  if (!provider) throw new AiError("No AI provider configured.", "not_configured");
  if (provider.name === "gemini") return callGemini({ parts, systemPrompt, timeoutMs });
  if (provider.name === "muse") return callMuseSpark({ messages, systemPrompt, timeoutMs });
  return callOpenAI({
    messages: systemPrompt
      ? [{ role: "system", content: systemPrompt }, ...messages]
      : messages,
    timeoutMs,
  });
}

// ─── Safety constants shared by prompts ────────────────────────────────────────

const CONDITIONS = {
  diabetes: "Diabetes (Type 1 & 2) — focus on glycemic index, added sugars, total carbs, fiber",
  ckd: "Chronic Kidney Disease — focus on potassium, phosphorus (esp. inorganic additives), sodium, protein load",
  hypertension:
    "Heart Disease & Hypertension — focus on sodium, saturated fat, trans fat, cholesterol",
  celiac: "Celiac Disease — focus on gluten presence (wheat/rye/barley/spelt), cross-contact risk",
  allergy:
    "Food Allergy — screen against the patient's allergen list (peanuts, tree nuts, dairy, soy, shellfish, eggs, sesame)",
};

const ALLOWED_ICONS = [
  "leaf-outline",
  "nutrition-outline",
  "restaurant-outline",
  "water-outline",
  "egg-outline",
  "fitness-outline",
  "pulse-outline",
  "heart-outline",
  "shield-checkmark-outline",
  "alert-circle-outline",
];

const NUTRITION_SYSTEM_PROMPT = `You are a cautious clinical dietitian inside a mobile app that helps patients with chronic conditions decide whether a specific food is safe for THEM.

Rules:
- Base the verdict on established clinical nutrition guidance for the stated condition.
- Be conservative: when genuinely torn between two statuses, choose the more restrictive one.
- Never give a blanket "all foods are fine" answer; evaluate the specific food.
- This is informational guidance, not a diagnosis; phrase explanations accordingly.
- Respond with STRICT JSON only, no markdown fences, matching exactly this schema:
{
  "foodName": string,                    // canonical name of the evaluated food
  "category": string,                    // e.g. "Fruit", "Grains", "Processed Foods"
  "status": "safe" | "moderation" | "not_recommended",
  "statusHeadline": "Safe to Consume" | "Consume in Moderation" | "Not Recommended",
  "summary": string,                     // 1-2 sentence plain-language verdict
  "detailedWhy": string,                 // 2-4 sentence clinical explanation
  "factors": [                           // 2-5 nutrient factors relevant to the condition
    { "name": string, "level": "Low"|"Moderate"|"High"|"Contains"|"None", "impact": "positive"|"neutral"|"warning"|"danger", "detail": string }
  ],
  "alternatives": [                      // 2-3 practical swaps
    { "name": string, "reason": string, "icon": one of ${JSON.stringify(ALLOWED_ICONS)} }
  ],
  "portionGuidance": string              // concrete portion advice
}`;

function buildPatientContext(patient) {
  if (!patient) return "";
  const bits = [];
  if (patient.age) bits.push(`age ${patient.age}`);
  if (patient.gender) bits.push(String(patient.gender));
  if (Array.isArray(patient.allergensList) && patient.allergensList.length > 0) {
    bits.push(`allergies: ${patient.allergensList.join(", ")}`);
  }
  if (patient.notes) bits.push(`notes: ${String(patient.notes).slice(0, 300)}`);
  return bits.length > 0 ? ` Patient context: ${bits.join("; ")}.` : "";
}

const VALID_CONDITIONS = ["diabetes", "ckd", "hypertension", "celiac", "allergy"];

const PRESCRIPTION_SYSTEM_PROMPT = `You are a medical records assistant inside a health app. The user photographs a doctor's prescription, lab report, or discharge summary. Read it and extract dietary-relevant information.

Rules:
- Extract ONLY what is actually written or clearly implied by the document. Do not invent findings.
- Map findings onto these supported condition ids where applicable: "diabetes" (diabetes/high blood sugar), "ckd" (chronic kidney disease/creatinine/eGFR concerns), "hypertension" (high BP/heart disease/cholesterol), "celiac" (gluten intolerance/wheat allergy), "allergy" (any documented food allergies).
- Collect food allergens explicitly mentioned (e.g. penicillin allergy is NOT a food; peanut is).
- Summarize dietary restrictions/instructions in plain language for the notes field.
- If the image is unreadable or not a medical document, set readable to false and leave fields empty.
- Respond with STRICT JSON only, no markdown fences:
{
  "readable": boolean,
  "documentType": string,                // e.g. "prescription", "lab report", "discharge summary", "unknown"
  "conditions": string[],                // subset of the supported condition ids above
  "allergensList": string[],
  "notes": string,                       // dietary instructions/restrictions found, concise
  "doctorName": string | null,
  "summary": string                      // one-sentence plain-language summary of what you read
}`;

function normalizeAnalysis(raw, foodQuery, condition) {
  const validStatuses = new Set(["safe", "moderation", "not_recommended"]);
  const validImpacts = new Set(["positive", "neutral", "warning", "danger"]);
  const headlineFor = {
    safe: "Safe to Consume",
    moderation: "Consume in Moderation",
    not_recommended: "Not Recommended",
  };

  const status = validStatuses.has(raw.status) ? raw.status : "moderation";

  const factors = Array.isArray(raw.factors)
    ? raw.factors
        .filter((f) => f && typeof f.name === "string")
        .slice(0, 6)
        .map((f) => ({
          name: String(f.name),
          level: ["Low", "Moderate", "High", "Contains", "None"].includes(f.level)
            ? f.level
            : "Moderate",
          impact: validImpacts.has(f.impact) ? f.impact : "neutral",
          detail: typeof f.detail === "string" ? f.detail : "",
        }))
    : [];

  const alternatives = Array.isArray(raw.alternatives)
    ? raw.alternatives
        .filter((a) => a && typeof a.name === "string")
        .slice(0, 4)
        .map((a) => ({
          name: String(a.name),
          reason: typeof a.reason === "string" ? a.reason : "",
          icon: ALLOWED_ICONS.includes(a.icon) ? a.icon : "nutrition-outline",
        }))
    : [];

  return {
    foodName:
      typeof raw.foodName === "string" && raw.foodName.trim() ? raw.foodName.trim() : foodQuery,
    category:
      typeof raw.category === "string" && raw.category.trim()
        ? raw.category.trim()
        : "General Food",
    condition,
    status,
    statusHeadline: headlineFor[status],
    summary: typeof raw.summary === "string" ? raw.summary : "",
    detailedWhy: typeof raw.detailedWhy === "string" ? raw.detailedWhy : "",
    factors,
    alternatives,
    portionGuidance: typeof raw.portionGuidance === "string" ? raw.portionGuidance : undefined,
  };
}

// ─── Public capabilities ───────────────────────────────────────────────────────

/**
 * Identify food from an image buffer.
 * @returns {{ status: "success"|"failed", foodName?: string, confidence?: number, candidates?: {name:string,confidence:number}[] }}
 */
async function identifyFood(imageBuffer, mimetype) {
  const base64 = Buffer.from(imageBuffer).toString("base64");

  // HEIC/HEIF (common from iPhones) is passed through as-is rather than
  // remapped to image/jpeg — most vision endpoints sniff the bytes anyway.
  // Log a warning since some providers reject HEIC outright.
  const effectiveMime = mimetype || "image/jpeg";
  if (/heic|heif/i.test(effectiveMime)) {
    console.warn(
      `[ai] identifyFood received ${effectiveMime}; passing through (provider may reject HEIC).`
    );
  }

  const prompt =
    "Identify the food dish in this photo. If the image contains no recognizable food, set foodName to null. " +
    'Respond with STRICT JSON only: {"foodName": string|null, "confidence": number between 0 and 1, ' +
    '"candidates": [{"name": string, "confidence": number}] with up to 3 most likely dishes, best first}. ' +
    'Use concise, well-known dish names (e.g. "Margherita Pizza", "Idli with Sambar").';

  const parts = [{ text: prompt }, { inlineData: { mimeType: effectiveMime, data: base64 } }];

  const messages = [
    {
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: `data:${effectiveMime};base64,${base64}` } },
      ],
    },
  ];

  let result;
  try {
    result = await callModel({ parts, messages, timeoutMs: VISION_TIMEOUT_MS });
  } catch (err) {
    if (err instanceof AiError && err.code === "not_configured") throw err;
    if (err instanceof AiError && err.code === "unreadable_content") {
      // Blocked/empty/garbled model output — treat as "no reading",
      // not a transport failure, so the client shows its failed UX.
      return {
        status: "failed",
        message:
          "No food was detected. Try a full-dish photo with good lighting, or search manually.",
      };
    }
    console.error(
      "[ai] identifyFood inner:",
      err instanceof Error ? `${err.name}: ${err.message}` : err
    );
    throw new AiError(
      "We couldn't reach the food recognition service. Check your connection and try again."
    );
  }

  const foodName = typeof result.foodName === "string" ? result.foodName.trim() : "";
  if (!foodName) {
    return {
      status: "failed",
      message:
        "No food was detected. Try a full-dish photo with good lighting, or search manually.",
    };
  }

  const confidence = Math.min(1, Math.max(0, Number(result.confidence) || 0));
  const candidates = Array.isArray(result.candidates)
    ? result.candidates
        .filter((c) => c && typeof c.name === "string")
        .slice(0, 3)
        .map((c) => ({
          name: String(c.name),
          confidence: Math.min(1, Math.max(0, Number(c.confidence) || 0)),
        }))
    : [];

  return { status: "success", foodName, confidence, candidates };
}

/**
 * Produce a structured safety analysis for one food against one or more conditions.
 * The verdict is merged worst-case: the food must be safe for ALL conditions.
 * @returns analysis object shaped like the app's FoodSafetyAnalysis (minus id/timestamp/source).
 */
async function analyzeNutrition(foodName, conditions, patient) {
  const conditionList = (Array.isArray(conditions) ? conditions : [conditions]).filter((c) =>
    VALID_CONDITIONS.includes(c)
  );
  if (conditionList.length === 0) {
    throw new AiError("Invalid medical condition.", "invalid_condition");
  }

  const conditionLines = conditionList.map((c) => `- ${CONDITIONS[c]}`).join("\n");

  const userPrompt =
    `Food: "${foodName}"\n` +
    `The patient has ${conditionList.length > 1 ? "ALL of the following conditions" : "the following condition"}:\n` +
    `${conditionLines}\n` +
    `${buildPatientContext(patient)}` +
    (conditionList.length > 1
      ? "\nEvaluate the food against EACH condition. The final status must be the MOST RESTRICTIVE verdict across all of them (a food safe for one condition but dangerous for another must get the dangerous verdict). In factors and detailedWhy, make clear which condition drives each concern."
      : "") +
    "\nRespond with the JSON schema.";

  const raw = await callModel({
    systemPrompt: NUTRITION_SYSTEM_PROMPT,
    // Gemini (callGemini) consumes `parts`; OpenAI-compatible consumes
    // `messages`. Supply both so either provider works.
    parts: [{ text: userPrompt }],
    messages: [{ role: "user", content: userPrompt }],
    timeoutMs: TEXT_TIMEOUT_MS,
  });

  const normalized = normalizeAnalysis(raw, foodName, conditionList[0]);
  return { ...normalized, conditions: conditionList };
}

/**
 * Extract dietary-relevant health info from a prescription/report photo.
  * @returns {{ status: "success"|"unreadable", readable, documentType, conditions, allergensList, notes, doctorName, summary }}
  */
async function extractPrescription(imageBuffer, mimetype) {
  const base64 = Buffer.from(imageBuffer).toString("base64");
  const effectiveMime = mimetype || "image/jpeg";

  const parts = [
    { text: "Read this medical document and extract the dietary information as instructed." },
    { inlineData: { mimeType: effectiveMime, data: base64 } },
  ];

  const messages = [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "Read this medical document and extract the dietary information as instructed.",
        },
        {
          type: "image_url",
          image_url: { url: `data:${effectiveMime};base64,${base64}` },
        },
      ],
    },
  ];

  let result;
  try {
    result = await callModel({
      systemPrompt: PRESCRIPTION_SYSTEM_PROMPT,
      parts,
      messages,
      timeoutMs: VISION_TIMEOUT_MS,
    });
  } catch (err) {
    if (err instanceof AiError && err.code === "not_configured") throw err;
    if (err instanceof AiError && err.code === "unreadable_content") {
      // The model returned nothing usable (blocked/empty/garbled) — the
      // image simply yielded no reading. HTTP 200 + unreadable, not a 502.
      return {
        status: "unreadable",
        readable: false,
        documentType: "unknown",
        conditions: [],
        allergensList: [],
        notes: "",
        doctorName: null,
        summary: "",
      };
    }
    console.error(
      "[ai] extractPrescription inner:",
      err instanceof Error ? `${err.name}: ${err.message}` : err
    );
    throw new AiError(
      "We couldn't read the prescription right now. Check your connection and try again."
    );
  }

  const conditions = Array.isArray(result.conditions)
    ? [...new Set(result.conditions.filter((c) => VALID_CONDITIONS.includes(c)))]
    : [];
  const allergensList = Array.isArray(result.allergensList)
    ? result.allergensList
        .filter((a) => typeof a === "string" && a.trim())
        .map((a) => String(a).trim())
        .slice(0, 12)
    : [];

  const readable = result.readable === true;
  return {
    // Discriminator mirrors /vision/identify's contract so clients can
    // switch on `status` instead of inferring from `readable`.
    status: readable ? "success" : "unreadable",
    readable,
    documentType: typeof result.documentType === "string" ? result.documentType : "unknown",
    conditions,
    allergensList,
    notes: typeof result.notes === "string" ? result.notes.slice(0, 600) : "",
    doctorName:
      typeof result.doctorName === "string" && result.doctorName.trim()
        ? result.doctorName.trim()
        : null,
    summary: typeof result.summary === "string" ? result.summary : "",
  };
}

module.exports = {
  isConfigured,
  describeConfig,
  identifyFood,
  analyzeNutrition,
  extractPrescription,
  // exported for tests
  extractJson,
  normalizeAnalysis,
  _setGeminiOverride,
};
