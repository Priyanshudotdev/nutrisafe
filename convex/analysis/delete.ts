import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const remove = mutation({
  args: {
    id: v.id("foodAnalyses"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new Error("Unauthorized");
    }

    const analysis = await ctx.db.get(args.id);

    if (!analysis) {
      throw new Error("Analysis not found");
    }

    if (analysis.userId !== identity.tokenIdentifier) {
      throw new Error("Unauthorized");
    }

    await ctx.db.delete(args.id);
    return null;
  },
});
