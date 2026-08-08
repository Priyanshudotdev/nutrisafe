export type Condition = "diabetes" | "ckd" | "heart_hypertension" | "celiac" | "food_allergy";

export type RuleResult = {
  condition: Condition;
  ruleVersion: string;
  confidence: "high" | "medium" | "low";
  verdict: "safe" | "moderation" | "not_recommended";
  requiresPersonalizedGuidance?: boolean;
  factors: {
    nutrient?: string;
    value?: number;
    reason: string;
    severity: "low" | "medium" | "high";
    isPositive?: boolean;
  }[];
};

export type CKDDetails = {
  stage?: "G1" | "G2" | "G3a" | "G3b" | "G4" | "G5";
  dialysis?: boolean;
  potassiumStatus?: "normal" | "high" | "low";
  phosphorusStatus?: "normal" | "high" | "low";
  sodiumLimit?: number;
  proteinTarget?: number;
};

export type HeartDetails = {
  hasHypertension?: boolean;
  sodiumLimit?: number;
  saturatedFatLimit?: number;
};

export type NutritionData = {
  energyKcal: number;
  carbohydrates: number;
  protein: number;
  fat: number;
  freeSugar: number;
  fibre: number;
  saturatedFat: number;
  cholesterol: number;
  sodium: number;
  potassium: number;
  phosphorus: number;
  calcium: number;
  magnesium: number;
  iron: number;
  zinc: number;
  vitaminC: number;
  folate: number;
};

export type PatientProfile = {
  userId: string;
  conditions: Condition[];
  allergies?: string[];
  ckdDetails?: CKDDetails;
  heartDetails?: HeartDetails;
};

export type Food = {
  _id: any; // Id<"foods">
  name?: string;
  foodName?: string;
  category?: string;
  nutrition: NutritionData;
  verifiedAllergens?: string[];
};

export type RankedAlternative = {
  food: Food;
  verdict: "safe" | "moderation" | "not_recommended";
  ruleResults: RuleResult[];
  score: number;
};
