import { action } from "../_generated/server";
import { v } from "convex/values";

export const explain = action({
  args: {
    foodName: v.string(),
    verdict: v.string(),
    ruleResults: v.any(),
  },
  handler: async (ctx, args) => {
    // TODO: Implement external API call to Gemini or OpenAI
    // const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=YOUR_API_KEY`, ...);
    
    // Returning dummy explanation for now
    return {
      summary: `Based on your profile, ${args.foodName} is considered ${args.verdict}.`,
      risks: ["May cause a spike in blood sugar."],
      alternatives: ["Apple", "Berries"],
      portionAdvice: "Keep to half a serving.",
      ai: {
        provider: "gemini",
        model: "gemini-1.5-flash"
      }
    };
  },
});
