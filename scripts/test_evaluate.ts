import { evaluateFood } from "../convex/rules/evaluate";
import { PatientProfile, Condition, NutritionData } from "../convex/rules/types";

// Helper to create profiles
const createProfile = (
  conditions: Condition[],
  allergies: string[] = [],
  ckdDetails?: any,
  heartDetails?: any
): PatientProfile => ({
  userId: "test",
  conditions,
  allergies,
  ckdDetails,
  heartDetails,
});

// Helper foods
const HIGH_SUGAR_FOOD = {
  foodName: "Candy",
  nutrition: {
    energyKcal: 400,
    carbohydrates: 100,
    freeSugar: 50,
    fibre: 0,
    protein: 0,
    fat: 0,
    saturatedFat: 0,
    cholesterol: 0,
    sodium: 10,
    potassium: 50,
    phosphorus: 20,
    calcium: 10,
    magnesium: 5,
    iron: 0,
    zinc: 0,
    vitaminC: 0,
    folate: 0,
  } as NutritionData,
};

const HIGH_POTASSIUM_FOOD = {
  foodName: "Banana",
  nutrition: {
    energyKcal: 89,
    carbohydrates: 23,
    freeSugar: 12,
    fibre: 3,
    protein: 1,
    fat: 0,
    saturatedFat: 0,
    cholesterol: 0,
    sodium: 1,
    potassium: 450,
    phosphorus: 22,
    calcium: 5,
    magnesium: 27,
    iron: 0,
    zinc: 0,
    vitaminC: 8,
    folate: 20,
  } as NutritionData,
};

const HIGH_SODIUM_FOOD = {
  foodName: "Canned Soup",
  nutrition: {
    energyKcal: 150,
    carbohydrates: 20,
    freeSugar: 2,
    fibre: 2,
    protein: 5,
    fat: 5,
    saturatedFat: 2,
    cholesterol: 10,
    sodium: 800,
    potassium: 150,
    phosphorus: 50,
    calcium: 20,
    magnesium: 10,
    iron: 1,
    zinc: 0,
    vitaminC: 0,
    folate: 0,
  } as NutritionData,
};

const HIGH_SODIUM_POTASSIUM_FOOD = {
  foodName: "Salty Banana Chips",
  nutrition: {
    energyKcal: 500,
    carbohydrates: 60,
    freeSugar: 5,
    fibre: 5,
    protein: 2,
    fat: 30,
    saturatedFat: 15,
    cholesterol: 0,
    sodium: 700,
    potassium: 600,
    phosphorus: 50,
    calcium: 20,
    magnesium: 30,
    iron: 1,
    zinc: 1,
    vitaminC: 5,
    folate: 10,
  } as NutritionData,
};

const ALLERGEN_FOOD = {
  foodName: "Peanut Butter",
  nutrition: {
    energyKcal: 588,
    carbohydrates: 20,
    freeSugar: 9,
    fibre: 6,
    protein: 25,
    fat: 50,
    saturatedFat: 10,
    cholesterol: 0,
    sodium: 150,
    potassium: 600,
    phosphorus: 300,
    calcium: 50,
    magnesium: 150,
    iron: 2,
    zinc: 3,
    vitaminC: 0,
    folate: 70,
  } as NutritionData,
};

const MULTI_THREAT_FOOD = {
  foodName: "Salty Caramel Donut",
  nutrition: {
    energyKcal: 450,
    carbohydrates: 60,
    freeSugar: 35,
    fibre: 1,
    protein: 4,
    fat: 25,
    saturatedFat: 12,
    cholesterol: 30,
    sodium: 400,
    potassium: 200,
    phosphorus: 100,
    calcium: 20,
    magnesium: 15,
    iron: 1,
    zinc: 0,
    vitaminC: 0,
    folate: 10,
  } as NutritionData,
};

function runTest(
  name: string,
  profile: PatientProfile,
  food: { foodName: string; nutrition: NutritionData }
) {
  console.log(`\n=== TEST: ${name} ===`);
  const results = evaluateFood({
    profile,
    foodName: food.foodName,
    nutrition: food.nutrition,
  });

  const isNotRecommended = results.some((r) => r.verdict === "not_recommended");
  const isModeration = results.some((r) => r.verdict === "moderation");
  const overall = isNotRecommended ? "not_recommended" : isModeration ? "moderation" : "safe";

  console.log(`Food: ${food.foodName}`);
  console.log(`Overall Verdict: ${overall.toUpperCase()}`);
  results.forEach((r) => {
    console.log(
      `  - Condition: ${r.condition} -> ${r.verdict.toUpperCase()} (Confidence: ${r.confidence})`
    );
    r.factors.forEach((f) => {
      console.log(`      * ${f.nutrient}: ${f.reason} (Severity: ${f.severity})`);
    });
    if (r.requiresPersonalizedGuidance) {
      console.log(`      * REQUIRES PERSONALIZED GUIDANCE`);
    }
  });
}

// 1. Diabetes only -> high sugar
runTest("Diabetes only -> high sugar", createProfile(["diabetes"]), HIGH_SUGAR_FOOD);

// 2. CKD only -> high potassium
runTest(
  "CKD only -> high potassium",
  createProfile(["ckd"], [], { stage: "G4" }),
  HIGH_POTASSIUM_FOOD
);

// 3. Hypertension only -> high sodium
runTest(
  "Hypertension only -> high sodium",
  createProfile(["heart_hypertension"]),
  HIGH_SODIUM_FOOD
);

// 4. CKD + Hypertension -> high sodium + high potassium
runTest(
  "CKD + Hypertension -> high sodium + high potassium",
  createProfile(["ckd", "heart_hypertension"], [], { stage: "G3b" }),
  HIGH_SODIUM_POTASSIUM_FOOD
);

// 5. CKD + Hypertension + Diabetes -> multi threat
runTest(
  "CKD + Hypertension + Diabetes -> multi threat",
  createProfile(["ckd", "heart_hypertension", "diabetes"], [], { stage: "G2" }),
  MULTI_THREAT_FOOD
);

// 6. Food Allergy
runTest(
  "Food Allergy -> peanut (unverified allergens)",
  createProfile(["food_allergy"], ["peanut"]),
  ALLERGEN_FOOD
);

// 7. Incomplete CKD Profile
runTest("Incomplete CKD Profile -> missing stage", createProfile(["ckd"]), HIGH_POTASSIUM_FOOD);
