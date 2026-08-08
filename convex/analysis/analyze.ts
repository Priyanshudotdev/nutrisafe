import { action, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import { evaluateFood } from "../rules/evaluate";
import { nutritionValidator, ruleResultValidator, explanationValidator } from "../validators";

export const analyze = action({
  args: {
    foodId: v.id("foods"),
  },
  handler: async (ctx, args) => {
    // 1. Authenticate user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const userId = identity.subject;

    // 6. Save analysis as "processing"
    const analysisId = await ctx.runMutation(internal.analysis.analyze.createAnalysis, {
      foodId: args.foodId,
    });

    let overallVerdict: "safe" | "moderation" | "not_recommended" = "safe";
    let ruleResults: any[] = [];
    let food: any;
    let profile: any;

    try {
      // 2. Get patient profile
      profile = await ctx.runQuery(api.profile.get.get);
      if (!profile) throw new Error("Please complete your medical profile first.");

      // 3. Resolve food strictly from Convex database
      food = await ctx.runQuery(api.nutrition.get.get, {
        foodId: args.foodId,
      });

      // 4 & 5. Run Rules Engine (Direct TS function)
      ruleResults = evaluateFood({
        profile,
        foodName: food.foodName,
        nutrition: food.nutrition,
      });

      // Determine overall verdict completely separated from AI
      if (ruleResults.some(r => r.verdict === "not_recommended")) {
        overallVerdict = "not_recommended";
      } else if (ruleResults.some(r => r.verdict === "moderation")) {
        overallVerdict = "moderation";
      }
    } catch (error: any) {
      // Mark as failed so the frontend UI can properly reflect it
      await ctx.runMutation(internal.analysis.analyze.failAnalysis, {
        analysisId,
      });
      console.error(error);
      throw new Error(`Analysis failed: ${error.message}`);
    }

    // 6. Find Alternatives
    let alternativeCandidates: any[] = [];
    try {
      alternativeCandidates = await ctx.runQuery(internal.alternatives.find.find, {
        foodId: args.foodId,
        profile,
        limit: 3,
      });
    } catch (e) {
      console.error("Alternative finder failed", e);
    }

    // 7. Generate AI Explanation
    let explanation = null;
    let explanationStatus = "completed";
    
    let aiResponse: any = null;
    try {
      aiResponse = await ctx.runAction(api.ai.explain.generate, {
        foodName: food.foodName,
        nutrition: food.nutrition,
        ruleResults,
        overallVerdict,
        alternativeCandidates,
      });
    } catch (aiError) {
      console.error("AI Generation Failed:", aiError);
      explanationStatus = "failed";
    }

    // Compute basedOnRules deterministically from ruleResults
    const basedOnRules: string[] = [];
    ruleResults.forEach((rule: any) => {
      rule.factors.forEach((factor: any) => {
        if (factor.nutrient) {
          basedOnRules.push(`${rule.condition}.${factor.nutrient}.${factor.severity}`);
        }
      });
    });

    // Construct final explanation object
    if (aiResponse) {
      explanation = {
        ...aiResponse,
        alternatives: alternativeCandidates.map(c => c.foodName),
        basedOnRules,
      };
    }

    // 8. Update analysis → "completed" (Also securely snapshots nutrition and conditions)
    await ctx.runMutation(internal.analysis.analyze.completeAnalysis, {
      analysisId,
      ruleResults,
      verdict: overallVerdict,
      explanation: explanation || undefined,
      explanationStatus,
      nutritionSnapshot: food.nutrition,
      conditionsSnapshot: profile.conditions || [],
    });

    // 9. Return complete result
    return {
      status: "completed",
      verdict: overallVerdict,
      ruleResults,
      explanation,
      explanationStatus,
    };
  },
});

// ==========================================
// Internal Helper Mutations Below
// ==========================================

export const createAnalysis = internalMutation({
  args: {
    foodId: v.id("foods"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const food = await ctx.db.get(args.foodId);
    return await ctx.db.insert("foodAnalyses", {
      userId: identity.subject,
      foodName: food ? food.name : "Unknown",
      nutrition: {},
      conditions: [],
      ruleResults: [],
      status: "processing", // Prevents UI hanging
      createdAt: Date.now(),
    });
  },
});

export const completeAnalysis = internalMutation({
  args: {
    analysisId: v.id("foodAnalyses"),
    ruleResults: v.array(ruleResultValidator),
    verdict: v.string(),
    explanation: v.optional(explanationValidator),
    explanationStatus: v.string(),
    nutritionSnapshot: nutritionValidator,
    conditionsSnapshot: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const analysis = await ctx.db.get(args.analysisId);
    if (!analysis || analysis.userId !== identity.subject) {
      throw new Error("Analysis not found or unauthorized");
    }

    await ctx.db.patch(args.analysisId, {
      status: "completed",
      ruleResults: args.ruleResults,
      verdict: args.verdict, // Finalized by Rules Engine, not AI
      explanation: args.explanation,
      explanationStatus: args.explanationStatus,
      nutrition: args.nutritionSnapshot, // Historical snapshot
      conditions: args.conditionsSnapshot, // Historical snapshot
    });
  },
});

export const failAnalysis = internalMutation({
  args: {
    analysisId: v.id("foodAnalyses"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const analysis = await ctx.db.get(args.analysisId);
    if (!analysis || analysis.userId !== identity.subject) {
      throw new Error("Analysis not found or unauthorized");
    }

    await ctx.db.patch(args.analysisId, {
      status: "failed",
    });
  },
});
