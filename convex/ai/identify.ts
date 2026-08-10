import { action, env } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Id } from "../_generated/dataModel";

type FoodSearchResult = {
  _id: Id<"foods">;
  name: string;
  source: string;
  category?: string;
};

export const identify = action({
  args: {
    imageBase64: v.string(),
    mimeType: v.string(), // e.g. "image/jpeg"
  },
  returns: v.object({
    identifiedName: v.string(),
    foodId: v.union(v.id("foods"), v.null()),
    matchFound: v.boolean(),
  }),
  handler: async (
    ctx,
    args
  ): Promise<{
    identifiedName: string;
    foodId: Id<"foods"> | null;
    matchFound: boolean;
  }> => {
    // 1. Authenticate user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set.");
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // gemini-1.5-flash supports multimodality and is fast
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `Identify the single main food item in this image. 
Respond strictly with a JSON object containing a single key "foodName" with the generic name of the food (e.g. "Banana", "Apple", "Pizza").
Do not include markdown blocks, backticks, or any other text.`;

    const imageParts = [
      {
        inlineData: {
          data: args.imageBase64,
          mimeType: args.mimeType,
        },
      },
    ];

    try {
      // 2. Query Gemini Vision
      const result = await model.generateContent([prompt, ...imageParts]);
      const response = await result.response;
      let text = response.text().trim();

      // Clean up potential markdown formatting from LLM
      text = text
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error("Failed to parse Gemini response: " + text);
      }

      if (!parsed.foodName) {
        throw new Error("Could not identify food name from image.");
      }

      const identifiedName = parsed.foodName;

      // 3. Search our database for this food name
      // We leverage the existing search query to find the closest match
      const searchResults: FoodSearchResult[] = await ctx.runQuery(api.nutrition.search.search, {
        foodName: identifiedName,
      });

      if (searchResults && searchResults.length > 0) {
        return {
          identifiedName,
          foodId: searchResults[0]._id,
          matchFound: true,
        };
      } else {
        return {
          identifiedName,
          foodId: null,
          matchFound: false,
        };
      }
    } catch (error: any) {
      console.error("Vision AI Error:", error);
      throw new Error(`Failed to identify food: ${error.message}`);
    }
  },
});
