import { query } from "../_generated/server";

export const get = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new Error("Unauthorized");
    }

    const profile = await ctx.db
      .query("patientProfiles")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .unique();

    return profile;
  },
});
