/* Type declarations for the shared deterministic safety engine.
 * The implementation lives in safety-engine.js so the Node API and the Expo
 * client run the exact same code.
 */

export type EngineCondition = "diabetes" | "ckd" | "hypertension" | "celiac" | "allergy";

export type EngineStatus = "safe" | "moderation" | "not_recommended" | "unable_to_verify";

export interface EngineEvidence {
  condition: EngineCondition;
  nutrient: string;
  label: string;
  value: number | string;
  unit: string;
  servingLabel: string;
  ruleId: string;
  ruleVersion: string;
  threshold: string;
  status: EngineStatus;
  source: string;
  note: string;
}

export interface EngineConditionOutcome {
  condition: EngineCondition;
  label: string;
  status: EngineStatus;
  statusHeadline: string;
  summary: string;
  evidence: EngineEvidence[];
  missing: string[];
}

export interface EngineFactor {
  name: string;
  level: "Low" | "Moderate" | "High" | "Contains" | "None" | "Unknown";
  impact: "positive" | "neutral" | "warning" | "danger";
  detail: string;
}

export interface EngineAlternative {
  name: string;
  reason: string;
  icon: string;
}

export interface EngineFoodReference {
  foodId: string;
  canonicalName: string;
  category: string;
  source: string;
  sourceType: string;
  verified: boolean;
  uncertainty: string;
  servingLabel: string;
  grams: number;
  matchedAlias: string;
  matchType: "exact" | "contains" | "word";
  ingredients: string[];
}

export interface EngineServing {
  unit: string;
  grams: number;
  label: string;
}

export interface EngineAnalysis {
  id: string;
  foodName: string;
  category: string;
  condition: EngineCondition;
  conditions: EngineCondition[];
  status: EngineStatus;
  statusHeadline: string;
  summary: string;
  detailedWhy: string;
  factors: EngineFactor[];
  alternatives: EngineAlternative[];
  evidence: EngineEvidence[];
  dataGaps: string[];
  conditionOutcomes: EngineConditionOutcome[];
  ruleVersion: string;
  serving: EngineServing | null;
  foodReference: EngineFoodReference | null;
  confidence: "high" | "medium" | "low";
  portionGuidance: string;
  timestamp: string;
  source?: "text" | "scan";
  scanConfidence?: number;
}

export interface EngineReference {
  foodId: string;
  canonicalName: string;
  category: string;
  matchedAlias: string;
  matchType: "exact" | "contains" | "word";
  serving: EngineServing;
  per100g: Record<string, number>;
  units: Record<string, number>;
  profile: {
    ingredients: string[];
    gluten: "contains" | "free" | "uncertain";
    allergens: string[];
    possibleAllergens: string[];
    allergensKnown: boolean;
    crossContact: boolean;
    note: string;
  };
  ingredients: string[];
  source: {
    dataset: string;
    type: string;
    verified: boolean;
    uncertainty: string;
  };
}

export interface AnalyzeOptions {
  patient?: { allergensList?: string[] };
  identity?: { confirmed?: boolean; source?: string; confidence?: number };
  records?: Record<string, number>[];
  referenceOverride?: EngineReference;
}

export declare const RULE_VERSION: string;
export declare const STATUS: {
  SAFE: "safe";
  MODERATION: "moderation";
  NOT_RECOMMENDED: "not_recommended";
  UNABLE: "unable_to_verify";
};
export declare const STATUS_PRECEDENCE: Record<EngineStatus, number>;
export declare const STATUS_HEADLINES: Record<EngineStatus, string>;
export declare const CONDITION_LABELS: Record<EngineCondition, string>;
export declare const VALID_CONDITIONS: EngineCondition[];
export declare const DEFAULT_VISION_THRESHOLD: number;
export declare const AMBIGUITY_GAP: number;

export declare function analyzeFood(
  foodName: string,
  conditions: EngineCondition[],
  options?: AnalyzeOptions
): EngineAnalysis;

export declare function evaluateReference(
  reference: EngineReference,
  conditions: EngineCondition[],
  options?: AnalyzeOptions
): {
  status: EngineStatus;
  statusHeadline: string;
  outcomes: Array<{
    condition: EngineCondition;
    status: EngineStatus;
    evidence: EngineEvidence[];
    missing: string[];
    summary: string;
  }>;
};

export declare function resolveFoodReference(foodName: string): EngineReference | null;

export declare function assessVisionIdentity(
  result: {
    foodName?: string;
    confidence?: number;
    candidates?: Array<{ name: string; confidence: number }>;
  },
  threshold?: number
): { decision: "success" | "uncertain" | "failed"; reason: string };

export declare function detectConflicts(records: Record<string, number>[]): Set<string>;
export declare function valuePerServing(
  reference: EngineReference,
  nutrient: string
): number | null;
