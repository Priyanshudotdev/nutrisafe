import { internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { rankAlternatives } from "./rank";

export const find = internalQuery({
  args: {
    foodId: v.id("foods"),
    profile: v.any(),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const originalFood = await ctx.db.get(args.foodId);
    if (!originalFood) throw new Error("Original food not found.");

    // Keep alternative ranking bounded so a growing food catalog cannot exceed
    // Convex transaction limits. The caller only needs a small candidate pool.
    const allFoods = await ctx.db.query("foods").withIndex("by_name").take(500);

    const ranked = rankAlternatives(originalFood as any, allFoods as any, args.profile);

    const limit = args.limit || 5;
    const topCandidates = ranked.slice(0, limit);

    return topCandidates.map((item) => ({
      foodId: item.food._id,
      foodName: item.food.name || item.food.foodName,
      verdict: item.verdict,
      score: item.score,
      ruleResults: item.ruleResults,
    }));
  },
});
