/* NutriCheck — AI layer (server-side only, keys never reach the client)
 *
 * Providers (first match wins):
 *   1. Google Gemini          → GEMINI_API_KEY            (optional GEMINI_MODEL, default gemini-2.0-flash)
 *   2. OpenAI-compatible      → OPENAI_API_KEY            (optional OPENAI_BASE_URL, OPENAI_MODEL)
 *      Works with OpenAI, OpenRouter, Groq, Together, Ollama, LM Studio, ...
 *
 * Capabilities:
 *   - identifyFood(image)        → { status, foodName, confidence, candidates }
 *   - analyzeNutrition(...)      → structured clinical-style verdict for one condition
 *
 * Without any key, isConfigured() returns false and routes degrade gracefully.
 */

const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";

const VISION_TIMEOUT_MS = 45_000;
const TEXT_TIMEOUT_MS = 30_000;

// ─── Provider resolution ───────────────────────────────────────────────────────

function resolveProvider() {
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
  if (!text) throw new AiError("Empty AI response.");
  const cleaned = text.replace(/```json\s*/gi, "```").trim();
  const fenced = cleaned.match(/```([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : cleaned;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new AiError("AI response did not contain JSON.");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

async function callGemini({ parts, systemPrompt, timeoutMs }) {
  const provider = resolveProvider();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${provider.model}:generateContent?key=${encodeURIComponent(provider.apiKey)}`;

  const contents = [];
  if (systemPrompt) contents.push({ role: "user", parts: [{ text: systemPrompt }] });
  contents.push({ role: "user", parts });

  const response = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        generationConfig: { temperature: 0.3, responseMimeType: "application/json" },
      }),
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
  if (!response.ok && response.status === 400) {
    delete body.response_format;
    response = await fetchWithTimeout(
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
  }

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    throw new AiError(`AI request failed (${response.status}): ${errBody.slice(0, 300)}`);
  }

  const data = await response.json();
  return extractJson(data?.choices?.[0]?.message?.content ?? "");
}

function callModel({ parts, systemPrompt, messages, timeoutMs }) {
  const provider = resolveProvider();
  if (!provider) throw new AiError("No AI provider configured.", "not_configured");
  return provider.name === "gemini"
    ? callGemini({ parts, systemPrompt, timeoutMs })
    : callOpenAI({
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
  hypertension: "Heart Disease & Hypertension — focus on sodium, saturated fat, trans fat, cholesterol",
  celiac: "Celiac Disease — focus on gluten presence (wheat/rye/barley/spelt), cross-contact risk",
  allergy: "Food Allergy — screen against the patient's allergen list (peanuts, tree nuts, dairy, soy, shellfish, eggs, sesame)",
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
          level: ["Low", "Moderate", "High", "Contains", "None"].includes(f.level) ? f.level : "Moderate",
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
    foodName: typeof raw.foodName === "string" && raw.foodName.trim() ? raw.foodName.trim() : foodQuery,
    category: typeof raw.category === "string" && raw.category.trim() ? raw.category.trim() : "General Food",
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

  const prompt =
    "Identify the food dish in this photo. If the image contains no recognizable food, set foodName to null. " +
    'Respond with STRICT JSON only: {"foodName": string|null, "confidence": number between 0 and 1, ' +
    '"candidates": [{"name": string, "confidence": number}] with up to 3 most likely dishes, best first}. ' +
    "Use concise, well-known dish names (e.g. \"Margherita Pizza\", \"Idli with Sambar\").";

  const parts = [
    { text: prompt },
    { inline_data: { mime_type: mimetype || "image/jpeg", data: base64 } },
  ];

  const messages = [
    {
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: `data:${mimetype || "image/jpeg"};base64,${base64}` } },
      ],
    },
  ];

  let result;
  try {
    result = await callModel({ parts, messages, timeoutMs: VISION_TIMEOUT_MS });
  } catch (err) {
    if (err instanceof AiError && err.code === "not_configured") throw err;
    throw new AiError(
      "We couldn't reach the food recognition service. Check your connection and try again."
    );
  }

  const foodName = typeof result.foodName === "string" ? result.foodName.trim() : "";
  if (!foodName) {
    return {
      status: "failed",
      message: "No food was detected. Try a full-dish photo with good lighting, or search manually.",
    };
  }

  const confidence = Math.min(1, Math.max(0, Number(result.confidence) || 0));
  const candidates = Array.isArray(result.candidates)
    ? result.candidates
        .filter((c) => c && typeof c.name === "string")
        .slice(0, 3)
        .map((c) => ({ name: String(c.name), confidence: Math.min(1, Math.max(0, Number(c.confidence) || 0)) }))
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
    messages: [{ role: "user", content: userPrompt }],
    timeoutMs: TEXT_TIMEOUT_MS,
  });

  const normalized = normalizeAnalysis(raw, foodName, conditionList[0]);
  return { ...normalized, conditions: conditionList };
}

/**
 * Extract dietary-relevant health info from a prescription/report photo.
 * @returns {{ readable, documentType, conditions, allergensList, notes, doctorName, summary }}
 */
async function extractPrescription(imageBuffer, mimetype) {
  const base64 = Buffer.from(imageBuffer).toString("base64");

  const parts = [
    { text: "Read this medical document and extract the dietary information as instructed." },
    { inline_data: { mime_type: mimetype || "image/jpeg", data: base64 } },
  ];

  const messages = [
    {
      role: "user",
      content: [
        { type: "text", text: "Read this medical document and extract the dietary information as instructed." },
        { type: "image_url", image_url: { url: `data:${mimetype || "image/jpeg"};base64,${base64}` } },
      ],
    },
  ];

  let result;
  try {
    result = await callModel({ parts, messages, timeoutMs: VISION_TIMEOUT_MS });
  } catch (err) {
    if (err instanceof AiError && err.code === "not_configured") throw err;
    throw new AiError("We couldn't read the prescription right now. Check your connection and try again.");
  }

  const conditions = Array.isArray(result.conditions)
    ? [...new Set(result.conditions.filter((c) => VALID_CONDITIONS.includes(c)))]
    : [];
  const allergensList = Array.isArray(result.allergensList)
    ? result.allergensList.filter((a) => typeof a === "string" && a.trim()).map((a) => String(a).trim()).slice(0, 12)
    : [];

  return {
    readable: result.readable === true,
    documentType: typeof result.documentType === "string" ? result.documentType : "unknown",
    conditions,
    allergensList,
    notes: typeof result.notes === "string" ? result.notes.slice(0, 600) : "",
    doctorName: typeof result.doctorName === "string" && result.doctorName.trim() ? result.doctorName.trim() : null,
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
};
