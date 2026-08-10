import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const update = mutation({
  args: {
    name: v.optional(v.string()),
    age: v.optional(v.number()),
    dateOfBirth: v.optional(v.string()),
    gender: v.optional(v.string()),
    height: v.optional(v.number()),
    weight: v.optional(v.number()),
    conditions: v.optional(
      v.array(
        v.union(
          v.literal("diabetes"),
          v.literal("ckd"),
          v.literal("heart_hypertension"),
          v.literal("celiac"),
          v.literal("food_allergy")
        )
      )
    ),
    allergies: v.optional(v.array(v.string())),
    medications: v.optional(
      v.array(
        v.object({
          name: v.string(),
          dosage: v.optional(v.string()),
          frequency: v.optional(v.string()),
        })
      )
    ),
    dietaryPreferences: v.optional(v.array(v.string())),
    additionalNotes: v.optional(v.string()),
  },
  returns: v.id("patientProfiles"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new Error("Unauthorized");
    }

    const profile = await ctx.db
      .query("patientProfiles")
      .withIndex("by_user", (q) => q.eq("userId", identity.tokenIdentifier))
      .unique();

    if (!profile) {
      throw new Error("Profile not found");
    }

    await ctx.db.patch(profile._id, {
      ...args,
      updatedAt: Date.now(),
    });

    return profile._id;
  },
});
