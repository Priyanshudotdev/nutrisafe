import { action, env } from "../_generated/server";
import { v } from "convex/values";
import {
  aiResponseValidator,
  nutritionValidator,
  ruleResultValidator,
  safetyVerdictValidator,
} from "../validators";

const SYSTEM_PROMPT = `You are the explanation layer of a personalized food safety application.

Your job is to explain an already-determined food safety result in simple language.

IMPORTANT RULES:
1. You are not a medical decision maker.
2. The Rules Engine has already determined the verdict. Your task is ONLY to explain that result.
3. The provided verdict is final. Never change, reinterpret, or override the verdict.
4. Do not invent medical facts, nutrient values, allergies, conditions, or risks.
5. Never introduce a new medical concern that is not present in RULE ENGINE RESULT.
6. Never infer a nutrient risk that is not explicitly flagged.
7. If the Rules Engine indicates that personalized medical guidance is required, clearly communicate that.
8. Do not diagnose diseases.
9. Do not recommend changing, starting, or stopping medication.
10. Do not claim that a food is universally safe or unsafe.
11. If information is insufficient, say so rather than guessing.
12. Return ONLY the requested JSON structure.

You may only mention alternatives from ALTERNATIVE CANDIDATES.
Do not invent additional foods.
Do not claim that an alternative is medically safe beyond the supplied Rules Engine results.
If the candidate list is empty, return an empty alternatives array.`;

export const generate = action({
  args: {
    foodName: v.string(),
    nutrition: nutritionValidator,
    ruleResults: v.array(ruleResultValidator),
    overallVerdict: safetyVerdictValidator,
    alternativeCandidates: v.array(v.any()),
  },
  returns: aiResponseValidator,
  handler: async (ctx, args) => {
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set.");
    }

    const userPrompt = `
FOOD
Name: ${args.foodName}

NUTRITION
${JSON.stringify(args.nutrition, null, 2)}

RULE ENGINE RESULT
${JSON.stringify(args.ruleResults, null, 2)}

ALTERNATIVE CANDIDATES
${JSON.stringify(args.alternativeCandidates, null, 2)}

FINAL VERDICT IS AUTHORITATIVE.
Overall Verdict: ${args.overallVerdict}

Generate the explanation adhering strictly to the system rules. Respond with JSON matching this schema exactly:
{
  "summary": "String (Short summary of the verdict and why)",
  "why": "String (Detailed explanation of why the rules flagged this food)",
  "healthRisks": ["String (List of specific health risks explicitly flagged by the rules)"],
  "portionAdvice": "String (Optional advice on portion size if applicable based on the rules)",
  "disclaimer": "String (Must state this does not replace medical advice)"
}
`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1, // Keep it deterministic
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini API Error: ${response.status} - ${err}`);
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
      throw new Error("Invalid response structure from Gemini API");
    }

    let parsed: any;
    try {
      parsed = JSON.parse(candidateText);
    } catch {
      throw new Error("Failed to parse AI JSON response: " + candidateText);
    }

    // Strict Runtime Validation of the AI response structure
    if (
      typeof parsed !== "object" ||
      typeof parsed.summary !== "string" ||
      typeof parsed.why !== "string" ||
      !Array.isArray(parsed.healthRisks) ||
      !parsed.healthRisks.every((r: any) => typeof r === "string") ||
      (parsed.portionAdvice !== undefined &&
        parsed.portionAdvice !== null &&
        typeof parsed.portionAdvice !== "string") ||
      typeof parsed.disclaimer !== "string"
    ) {
      throw new Error("AI response failed schema validation. Output: " + candidateText);
    }

    return {
      summary: parsed.summary,
      why: parsed.why,
      healthRisks: parsed.healthRisks,
      portionAdvice: parsed.portionAdvice,
      disclaimer: parsed.disclaimer,
    };
  },
});
