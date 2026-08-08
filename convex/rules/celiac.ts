import { RuleResult } from "./types";

// Celiac relies on ingredient/allergen tracking, not standard macro/micronutrients.
export const CELIAC_GLUTEN_KEYWORDS = [
  "wheat", "rye", "barley", "malt", "brewer's yeast", "oats", "maida", "suji", "rava"
];

export function evaluateCeliac(foodName: string, aliases: string[] = []): RuleResult {
  const factors: RuleResult["factors"] = [];
  const searchText = [foodName, ...aliases].join(" ").toLowerCase();

  const foundGluten = CELIAC_GLUTEN_KEYWORDS.find(keyword => searchText.includes(keyword));

  if (foundGluten) {
    factors.push({
      reason: `Potential gluten source identified from name/alias: '${foundGluten}'.`,
      severity: "high"
    });
  }

  return {
    condition: "celiac",
    ruleVersion: "celiac-v0",
    confidence: "low",
    verdict: factors.length > 0 ? "not_recommended" : "safe",
    factors
  };
}
