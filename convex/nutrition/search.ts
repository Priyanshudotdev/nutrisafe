import { query } from "../_generated/server";
import { v } from "convex/values";

export const search = query({
  args: {
    foodName: v.string(),
  },
  returns: v.array(
    v.object({
      _id: v.id("foods"),
      name: v.string(),
      source: v.string(),
      category: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    // Search the internal normalized INDB/IFCT database
    const foods = await ctx.db
      .query("foods")
      .withSearchIndex("search_name", (q) => q.search("name", args.foodName))
      .take(15);

    return foods.map((food) => ({
      _id: food._id,
      name: food.name,
      source: food.source,
      category: food.category,
    }));
  },
});
