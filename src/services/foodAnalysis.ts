import {
  evaluateFoodSafetyMulti,
  foodSafetyStore,
  RULE_VERSION,
  STATUS_HEADLINES,
  type FoodSafetyAnalysis,
  type PatientCondition,
  type SafetyStatus,
} from "../data/foodSafety";
import { getLocationAlternativeNote } from "../data/indianFoods";
import { saveAnalysis } from "./historyService";
import { identifyFoodFromImage, type FoodIdentificationResult } from "./foodVision";
import { assessVisionIdentity } from "../../server/safety-engine";
import { apiFetch } from "./apiClient";
import { authStore } from "./authStore";

export type AnalysisStep = "identifying" | "nutrition" | "guidelines" | "recommendation";

export const TEXT_ANALYSIS_STEPS: { id: AnalysisStep; label: string }[] = [
  { id: "nutrition", label: "Checking nutritional information…" },
  { id: "guidelines", label: "Comparing dietary guidelines…" },
  { id: "recommendation", label: "Preparing your recommendation…" },
];

export const SCAN_ANALYSIS_STEPS: { id: AnalysisStep; label: string }[] = [
  { id: "identifying", label: "Identifying food from image…" },
  { id: "nutrition", label: "Checking nutritional information…" },
  { id: "guidelines", label: "Comparing dietary guidelines…" },
  { id: "recommendation", label: "Preparing your recommendation…" },
];

/** Server analysis is computation-only now, but allow for cold starts. */
const SERVER_ANALYSIS_TIMEOUT_MS = 40_000;

const SAFETY_STATUSES: SafetyStatus[] = [
  "safe",
  "moderation",
  "not_recommended",
  "unable_to_verify",
];

function isSafetyStatus(value: unknown): value is SafetyStatus {
  return typeof value === "string" && SAFETY_STATUSES.includes(value as SafetyStatus);
}

