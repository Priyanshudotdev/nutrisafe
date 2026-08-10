import { query } from "../_generated/server";
import { v } from "convex/values";

export const getHistory = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new Error("Unauthorized");
    }

    const analyses = await ctx.db
      .query("foodAnalyses")
      .withIndex("by_user_createdAt", (q) => q.eq("userId", identity.tokenIdentifier))
      .order("desc")
      .take(args.limit ?? 20);

    return analyses;
  },
});
