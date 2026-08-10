import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

describe("Food Safety Backend APIs", () => {
  test("creates profile, updates it, analyzes food, checks history, and deletes", async () => {
    // 1. Initialize convex test with our schema
    // @ts-ignore
    const t = convexTest(schema, import.meta.glob("./**/*.*s"));

    // 2. Mock an authenticated user
    const asUser = t.withIdentity({
      tokenIdentifier: "user_123",
      subject: "user_123",
      name: "Test User",
      email: "test@example.com",
    });

    // --- TEST 1: Create Profile ---
    await asUser.mutation(api.profile.create.create, {
      name: "Test Patient",
      dateOfBirth: "1990-01-01",
      gender: "Male",
      height: 175,
      weight: 70,
      conditions: ["diabetes", "ckd"],
      allergies: ["peanuts"],
      dietaryPreferences: ["vegetarian"],
    });

    // --- TEST 2: Get Profile ---
    let profile = await asUser.query(api.profile.get.get, {});
    expect(profile).not.toBeNull();
    expect(profile!.weight).toBe(70);
    expect(profile!.conditions).toContain("diabetes");

    // --- TEST 3: Update Profile ---
    await asUser.mutation(api.profile.update.update, {
      weight: 65,
      additionalNotes: "Lost 5kg!",
    });

    profile = await asUser.query(api.profile.get.get, {});
    expect(profile!.weight).toBe(65);
    expect(profile!.additionalNotes).toBe("Lost 5kg!");

    // --- TEST 4: History APIs ---
    // External AI actions are intentionally not invoked in this deterministic unit test.
    const analysisId = await t.run(async (ctx) => {
      return await ctx.db.insert("foodAnalyses", {
        userId: "user_123",
        foodName: "Banana",
        nutrition: {},
        conditions: ["diabetes"],
        ruleResults: [],
        verdict: "moderation",
        status: "completed",
        createdAt: Date.now(),
      });
    });

    const history = await asUser.query(api.analysis.history.getHistory, { limit: 10 });
    expect(history.length).toBe(1);
    expect(history[0].foodName).toBe("Banana");

    const singleAnalysis = await asUser.query(api.analysis.get.get, { id: analysisId as any });
    expect(singleAnalysis._id).toBe(analysisId);

    // --- TEST 5: Delete Analysis ---
    await asUser.mutation(api.analysis.delete.remove, { id: analysisId as any });

    const emptyHistory = await asUser.query(api.analysis.history.getHistory, { limit: 10 });
    expect(emptyHistory.length).toBe(0);
  });
});
