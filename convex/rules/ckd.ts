import { RuleResult, NutritionData, CKDDetails } from "./types";

// Kidney Disease Outcomes Quality Initiative (KDOQI) / NKF Guidelines
export const CKD_BASE_THRESHOLDS = {
  highSodium: 400, // mg per 100g (General warning for 2300mg/day limit)
  highPotassium: 300, // mg per 100g (Used only if restricted)
  highPhosphorus: 150, // mg per 100g (Used only if restricted)
  highProtein: 15, // g per 100g (Used for evaluating protein density)
};

export function evaluateCKD(
  nutrition: Partial<NutritionData>,
  ckdDetails?: CKDDetails,
  userWeightKg?: number
): RuleResult {
  const factors: RuleResult["factors"] = [];

  const potassium = nutrition.potassium ?? 0;
  const phosphorus = nutrition.phosphorus ?? 0;
  const sodium = nutrition.sodium ?? 0;
  const protein = nutrition.protein ?? 0;

  let requiresPersonalizedGuidance = false;

  // 1. Sodium (Universally restricted in CKD, typically <2300mg/day)
  if (
    sodium >=
    (ckdDetails?.sodiumLimit ? ckdDetails.sodiumLimit / 5 : CKD_BASE_THRESHOLDS.highSodium)
  ) {
    factors.push({
      nutrient: "sodium",
      value: sodium,
      reason: `High sodium (${sodium}mg). NKF advises limiting sodium to manage blood pressure and fluid retention in CKD.`,
      severity: "high",
      isPositive: false,
    });
  }

  // 2. Potassium (Highly individualized based on lab results)
  if (ckdDetails?.potassiumStatus === "high") {
    if (potassium >= CKD_BASE_THRESHOLDS.highPotassium) {
      factors.push({
        nutrient: "potassium",
        value: potassium,
        reason: `High potassium (${potassium}mg). Your profile indicates a need for potassium restriction.`,
        severity: "high",
        isPositive: false,
      });
    }
  } else if (!ckdDetails?.potassiumStatus) {
    requiresPersonalizedGuidance = true;
    if (potassium >= CKD_BASE_THRESHOLDS.highPotassium) {
      factors.push({
        nutrient: "potassium",
        value: potassium,
        reason: `High potassium (${potassium}mg). Whether this is safe depends entirely on your current lab results.`,
        severity: "medium",
        isPositive: false,
      });
    }
  }

  // 3. Phosphorus (Restricted in advanced CKD or if labs are high)
  if (
    ckdDetails?.phosphorusStatus === "high" ||
    ckdDetails?.stage === "G4" ||
    ckdDetails?.stage === "G5"
  ) {
    if (phosphorus >= CKD_BASE_THRESHOLDS.highPhosphorus) {
      factors.push({
        nutrient: "phosphorus",
        value: phosphorus,
        reason: `High phosphorus (${phosphorus}mg). Needs restriction in advanced CKD or when labs indicate high levels.`,
        severity: "high",
        isPositive: false,
      });
    }
  } else if (!ckdDetails?.phosphorusStatus) {
    requiresPersonalizedGuidance = true;
    if (phosphorus >= CKD_BASE_THRESHOLDS.highPhosphorus) {
      factors.push({
        nutrient: "phosphorus",
        value: phosphorus,
        reason: `High phosphorus (${phosphorus}mg). Depending on your stage, this may require a phosphate binder.`,
        severity: "medium",
        isPositive: false,
      });
    }
  }

  // 4. Protein (Dependent on Dialysis and Stage)
  if (ckdDetails?.dialysis) {
    if (protein >= CKD_BASE_THRESHOLDS.highProtein) {
      factors.push({
        nutrient: "protein",
        value: protein,
        reason: `High protein (${protein}g). Dialysis patients generally require higher protein intake to replace losses.`,
        severity: "low",
        isPositive: true,
      });
    }
  } else if (
    ckdDetails?.stage === "G3a" ||
    ckdDetails?.stage === "G3b" ||
    ckdDetails?.stage === "G4" ||
    ckdDetails?.stage === "G5"
  ) {
    if (protein >= CKD_BASE_THRESHOLDS.highProtein) {
      factors.push({
        nutrient: "protein",
        value: protein,
        reason: `High protein (${protein}g). KDIGO suggests protein restriction (e.g., 0.55-0.8g/kg/day) to slow CKD progression.`,
        severity: "high",
        isPositive: false,
      });
    }
  } else if (!ckdDetails?.stage) {
    requiresPersonalizedGuidance = true;
  }

  // Determine verdict based on factors
  let verdict: RuleResult["verdict"] = "safe";
  if (factors.some((f) => f.severity === "high")) {
    verdict = "not_recommended";
  } else if (factors.some((f) => f.severity === "medium")) {
    verdict = "moderation";
  }

  // Soften the blow if they just lack personalization but don't have dangerous universal levels
  if (
    requiresPersonalizedGuidance &&
    verdict === "not_recommended" &&
    sodium < CKD_BASE_THRESHOLDS.highSodium
  ) {
    verdict = "moderation";
  }

  return {
    condition: "ckd",
    ruleVersion: "ckd-v1",
    confidence: ckdDetails ? "high" : "low",
    verdict,
    factors,
    requiresPersonalizedGuidance,
  };
}
