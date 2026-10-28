// ─── Food Safety Data Models + shared deterministic engine ───────────────────
//
// The verdict logic lives in server/safety-engine.js so the API and the app
// evaluate the exact same evidence. This module only defines the UI-facing
// types and the reactive store.

import {
  analyzeFood,
  RULE_VERSION,
  STATUS_HEADLINES,
  type EngineAlternative,
  type EngineAnalysis,
  type EngineConditionOutcome,
  type EngineEvidence,
  type EngineFoodReference,
  type EngineServing,
} from "../../server/safety-engine";

export type PatientCondition = "diabetes" | "ckd" | "hypertension" | "celiac" | "allergy";

export type SafetyStatus = "safe" | "moderation" | "not_recommended" | "unable_to_verify";

export const GENDER_OPTIONS = ["Male", "Female", "Other", "Prefer not to say"] as const;
export type GenderOption = (typeof GENDER_OPTIONS)[number];

export interface ConditionMeta {
  id: PatientCondition;
  title: string;
  shortName: string;
  badgeLabel: string;
  description: string;
  iconName: string;
  accentColor: string;
  bgColor: string;
  keyNutrients: string[];
}

export interface NutrientFactor {
  name: string;
  level: "Low" | "Moderate" | "High" | "Contains" | "None" | "Unknown";
  impact: "positive" | "neutral" | "warning" | "danger";
  detail: string;
}

export interface FoodAlternative {
  name: string;
  reason: string;
  icon: string;
}

export type EvidenceItem = EngineEvidence;
export type ConditionOutcome = EngineConditionOutcome;
export type FoodReferenceInfo = EngineFoodReference;
export type ServingInfo = EngineServing;

export interface FoodSafetyAnalysis {
  id: string;
  foodName: string;
  category: string;
  /** Primary (first) condition the analysis was evaluated against. */
  condition: PatientCondition;
  /** All conditions considered — analyses are merged worst-case across them. */
  conditions?: PatientCondition[];
  status: SafetyStatus;
  statusHeadline: string;
  summary: string;
  detailedWhy: string;
  factors: NutrientFactor[];
  alternatives: FoodAlternative[];
  portionGuidance?: string;
  timestamp: string;
  source?: "text" | "scan";
  scanConfidence?: number;

  // ── Evidence trail (present on every new analysis; optional for legacy rows)
  evidence?: EvidenceItem[];
  dataGaps?: string[];
  conditionOutcomes?: ConditionOutcome[];
  ruleVersion?: string;
  serving?: ServingInfo | null;
  foodReference?: FoodReferenceInfo | null;
  confidence?: "high" | "medium" | "low";
}

export interface PatientProfile {
  name: string;
  age: number | null;
  gender: string | null;
  email?: string;
  city?: string | null;
  primaryCondition: PatientCondition;
  /** All active conditions. Falls back to [primaryCondition] when absent. */
  conditions?: PatientCondition[];
  notes: string;
  allergensList: string[];
  doctorName?: string | null;
  /** False until the user finishes the post-signup health onboarding flow. */
  onboardingCompleted?: boolean;
}

/** Conditions for a profile — handles legacy profiles that only have primaryCondition. */
export function getProfileConditions(
  profile: Pick<PatientProfile, "primaryCondition" | "conditions">
): PatientCondition[] {
  if (Array.isArray(profile.conditions) && profile.conditions.length > 0) {
    return profile.conditions;
  }
  return [profile.primaryCondition];
}

