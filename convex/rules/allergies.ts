import { RuleResult } from "./types";

export function evaluateAllergies(
  foodName: string,
  aliases: string[] = [],
  userAllergies: string[] = []
): RuleResult {
  const factors: RuleResult["factors"] = [];
  const searchText = [foodName, ...aliases].join(" ").toLowerCase();

  for (const allergy of userAllergies) {
    if (searchText.includes(allergy.toLowerCase())) {
      factors.push({
        nutrient: allergy,
        reason: `Matches your reported allergy: '${allergy}'.`,
        severity: "high",
      });
    }
  }

  return {
    condition: "food_allergy",
    ruleVersion: "allergy-v0",
    confidence: "high",
    verdict: factors.length > 0 ? "not_recommended" : "safe",
    factors,
  };
}
