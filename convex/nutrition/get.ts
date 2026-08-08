import { query } from "../_generated/server";
import { v } from "convex/values";

export const get = query({
  args: {
    foodId: v.id("foods"),
  },
  handler: async (ctx, args) => {
    const food = await ctx.db.get(args.foodId);
    if (!food) throw new Error(`Food not found with ID: ${args.foodId}`);

    return {
      provider: food.source,
      externalId: food.foodCode || food._id,
      foodName: food.name,
      nutrition: food.nutrition
    };
  },
});
