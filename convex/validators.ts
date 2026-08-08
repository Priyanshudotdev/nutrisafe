import { v } from "convex/values";

export const nutritionValidator = v.object({
  energyKcal: v.optional(v.number()),
  carbohydrates: v.optional(v.number()),
  protein: v.optional(v.number()),
  fat: v.optional(v.number()),
  freeSugar: v.optional(v.number()),
  fibre: v.optional(v.number()),
  saturatedFat: v.optional(v.number()),
  cholesterol: v.optional(v.number()),
  sodium: v.optional(v.number()),
  potassium: v.optional(v.number()),
  phosphorus: v.optional(v.number()),
  calcium: v.optional(v.number()),
  magnesium: v.optional(v.number()),
  iron: v.optional(v.number()),
  zinc: v.optional(v.number()),
  vitaminC: v.optional(v.number()),
  folate: v.optional(v.number()),
});

export const ruleResultValidator = v.object({
  condition: v.string(),
  ruleVersion: v.string(),
  confidence: v.string(),
  verdict: v.string(),
  requiresPersonalizedGuidance: v.optional(v.boolean()),
  factors: v.array(
    v.object({
      nutrient: v.optional(v.string()),
      value: v.optional(v.number()),
      reason: v.string(),
      severity: v.string(),
      isPositive: v.optional(v.boolean()),
    })
  ),
});

export const safetyVerdictValidator = v.union(
  v.literal("safe"),
  v.literal("moderation"),
  v.literal("not_recommended")
);

export const aiResponseValidator = v.object({
  summary: v.string(),
  why: v.string(),
  healthRisks: v.array(v.string()),
  portionAdvice: v.optional(v.string()),
  disclaimer: v.string(),
});

export const explanationValidator = v.object({
  summary: v.string(),
  why: v.string(),
  healthRisks: v.array(v.string()),
  alternatives: v.array(v.string()),
  portionAdvice: v.optional(v.string()),
  disclaimer: v.string(),
  basedOnRules: v.array(v.string()),
});
