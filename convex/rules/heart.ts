import { RuleResult, NutritionData, HeartDetails } from "./types";

// AHA 2026 Guidelines for Heart Disease & Hypertension
export const HEART_THRESHOLDS = {
  // General baseline targets if no specific limit is provided
  highSodium: 400, // mg per 100g 
  moderateSodium: 140, // mg per 100g 
  
  highSaturatedFat: 4, // g per 100g
  moderateSaturatedFat: 2, // g per 100g

  highFreeSugar: 10, // g per 100g (Secondary factor for heart health)
  goodFibre: 3, // g per 100g (Positive factor)
};

export function evaluateHeart(
  nutrition: Partial<NutritionData>,
  heartDetails?: HeartDetails
): RuleResult {
  const factors: RuleResult["factors"] = [];
  
  const sodium = nutrition.sodium ?? 0;
  const satFat = nutrition.saturatedFat ?? 0;
  const freeSugar = nutrition.freeSugar ?? 0;
  const fibre = nutrition.fibre ?? 0;

  let negativeScore = 0;
  let positiveScore = 0;
  let requiresPersonalizedGuidance = false;

  // 1. Sodium (Major factor)
  const sodiumLimit = heartDetails?.sodiumLimit ? heartDetails.sodiumLimit / 5 : HEART_THRESHOLDS.highSodium;
  const moderateSodiumLimit = heartDetails?.sodiumLimit ? heartDetails.sodiumLimit / 15 : HEART_THRESHOLDS.moderateSodium;
  
  if (sodium >= sodiumLimit) {
    factors.push({
      nutrient: "sodium", value: sodium,
      reason: `Very high sodium (${sodium}mg). AHA recommends minimizing sodium, especially for hypertension.`,
      severity: "high", isPositive: false
    });
    negativeScore += 3;
    if (!heartDetails?.sodiumLimit && heartDetails?.hasHypertension) requiresPersonalizedGuidance = true;
  } else if (sodium >= moderateSodiumLimit) {
    factors.push({
      nutrient: "sodium", value: sodium,
      reason: `Moderate sodium (${sodium}mg). Monitor total daily intake.`,
      severity: "medium", isPositive: false
    });
    negativeScore += 1;
  }

  // 2. Saturated Fat (Major factor)
  const satFatLimit = heartDetails?.saturatedFatLimit ? heartDetails.saturatedFatLimit / 5 : HEART_THRESHOLDS.highSaturatedFat;
  
  if (satFat >= satFatLimit) {
    factors.push({
      nutrient: "saturatedFat", value: satFat,
      reason: `High saturated fat (${satFat}g). Can raise LDL cholesterol levels and cardiovascular risk.`,
      severity: "high", isPositive: false
    });
    negativeScore += 2;
  } else if (satFat >= HEART_THRESHOLDS.moderateSaturatedFat) {
    factors.push({
      nutrient: "saturatedFat", value: satFat,
      reason: `Moderate saturated fat (${satFat}g).`,
      severity: "medium", isPositive: false
    });
    negativeScore += 1;
  }

  // 3. Free Sugar (Secondary factor)
  if (freeSugar >= HEART_THRESHOLDS.highFreeSugar) {
    factors.push({
      nutrient: "freeSugar", value: freeSugar,
      reason: `High free sugar (${freeSugar}g). AHA advises limiting added sugars for overall heart health.`,
      severity: "medium", isPositive: false
    });
    negativeScore += 1;
  }

  // 4. Fiber (Positive factor)
  if (fibre >= HEART_THRESHOLDS.goodFibre) {
    factors.push({
      nutrient: "fibre", value: fibre,
      reason: `Good source of fiber (${fibre}g), which supports cardiovascular health.`,
      severity: "medium", isPositive: true
    });
    positiveScore += 2;
  }

  // Verdict Logic: Net score evaluation
  const netScore = negativeScore - positiveScore;
  let verdict: RuleResult["verdict"] = "safe";

  // NOT_RECOMMENDED reserved for extreme negatives (e.g. high sodium + high sat fat with no fiber)
  if (negativeScore >= 4 && netScore >= 3) {
    verdict = "not_recommended";
  } else if (netScore > 0 || negativeScore > 0) {
    verdict = "moderation";
  }

  // Soften verdict if lacking personalized limits but having hypertension
  if (requiresPersonalizedGuidance && verdict === "not_recommended") {
    verdict = "moderation";
  }

  return { 
    condition: "heart_hypertension", 
    ruleVersion: "heart-v1",
    confidence: heartDetails ? "high" : "low",
    verdict, 
    factors,
    requiresPersonalizedGuidance
  };
}