// ─── 5 Patient Medical Categories ─────────────────────────────────────────────
export const PATIENT_CONDITIONS: ConditionMeta[] = [
  {
    id: "ckd",
    title: "Chronic Kidney Disease",
    shortName: "CKD",
    badgeLabel: "Kidney Health (CKD)",
    description: "Monitors Potassium, Phosphorus, Sodium & Protein load.",
    iconName: "fitness-outline",
    accentColor: "#0D9488",
    bgColor: "#F0FDFA",
    keyNutrients: ["Potassium", "Phosphorus", "Sodium", "Protein"],
  },
  {
    id: "diabetes",
    title: "Diabetes (Type 1 & 2)",
    shortName: "Diabetes",
    badgeLabel: "Glycemic & Glucose",
    description: "Evaluates Sugar & Carbohydrate load per serving.",
    iconName: "pulse-outline",
    accentColor: "#2563EB",
    bgColor: "#EFF6FF",
    keyNutrients: ["Sugars", "Total Carbs", "Fiber"],
  },
  {
    id: "hypertension",
    title: "Heart Disease & Hypertension",
    shortName: "Heart / BP",
    badgeLabel: "Heart & Blood Pressure",
    description: "Monitors Sodium, Saturated Fats & Cholesterol.",
    iconName: "heart-outline",
    accentColor: "#DC2626",
    bgColor: "#FEF2F2",
    keyNutrients: ["Sodium", "Saturated Fat", "Trans Fat", "Cholesterol"],
  },
  {
    id: "celiac",
    title: "Celiac Disease",
    shortName: "Celiac",
    badgeLabel: "Gluten-Free",
    description: "Identifies Wheat, Rye, Barley, Spelt & hidden gluten cross-contamination.",
    iconName: "shield-checkmark-outline",
    accentColor: "#D97706",
    bgColor: "#FFFBEB",
    keyNutrients: ["Gluten Presence", "Cross-Contact Risk", "Safe Grains"],
  },
  {
    id: "allergy",
    title: "Food Allergy",
    shortName: "Allergy",
    badgeLabel: "Allergen Screening",
    description: "Flags Peanuts, Tree Nuts, Dairy, Soy, Shellfish & Histamines.",
    iconName: "alert-circle-outline",
    accentColor: "#7C3AED",
    bgColor: "#F5F3FF",
    keyNutrients: ["Peanuts / Nuts", "Dairy", "Shellfish", "Soy / Eggs"],
  },
];

// ─── Patient Profile ─────────────────────────────────────────────────────────
export const INITIAL_PATIENT: PatientProfile = {
  name: "",
  age: null,
  gender: null,
  email: "",
  city: null,
  primaryCondition: "ckd",
  conditions: ["ckd"],
  notes: "",
  allergensList: [],
  doctorName: null,
  onboardingCompleted: false,
};

/** Recent search suggestions — India-focused staples; each still evaluated individually. */
export const FOOD_SUGGESTIONS = [
  "Idli",
  "Dal",
  "Roti",
  "Khichdi",
  "Banana",
  "Curd",
  "Poha",
  "Paneer",
  "Rice",
  "Dosa",
] as const;

// ─── Engine adapter ──────────────────────────────────────────────────────────
//
// Every verdict comes from the deterministic engine. There is deliberately no
// keyword fallback and no default "safe" branch: an unresolved food or a
// missing nutrient becomes "unable_to_verify".

export interface EvaluateOptions {
  patient?: Pick<PatientProfile, "allergensList">;
  identity?: { confirmed?: boolean; source?: "text" | "scan"; confidence?: number };
}

export function evaluateFoodSafetyMulti(
  foodQuery: string,
  conditions: PatientCondition[],
  options: EvaluateOptions = {}
): FoodSafetyAnalysis {
  return analyzeFood(foodQuery, conditions, {
    patient: { allergensList: options.patient?.allergensList ?? [] },
    identity: options.identity,
  }) as FoodSafetyAnalysis;
}

/** Single-condition helper kept for callers/tests. */
export function evaluateFoodSafety(
  foodQuery: string,
  condition: PatientCondition,
  options: EvaluateOptions = {}
): FoodSafetyAnalysis {
  return evaluateFoodSafetyMulti(foodQuery, [condition], options);
}

/**
 * Saved history can contain results from an older engine (including legacy AI
 * verdicts that had no evidence). Those must never keep a green badge: they are
 * re-labelled as unverified until the user runs the check again.
 */
export function normalizeStoredAnalysis(analysis: FoodSafetyAnalysis): FoodSafetyAnalysis {
  const isCurrent = analysis.ruleVersion === RULE_VERSION && Array.isArray(analysis.evidence);
  if (isCurrent) return analysis;

  return {
    ...analysis,
    status: "unable_to_verify",
    statusHeadline: STATUS_HEADLINES.unable_to_verify,
    summary:
      "This saved check was produced by an older rules engine and cannot be relied on. Run the check again for an evidence-backed result.",
    detailedWhy:
      "The original verdict had no current rule version or evidence trail, so it has been marked unverified instead of being displayed as safe.",
    factors: [],
    alternatives: [],
    evidence: [],
    dataGaps: [
      "This saved result predates the current evidence-backed engine, so its verdict and explanation cannot be reproduced.",
    ],
    conditionOutcomes: [],
    serving: null,
    foodReference: null,
    confidence: "low",
    portionGuidance: "Run the food check again to get a verified verdict.",
  };
}

