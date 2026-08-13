import { query } from "../_generated/server";
import { v } from "convex/values";

export const get = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    // Return null instead of throwing — callers use this for conditional routing
    if (!identity) {
      return null;
    }

    const profile = await ctx.db
      .query("patientProfiles")
      .withIndex("by_user", (q) => q.eq("userId", identity.tokenIdentifier))
      .unique();

    return profile;
  },
});
