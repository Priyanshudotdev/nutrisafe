import { evaluateFood } from "../rules/evaluate";
import { Food, PatientProfile, RuleResult, NutritionData } from "../rules/types";

export type MealCandidate = {
  foods: Food[];
  mealName: string;
  combinedNutrition: NutritionData;
};

export type RankedMeal = {
  candidate: MealCandidate;
  verdict: "safe" | "moderation" | "not_recommended";
  ruleResults: RuleResult[];
  score: number;
};

export function combineNutrition(foods: Food[]): NutritionData {
  const combined = { ...foods[0].nutrition };
  // Zero out for clean summation
  for (const key in combined) {
    (combined as any)[key] = 0;
  }

  for (const f of foods) {
    for (const [k, v] of Object.entries(f.nutrition)) {
      if (typeof v === "number") {
        (combined as any)[k] = ((combined as any)[k] || 0) + v;
      }
    }
  }
  return combined;
}

export function getCombinations(foods: Food[]): Food[][] {
  const result: Food[][] = [];
  const f = function (prefix: Food[], foods: Food[]) {
    for (let i = 0; i < foods.length; i++) {
      const newPrefix = [...prefix, foods[i]];
      result.push(newPrefix);
      f(newPrefix, foods.slice(i + 1));
    }
  };
  f([], foods);

  // Return combinations of length 1, 2, or 3 to avoid absurdly huge meals
  return result.filter((combo) => combo.length > 0 && combo.length <= 3);
}

export function rankMeals(availableFoods: Food[], profile: PatientProfile): RankedMeal[] {
  const combinations = getCombinations(availableFoods);
  const ranked: RankedMeal[] = [];

  for (const combo of combinations) {
    const mealName = combo.map((f) => f.name || f.foodName).join(" + ");
    const combinedNutrition = combineNutrition(combo);

    const ruleResults = evaluateFood({
      profile,
      foodName: mealName,
      nutrition: combinedNutrition,
    });

    if (ruleResults.some((r) => r.verdict === "not_recommended")) {
      continue;
    }

    const hasAllergies =
      profile.conditions?.includes("food_allergy") ||
      (profile.allergies && profile.allergies.length > 0);
    // If ANY food in the combo is an unknown allergen, reject the meal
    const unknownAllergen = combo.some((f) => !f.verifiedAllergens);
    if (hasAllergies && unknownAllergen) {
      continue;
    }

    let score = 0;
    const isModeration = ruleResults.some((r) => r.verdict === "moderation");
    const verdict = isModeration ? "moderation" : "safe";

    if (verdict === "safe") score += 100;
    else score += 40;

    // Prefer 2 or 3 item combinations (meals) over single ingredients
    if (combo.length === 2) score += 20;
    if (combo.length === 3) score += 30;

    // Penalize if the meal is too huge in calories (e.g. > 1000)
    if (combinedNutrition.energyKcal > 1000) score -= 30;

    ranked.push({
      candidate: {
        foods: combo,
        mealName,
        combinedNutrition,
      },
      verdict,
      ruleResults,
      score,
    });
  }

  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}
