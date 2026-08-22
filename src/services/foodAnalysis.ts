import {
  evaluateFoodSafetyMulti,
  foodSafetyStore,
  type FoodSafetyAnalysis,
  type PatientCondition,
} from "../data/foodSafety";
import { getLocationAlternativeNote } from "../data/indianFoods";
import { saveAnalysis } from "./historyService";
import { identifyFoodFromImage, type FoodIdentificationResult } from "./foodVision";
import { apiFetch } from "./apiClient";
import { authStore } from "./authStore";

export type AnalysisStep =
  | "identifying"
  | "nutrition"
  | "guidelines"
  | "recommendation";

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

/** Server AI can be slow — give it room before falling back to the local engine. */
const SERVER_ANALYSIS_TIMEOUT_MS = 40_000;

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
  } catch {
    // Local history still updated; server sync can retry later.
  }
  return analysis;
}

interface ServerNutritionResponse {
  source?: string;
  analysis?: Partial<FoodSafetyAnalysis>;
}

/**
 * Ask the server's AI layer for a full analysis across ALL selected conditions.
 * Returns null when the server has no AI configured, errors out, or the user
 * is offline/unauthenticated — the caller then uses the local rules engine.
 */
async function requestServerAnalysis(
  foodName: string,
  conditions: PatientCondition[]
): Promise<Partial<FoodSafetyAnalysis> | null> {
  if (!authStore.isAuthenticated()) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SERVER_ANALYSIS_TIMEOUT_MS);

  try {
    const data = await apiFetch<ServerNutritionResponse>("/nutrition/analyze", {
      method: "POST",
      body: JSON.stringify({
        foodName,
        conditions,
        patient: authStore.getProfile(),
      }),
      signal: controller.signal,
    });

    if (data.source === "ai" && data.analysis && data.analysis.status) {
      return data.analysis;
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function finalizeAnalysis(
  base: Partial<FoodSafetyAnalysis>,
  foodQuery: string,
  conditions: PatientCondition[]
): FoodSafetyAnalysis {
  const conditionList = conditions.length > 0 ? conditions : (base.conditions ?? ["ckd"]);
  return {
    id: `check-${Date.now()}`,
    foodName: base.foodName ?? foodQuery,
    category: base.category ?? "General Food",
    condition: conditionList[0],
    conditions: conditionList,
    status: base.status ?? "moderation",
    statusHeadline: base.statusHeadline ?? "Consume in Moderation",
    summary: base.summary ?? "",
    detailedWhy: base.detailedWhy ?? "",
    factors: base.factors ?? [],
    alternatives: base.alternatives ?? [],
    portionGuidance: base.portionGuidance,
    timestamp: `Today, ${new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`,
  };
}

/**
 * Text food check. Prefers the server's AI layer when configured; falls back
 * to the deterministic clinical rules engine (worst-case across all selected
 * conditions) otherwise.
 */
export async function analyzeFoodByText(
  foodQuery: string,
  conditions: PatientCondition[],
  onStep?: (step: AnalysisStep) => void
): Promise<FoodSafetyAnalysis> {
  onStep?.("nutrition");

  const serverBase = await requestServerAnalysis(foodQuery, conditions);

  if (!serverBase) {
    // Local rules-engine path keeps the step UX while computing instantly.
    await delay(400);
    onStep?.("guidelines");
    await delay(400);
    onStep?.("recommendation");
    await delay(300);
  } else {
    onStep?.("guidelines");
    await delay(250);
    onStep?.("recommendation");
    await delay(200);
  }

  const base =
    serverBase ??
    applyLocationContext(evaluateFoodSafetyMulti(foodQuery, conditions));
  return persistAnalysis(finalizeAnalysis(base, foodQuery, conditions));
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

  if (identification.status !== "success" || !identification.foodName) {
    return { identification };
  }

  onStep?.("nutrition");
  const serverBase = await requestServerAnalysis(identification.foodName, conditions);

  if (!serverBase) {
    await delay(400);
    onStep?.("guidelines");
    await delay(400);
    onStep?.("recommendation");
    await delay(300);
  } else {
    onStep?.("guidelines");
    await delay(250);
    onStep?.("recommendation");
    await delay(200);
  }

  const base =
    serverBase ??
    applyLocationContext(evaluateFoodSafetyMulti(identification.foodName, conditions));
  const analysis = await persistAnalysis({
    ...finalizeAnalysis(base, identification.foodName, conditions),
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
  const serverBase = await requestServerAnalysis(foodName, conditions);

  if (!serverBase) {
    await delay(350);
    onStep?.("guidelines");
    await delay(350);
    onStep?.("recommendation");
    await delay(250);
  } else {
    onStep?.("guidelines");
    await delay(250);
    onStep?.("recommendation");
    await delay(200);
  }

  const base =
    serverBase ??
    applyLocationContext(evaluateFoodSafetyMulti(foodName, conditions));
  return persistAnalysis({
    ...finalizeAnalysis(base, foodName, conditions),
    source: "scan",
  });
}
