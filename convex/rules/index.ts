import { evaluateDiabetes } from "./diabetes";
import { evaluateCKD } from "./ckd";
import { evaluateHeart } from "./heart";
import { evaluateCeliac } from "./celiac";
import { evaluateAllergies } from "./allergies";

export function evaluateFood(params: { profile: any; foodName: string; nutrition: any }) {
  const { profile, foodName, nutrition } = params;
  let ruleResults: any[] = [];

  // Check conditions
  const conditions = profile.conditions || [];
  
  if (conditions.includes("diabetes")) {
    ruleResults = ruleResults.concat(evaluateDiabetes(nutrition));
  }
  
  if (conditions.includes("ckd")) {
    ruleResults = ruleResults.concat(evaluateCKD(nutrition));
  }
  
  if (conditions.includes("heart_hypertension")) {
    ruleResults = ruleResults.concat(evaluateHeart(nutrition));
  }
  
  if (conditions.includes("celiac")) {
    ruleResults = ruleResults.concat(evaluateCeliac(foodName));
  }
  
  if (conditions.includes("food_allergy") || (profile.allergies && profile.allergies.length > 0)) {
    ruleResults = ruleResults.concat(evaluateAllergies(foodName, profile.allergies || []));
  }

  // Determine final verdict
  let verdict: "safe" | "moderation" | "not_recommended" = "safe";
  
  const hasDanger = ruleResults.some(r => r.status === "danger");
  const hasWarning = ruleResults.some(r => r.status === "warning");

  if (hasDanger) {
    verdict = "not_recommended";
  } else if (hasWarning) {
    verdict = "moderation";
  }

  return {
    verdict,
    ruleResults
  };
}
