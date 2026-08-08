import { internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { rankAlternatives } from "./rank";

export const find = internalQuery({
  args: {
    foodId: v.id("foods"),
    profile: v.any(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const originalFood = await ctx.db.get(args.foodId);
    if (!originalFood) throw new Error("Original food not found.");

    const allFoods = await ctx.db.query("foods").collect();

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
