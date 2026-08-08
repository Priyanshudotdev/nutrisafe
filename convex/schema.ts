import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { nutritionValidator, ruleResultValidator, explanationValidator } from "./validators";

export default defineSchema({
  users: defineTable({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerified: v.optional(v.boolean()),
    image: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("email", ["email"]),

  sessions: defineTable({
    userId: v.id("users"),
    token: v.string(),
    expiresAt: v.number(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("token", ["token"]),

  accounts: defineTable({
    userId: v.id("users"),
    accountId: v.string(),
    providerId: v.string(),
    accessToken: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    password: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("providerId_accountId", ["providerId", "accountId"]),

  patientProfiles: defineTable({
    userId: v.string(), // Links to Better Auth user ID
    name: v.string(),
    dateOfBirth: v.optional(v.string()), // YYYY-MM-DD
    gender: v.optional(v.string()),
    height: v.optional(v.number()), // in cm
    weight: v.optional(v.number()), // in kg
    conditions: v.optional(v.array(v.string())), // e.g. ["diabetes", "ckd"]
    medications: v.optional(v.array(v.any())),
    allergies: v.optional(v.array(v.string())),
    dietaryPreferences: v.optional(v.array(v.string())),
    additionalNotes: v.optional(v.string()),
    ckdDetails: v.optional(
      v.object({
        stage: v.optional(v.union(
          v.literal("G1"), v.literal("G2"), v.literal("G3a"), 
          v.literal("G3b"), v.literal("G4"), v.literal("G5")
        )),
        dialysis: v.optional(v.boolean()),
        potassiumStatus: v.optional(v.union(v.literal("normal"), v.literal("high"), v.literal("low"))),
        phosphorusStatus: v.optional(v.union(v.literal("normal"), v.literal("high"), v.literal("low"))),
        sodiumLimit: v.optional(v.number()),
        proteinTarget: v.optional(v.number()),
      })
    ),
    heartDetails: v.optional(
      v.object({
        hasHypertension: v.optional(v.boolean()),
        sodiumLimit: v.optional(v.number()),
        saturatedFatLimit: v.optional(v.number()),
      })
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  foodAnalyses: defineTable({
    userId: v.string(),
    foodName: v.string(),
    nutrition: nutritionValidator, // Snapshot of nutrition
    conditions: v.array(v.string()), // The user conditions present at time of check
    ruleResults: v.array(ruleResultValidator), // Strict typing for rule results
    verdict: v.optional(v.string()), // "safe" | "moderation" | "not_recommended", optional during processing
    explanation: v.optional(explanationValidator), // AI Explanation payload
    explanationStatus: v.optional(v.string()), // "completed" | "failed"
    status: v.string(), // "processing" | "completed" | "failed"
    createdAt: v.number(),
  }).index("by_user_createdAt", ["userId", "createdAt"]),

  nutritionCache: defineTable({
    provider: v.string(),
    externalId: v.string(),
    foodName: v.string(),
    nutrition: v.any(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }),

  foods: defineTable({
    foodCode: v.optional(v.string()),
    name: v.string(),
    aliases: v.optional(v.array(v.string())),
    category: v.optional(v.string()),
    foodType: v.optional(v.string()), 
    source: v.string(),

    nutrition: v.object({
      energyKcal: v.number(),
      carbohydrates: v.number(),
      protein: v.number(),
      fat: v.number(),
      freeSugar: v.number(),
      fibre: v.number(),
      saturatedFat: v.number(),
      cholesterol: v.number(),
      sodium: v.number(),
      potassium: v.number(),
      phosphorus: v.number(),
      calcium: v.number(),
      magnesium: v.number(),
      iron: v.number(),
      zinc: v.number(),
      vitaminC: v.number(),
      folate: v.number(),
    }),

    serving: v.optional(
      v.object({
        quantity: v.number(),
        unit: v.string(),
      })
    ),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_food_code", ["foodCode"])
    .index("by_name", ["name"])
    .searchIndex("search_name", {
      searchField: "name",
    }),
});
