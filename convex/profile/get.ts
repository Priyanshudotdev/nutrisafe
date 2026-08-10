import { query } from "../_generated/server";
import { v } from "convex/values";

export const get = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new Error("Unauthorized");
    }

    const profile = await ctx.db
      .query("patientProfiles")
      .withIndex("by_user", (q) => q.eq("userId", identity.tokenIdentifier))
      .unique();

    return profile;
  },
});
