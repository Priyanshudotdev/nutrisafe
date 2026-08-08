import { NutritionData, RuleResult, CKDDetails, HeartDetails } from "./types";
import { evaluateDiabetes } from "./diabetes";
import { evaluateCKD } from "./ckd";
import { evaluateHeart } from "./heart";
import { evaluateCeliac } from "./celiac";
import { evaluateAllergies } from "./allergies";

export type EvaluationInput = {
  profile: {
    conditions?: string[];
    allergies?: string[];
    weight?: number;
    ckdDetails?: CKDDetails;
    heartDetails?: HeartDetails;
  };
  foodName: string;
  aliases?: string[];
  nutrition: Partial<NutritionData>;
};

export function evaluateFood(input: EvaluationInput): RuleResult[] {
  const results: RuleResult[] = [];
  const conditions = input.profile.conditions || [];
  
  if (conditions.includes("diabetes")) {
    results.push(evaluateDiabetes(input.nutrition));
  }
  
  if (conditions.includes("ckd")) {
    results.push(evaluateCKD(input.nutrition, input.profile.ckdDetails, input.profile.weight));
  }
  
  if (conditions.includes("heart_hypertension")) {
    results.push(evaluateHeart(input.nutrition, input.profile.heartDetails));
  }
  
  if (conditions.includes("celiac")) {
    results.push(evaluateCeliac(input.foodName, input.aliases));
  }
  
  const allergies = input.profile.allergies || [];
  if (allergies.length > 0) {
    results.push(evaluateAllergies(input.foodName, input.aliases, allergies));
  }
  
  return results;
}
