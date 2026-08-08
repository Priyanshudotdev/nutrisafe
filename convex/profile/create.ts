import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    name: v.string(),
    dateOfBirth: v.optional(v.string()),
    gender: v.optional(v.string()),
    height: v.optional(v.number()),
    weight: v.optional(v.number()),
    conditions: v.array(
      v.union(
        v.literal("diabetes"),
        v.literal("ckd"),
        v.literal("heart_hypertension"),
        v.literal("celiac"),
        v.literal("food_allergy")
      )
    ),
    allergies: v.array(v.string()),
    dietaryPreferences: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new Error("Unauthorized");
    }

    // Check if profile already exists
    const existing = await ctx.db
      .query("patientProfiles")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .unique();

    if (existing) {
      throw new Error("Profile already exists");
    }

    const profileId = await ctx.db.insert("patientProfiles", {
      userId: identity.subject,
      name: args.name,
      dateOfBirth: args.dateOfBirth,
      gender: args.gender,
      height: args.height,
      weight: args.weight,
      conditions: args.conditions,
      allergies: args.allergies,
      medications: [],
      dietaryPreferences: args.dietaryPreferences,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return profileId;
  },
});
