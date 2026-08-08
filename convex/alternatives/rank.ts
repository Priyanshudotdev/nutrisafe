import { evaluateFood } from "../rules/evaluate";
import { Food, PatientProfile, RankedAlternative } from "../rules/types";

export function rankAlternatives(originalFood: Food, candidates: Food[], profile: PatientProfile): RankedAlternative[] {
  const ranked: RankedAlternative[] = [];

  for (const candidate of candidates) {
    if (candidate._id === originalFood._id) continue;

    const ruleResults = evaluateFood({
      profile,
      foodName: candidate.name || candidate.foodName || "Unknown",
      nutrition: candidate.nutrition,
    });

    if (ruleResults.some(r => r.verdict === "not_recommended")) {
      continue;
    }

    const hasAllergies = profile.conditions?.includes("food_allergy") || (profile.allergies && profile.allergies.length > 0);
    if (hasAllergies && !candidate.verifiedAllergens) {
      continue; 
    }

    let score = 0;
    const isModeration = ruleResults.some(r => r.verdict === "moderation");
    const verdict = isModeration ? "moderation" : "safe";

    if (verdict === "safe") {
      score += 100;
    } else {
      score += 40;
    }

    if (candidate.category && candidate.category === originalFood.category) {
      score += 10;
    }

    const origKcal = originalFood.nutrition?.energyKcal || 0;
    const candKcal = candidate.nutrition?.energyKcal || 0;
    if (origKcal > 0 && Math.abs(origKcal - candKcal) < 50) {
      score += 5;
    }

    ranked.push({
      food: candidate,
      verdict,
      ruleResults,
      score,
    });
  }

  ranked.sort((a, b) => b.score - a.score);

  return ranked;
}
