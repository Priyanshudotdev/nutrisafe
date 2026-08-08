import { RuleResult, NutritionData } from "./types";

// ADA 2026 / NIDDK Guidelines for Diabetes
export const DIABETES_THRESHOLDS = {
  // ADA/NIDDK: Minimize added sugars. >10g per 100g is a high concentration.
  highFreeSugar: 10,
  moderateFreeSugar: 5,
  // High carbohydrate density (>40g per 100g requires portion management)
  highCarbs: 40,
  // ADA: ~14g fiber per 1000 kcal. For a 100g portion, >3g is considered a good source.
  goodFibre: 3,
  // ADA: Saturated fat should be limited to reduce cardiovascular risk
  highSaturatedFat: 5,
};

export function evaluateDiabetes(nutrition: Partial<NutritionData>): RuleResult {
  const factors: RuleResult["factors"] = [];
  
  const freeSugar = nutrition.freeSugar ?? 0;
  const carbs = nutrition.carbohydrates ?? 0;
  const fibre = nutrition.fibre ?? 0;
  const satFat = nutrition.saturatedFat ?? 0;

  let negativeScore = 0;
  let positiveScore = 0;

  // 1. Free Sugar Check
  if (freeSugar >= DIABETES_THRESHOLDS.highFreeSugar) {
    factors.push({
      nutrient: "freeSugar", value: freeSugar,
      reason: `Contains ${freeSugar}g of free sugar. ADA guidelines advise minimizing added sugars.`,
      severity: "high", isPositive: false
    });
    negativeScore += 3;
  } else if (freeSugar >= DIABETES_THRESHOLDS.moderateFreeSugar) {
    factors.push({
      nutrient: "freeSugar", value: freeSugar,
      reason: `Moderate free sugar (${freeSugar}g). Consume in moderation.`,
      severity: "medium", isPositive: false
    });
    negativeScore += 1;
  }

  // 2. Carbohydrate & Fiber Check
  if (carbs >= DIABETES_THRESHOLDS.highCarbs) {
    if (fibre < DIABETES_THRESHOLDS.goodFibre) {
      factors.push({
        nutrient: "carbohydrates", value: carbs,
        reason: `High carbohydrate density (${carbs}g) with low fiber (${fibre}g). May cause rapid glucose spikes.`,
        severity: "high", isPositive: false
      });
      negativeScore += 2;
    } else {
      factors.push({
        nutrient: "carbohydrates", value: carbs,
        reason: `High carbohydrates (${carbs}g), but contains fiber. Portion control advised.`,
        severity: "medium", isPositive: false
      });
      negativeScore += 1;
    }
  }

  // 3. Positive Fiber Check
  if (fibre >= DIABETES_THRESHOLDS.goodFibre) {
    factors.push({
      nutrient: "fibre", value: fibre,
      reason: `Good source of fiber (${fibre}g), which helps stabilize blood sugar according to ADA guidelines.`,
      severity: "medium", isPositive: true
    });
    positiveScore += 2;
  }

  // 4. Saturated Fat Check (Secondary warning)
  if (satFat >= DIABETES_THRESHOLDS.highSaturatedFat) {
    factors.push({
      nutrient: "saturatedFat", value: satFat,
      reason: `High saturated fat (${satFat}g). ADA recommends limiting to manage cardiovascular risk.`,
      severity: "medium", isPositive: false
    });
    negativeScore += 1;
  }

  // Verdict Logic: Net score evaluation
  const netScore = negativeScore - positiveScore;
  let verdict: RuleResult["verdict"] = "safe";

  // NOT_RECOMMENDED reserved for extreme negatives (e.g. very high sugar without fiber)
  if (negativeScore >= 3 && netScore >= 3) {
    verdict = "not_recommended";
  } else if (netScore > 0 || negativeScore > 0) {
    verdict = "moderation";
  }

  return { 
    condition: "diabetes", 
    ruleVersion: "diabetes-v1",
    confidence: "high",
    verdict, 
    factors 
  };
}
