import { action, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { rankMeals } from "./rank";

export const getMealCandidates = internalQuery({
  args: {
    foodIds: v.array(v.id("foods")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    
    const profile = await ctx.db.query("patientProfiles").withIndex("by_user", q => q.eq("userId", identity.subject)).first();
    if (!profile) throw new Error("Profile not found");

    const foods = [];
    for (const id of args.foodIds) {
      const f = await ctx.db.get(id);
      if (f) foods.push(f);
    }

    const ranked = rankMeals(foods as any, profile as any);
    // Return top 4 safest meals
    return ranked.slice(0, 4);
  }
});

export const generate = action({
  args: {
    foodIds: v.array(v.id("foods")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    // 1. Get ranked meal candidates deterministically
    const candidates = await ctx.runQuery(internal.meals.recommend.getMealCandidates, {
      foodIds: args.foodIds,
    });

    if (candidates.length === 0) {
      return []; // No safe meals found
    }

    // 2. Call Gemini to explain the medically verified meals
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `You are the explanation layer of a medical nutrition app.
Your task is to explain these verified meal combinations to the user.

IMPORTANT RULES:
1. The Rules Engine has already verified these meals as medically acceptable. Do NOT invent new risks.
2. Only explain the provided rule results.
3. Return a JSON array of objects exactly matching this schema:
[{
  "mealName": "String (e.g. Rice + Dal)",
  "summary": "String (1-2 sentences why this combination is medically suitable for their profile)",
  "healthRisks": ["String (Any specific risks flagged by rules, or empty array)"]
}]

VERIFIED MEAL CANDIDATES (FROM RULES ENGINE):
${JSON.stringify(candidates, null, 2)}
`;

    try {
      const result = await model.generateContent(prompt);
      let text = result.response.text().trim();
      text = text.replace(/```json/g, "").replace(/```/g, "").trim();
      
      const parsed = JSON.parse(text);
      
      // 3. Merge AI explanation strictly into the deterministic backend framework
      return candidates.map((cand, i) => {
        const explanation = parsed.find((p: any) => p.mealName === cand.candidate.mealName) || parsed[i];
        return {
          mealName: cand.candidate.mealName,
          foods: cand.candidate.foods.map((f: any) => ({ id: f._id, name: f.name || f.foodName })),
          nutrition: cand.candidate.combinedNutrition,
          verdict: cand.verdict,
          ruleResults: cand.ruleResults,
          score: cand.score,
          explanation: {
            summary: explanation?.summary || "Medically verified combination.",
            healthRisks: explanation?.healthRisks || []
          }
        };
      });
    } catch (e: any) {
      console.error("AI Meal Explanation Failed:", e);
      // Fallback: If AI fails, still return the medically verified combinations
      return candidates.map(cand => ({
        mealName: cand.candidate.mealName,
        foods: cand.candidate.foods.map((f: any) => ({ id: f._id, name: f.name || f.foodName })),
        nutrition: cand.candidate.combinedNutrition,
        verdict: cand.verdict,
        ruleResults: cand.ruleResults,
        score: cand.score,
        explanation: {
          summary: "Verified by Medical Rules Engine. AI explanation unavailable.",
          healthRisks: []
        }
      }));
    }
  }
});