function applyLocationContext(analysis: FoodSafetyAnalysis): FoodSafetyAnalysis {
  const city = authStore.getProfile()?.city ?? foodSafetyStore.getPatient().city;
  const note = getLocationAlternativeNote(city ?? undefined);
  if (!note || analysis.alternatives.length === 0) return analysis;

  return {
    ...analysis,
    detailedWhy: `${analysis.detailedWhy} ${note}`,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function persistAnalysis(analysis: FoodSafetyAnalysis): Promise<FoodSafetyAnalysis> {
  foodSafetyStore.addAnalysis(analysis);
  try {
    await saveAnalysis(analysis);
  } catch (e) {
    // Local history still updated; server sync can retry later.
    // Return analysis as local-only rather than throwing.
    console.warn("persistAnalysis: server sync failed, keeping local-only", e);
  }
  return analysis;
}

interface ServerNutritionResponse {
  source?: string;
  analysis?: Partial<FoodSafetyAnalysis>;
}

/**
 * The server must return the same rule version and a complete evidence trail.
 * Anything else (a legacy AI verdict, a mangled payload, a newer incompatible
 * engine) is rejected and the client re-runs its own copy of the engine.
 */
function isValidEngineAnalysis(
  value: Partial<FoodSafetyAnalysis> | undefined
): value is FoodSafetyAnalysis {
  if (!value || typeof value !== "object") return false;
  if (!isSafetyStatus(value.status)) return false;
  if (typeof value.foodName !== "string" || !value.foodName.trim()) return false;
  if (typeof value.statusHeadline !== "string") return false;
  if (value.ruleVersion !== RULE_VERSION) return false;
  if (!Array.isArray(value.evidence)) return false;
  if (!Array.isArray(value.dataGaps)) return false;
  if (!Array.isArray(value.conditionOutcomes)) return false;
  if (!Array.isArray(value.factors) || !Array.isArray(value.alternatives)) return false;

  return value.evidence.every(
    (item) =>
      item &&
      typeof item === "object" &&
      isSafetyStatus(item.status) &&
      typeof item.ruleId === "string" &&
      item.ruleId.length > 0 &&
      item.ruleVersion === RULE_VERSION &&
      typeof item.servingLabel === "string"
  );
}

/**
 * Ask the server for a deterministic analysis across ALL selected conditions.
 * Returns `{ status: "ok", analysis }` only for a validated rules-engine
 * payload; otherwise `{ status: "fallback", reason }` so the caller runs the
 * identical engine locally. A missing/failed/invalid response never yields a
 * default "safe" or "moderation" verdict.
 */
export type ServerFallbackReason = "unauthenticated" | "invalid" | "error";

export type ServerAnalysisOutcome =
  | { status: "ok"; analysis: FoodSafetyAnalysis }
  | { status: "fallback"; reason: ServerFallbackReason };

type IdentitySource = "text" | "scan";

async function requestServerAnalysis(
  foodName: string,
  conditions: PatientCondition[],
  identity: { source: IdentitySource; confidence?: number }
): Promise<ServerAnalysisOutcome> {
  if (!authStore.isAuthenticated()) {
    return { status: "fallback", reason: "unauthenticated" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SERVER_ANALYSIS_TIMEOUT_MS);

  try {
    const profile = authStore.getProfile();
    const data = await apiFetch<ServerNutritionResponse>("/nutrition/analyze", {
      method: "POST",
      body: JSON.stringify({
        foodName,
        conditions,
        // Only allergen tokens are needed for the deterministic screen; free
        // text notes never leave the device for this request.
        patient: { allergensList: profile?.allergensList ?? [] },
        identity: {
          confirmed: true,
          source: identity.source,
          confidence: identity.confidence,
        },
      }),
      signal: controller.signal,
    });

    if (data.source === "rules-engine" && isValidEngineAnalysis(data.analysis)) {
      return { status: "ok", analysis: data.analysis };
    }
    console.warn("requestServerAnalysis: rejected non-engine/invalid response, using local engine");
    return { status: "fallback", reason: "invalid" };
  } catch (e) {
    console.warn("requestServerAnalysis failed, using local engine", e);
    return { status: "fallback", reason: "error" };
  } finally {
    clearTimeout(timer);
  }
}

let analysisCounter = 0;

function newAnalysisId(): string {
  analysisCounter = (analysisCounter + 1) % Number.MAX_SAFE_INTEGER;
  return `check-${Date.now()}-${analysisCounter}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Finalize a complete engine analysis for display. There is deliberately no
 * default verdict: an invalid status collapses to "Unable to Verify", never
 * to "moderation" or "safe".
 */
function finalizeAnalysis(
  base: FoodSafetyAnalysis,
  foodQuery: string,
  conditions: PatientCondition[]
): FoodSafetyAnalysis {
  const conditionList = conditions.length > 0 ? conditions : (base.conditions ?? []);
  const status: SafetyStatus = isSafetyStatus(base.status) ? base.status : "unable_to_verify";
  const trimmedQuery = foodQuery.trim();
  return {
    ...base,
    id: newAnalysisId(),
    foodName: base.foodName?.trim() ? base.foodName.trim() : trimmedQuery,
    category: base.category ?? "Unknown food",
    condition: conditionList[0] ?? "ckd",
    conditions: conditionList,
    status,
    statusHeadline: base.statusHeadline || STATUS_HEADLINES[status],
    summary: base.summary || "",
    detailedWhy: base.detailedWhy || "",
    factors: base.factors ?? [],
    alternatives: base.alternatives ?? [],
    evidence: base.evidence ?? [],
    dataGaps: base.dataGaps ?? [],
    conditionOutcomes: base.conditionOutcomes ?? [],
    ruleVersion: base.ruleVersion ?? RULE_VERSION,
    serving: base.serving ?? null,
    foodReference: base.foodReference ?? null,
    timestamp: `${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`,
  };
}

function runLocalEngine(
  foodQuery: string,
  conditions: PatientCondition[],
  identity: { source: IdentitySource; confidence?: number }
): FoodSafetyAnalysis {
  const profile = authStore.getProfile();
  return evaluateFoodSafetyMulti(foodQuery, conditions, {
    patient: { allergensList: profile?.allergensList ?? [] },
    identity: { confirmed: true, source: identity.source, confidence: identity.confidence },
  });
}

/**
 * Text food check. The verdict always comes from the shared deterministic
 * engine (server or an identical local copy), evaluated worst-case across all
 * selected conditions.
 */
export async function analyzeFoodByText(
  foodQuery: string,
  conditions: PatientCondition[],
  onStep?: (step: AnalysisStep) => void
): Promise<FoodSafetyAnalysis> {
  onStep?.("nutrition");

  const outcome = await requestServerAnalysis(foodQuery, conditions, { source: "text" });
  const base =
    outcome.status === "ok"
      ? outcome.analysis
      : runLocalEngine(foodQuery, conditions, { source: "text" });

  // Keep the step UX while the deterministic result is ready.
  await delay(outcome.status === "ok" ? 0 : 400);
  onStep?.("guidelines");
  await delay(outcome.status === "ok" ? 250 : 400);
  onStep?.("recommendation");
  await delay(outcome.status === "ok" ? 200 : 300);

  return persistAnalysis(applyLocationContext(finalizeAnalysis(base, foodQuery, conditions)));
}

export interface ScanAnalysisResult {
  identification: FoodIdentificationResult;
  analysis?: FoodSafetyAnalysis;
}

export async function analyzeFoodFromImage(
  imageUri: string,
  conditions: PatientCondition[],
  onStep?: (step: AnalysisStep) => void
): Promise<ScanAnalysisResult> {
  onStep?.("identifying");
  const identification = await identifyFoodFromImage(imageUri);

  if (identification.status === "success" && identification.foodName) {
    // Defense in depth: the shared vision policy is the final gate before a
    // verdict can be attached to an AI-identified food.
    const policy = assessVisionIdentity(identification);
    if (policy.decision !== "success") {
      return {
        identification: {
          ...identification,
          status: policy.decision === "failed" ? "failed" : "uncertain",
          message: policy.reason,
        },
      };
    }
  }

  if (identification.status !== "success" || !identification.foodName) {
    return { identification };
  }

  onStep?.("nutrition");
  const identity = {
    source: "scan" as const,
    confidence: identification.confidence,
  };
  const outcome = await requestServerAnalysis(identification.foodName, conditions, identity);
  const base =
    outcome.status === "ok"
      ? outcome.analysis
      : runLocalEngine(identification.foodName, conditions, identity);

  await delay(outcome.status === "ok" ? 0 : 400);
  onStep?.("guidelines");
  await delay(outcome.status === "ok" ? 250 : 400);
  onStep?.("recommendation");
  await delay(outcome.status === "ok" ? 200 : 300);

  const analysis = await persistAnalysis({
    ...applyLocationContext(finalizeAnalysis(base, identification.foodName, conditions)),
    source: "scan",
    scanConfidence: identification.confidence,
  });

  return { identification, analysis };
}

export async function analyzeConfirmedFood(
  foodName: string,
  conditions: PatientCondition[],
  onStep?: (step: AnalysisStep) => void
): Promise<FoodSafetyAnalysis> {
  onStep?.("nutrition");
  const identity = { source: "scan" as const };
  const outcome = await requestServerAnalysis(foodName, conditions, identity);
  const base =
    outcome.status === "ok" ? outcome.analysis : runLocalEngine(foodName, conditions, identity);

  await delay(outcome.status === "ok" ? 0 : 350);
  onStep?.("guidelines");
  await delay(outcome.status === "ok" ? 250 : 350);
  onStep?.("recommendation");
  await delay(outcome.status === "ok" ? 200 : 250);

  return persistAnalysis({
    ...applyLocationContext(finalizeAnalysis(base, foodName, conditions)),
    source: "scan",
  });
}