export { RULE_VERSION, STATUS_HEADLINES };

// ─── Reactive Store for Food Safety Analyses ─────────────────────────────────
type Listener = () => void;
class FoodSafetyStore {
  private history: FoodSafetyAnalysis[] = [];
  private currentPatient: PatientProfile = { ...INITIAL_PATIENT };
  private selectedConditions: PatientCondition[] = ["ckd"];
  private listeners: Set<Listener> = new Set();

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((cb) => cb());
  }

  getHistory(): FoodSafetyAnalysis[] {
    return this.history.map((h) => ({
      ...h,
      factors: [...h.factors],
      alternatives: [...h.alternatives],
      ...(h.conditions ? { conditions: [...h.conditions] } : {}),
      ...(h.evidence ? { evidence: [...h.evidence] } : {}),
      ...(h.dataGaps ? { dataGaps: [...h.dataGaps] } : {}),
      ...(h.conditionOutcomes
        ? {
            conditionOutcomes: h.conditionOutcomes.map((o) => ({
              ...o,
              evidence: [...o.evidence],
              missing: [...o.missing],
            })),
          }
        : {}),
    }));
  }

  setHistory(history: FoodSafetyAnalysis[]) {
    const normalized = history.map(normalizeStoredAnalysis);
    if (JSON.stringify(this.history) === JSON.stringify(normalized)) return;
    this.history = normalized;
    this.notify();
  }

  getPatient(): PatientProfile {
    return {
      ...this.currentPatient,
      ...(this.currentPatient.conditions
        ? { conditions: [...this.currentPatient.conditions] }
        : {}),
      allergensList: [...this.currentPatient.allergensList],
    };
  }

  updatePatient(profile: Partial<PatientProfile>) {
    const next = { ...this.currentPatient, ...profile };
    if (profile.conditions && profile.conditions.length > 0) {
      next.conditions = [...profile.conditions];
    }
    if (JSON.stringify(this.currentPatient) === JSON.stringify(next)) return;
    this.currentPatient = next;
    if (profile.conditions && profile.conditions.length > 0) {
      this.selectedConditions = [...profile.conditions];
      this.currentPatient.primaryCondition = profile.conditions[0];
    } else if (profile.primaryCondition) {
      this.selectedConditions = [profile.primaryCondition];
    }
    this.notify();
  }

  hydratePatient(profile: PatientProfile) {
    const next = { ...profile };
    if (JSON.stringify(this.currentPatient) === JSON.stringify(next)) {
      const conds = getProfileConditions(profile);
      if (JSON.stringify(this.selectedConditions) === JSON.stringify(conds)) return;
    }
    this.currentPatient = { ...profile };
    const conds = getProfileConditions(profile);
    this.selectedConditions = conds;
    this.currentPatient.primaryCondition = conds[0];
    this.notify();
  }

  getSelectedConditions(): PatientCondition[] {
    return [...this.selectedConditions];
  }

  setSelectedConditions(conditions: PatientCondition[]) {
    const unique = [...new Set(conditions)];
    this.selectedConditions = unique;
    this.currentPatient.conditions = unique;
    this.currentPatient.primaryCondition = unique[0] ?? "ckd";
    this.notify();
  }

  addAnalysis(analysis: FoodSafetyAnalysis) {
    this.history = [analysis, ...this.history];
    this.notify();
  }

  removeAnalysis(id: string) {
    this.history = this.history.filter((a) => a.id !== id);
    this.notify();
  }

  clearHistory() {
    this.history = [];
    this.notify();
  }

  /** Signed-out state: no previous user's profile, conditions, or history leak through. */
  resetSession() {
    this.history = [];
    this.currentPatient = { ...INITIAL_PATIENT };
    this.selectedConditions = ["ckd"];
    this.notify();
  }
}

export const foodSafetyStore = new FoodSafetyStore();

export type { EngineAlternative, EngineAnalysis, EngineConditionOutcome, EngineEvidence };
