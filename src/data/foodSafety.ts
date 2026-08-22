// ─── AI Food Safety Check Data Models & Clinical Rules Engine ────────────────

export type PatientCondition =
  | "diabetes"
  | "ckd"
  | "hypertension"
  | "celiac"
  | "allergy";

export type SafetyStatus = "safe" | "moderation" | "not_recommended";

export interface ConditionMeta {
  id: PatientCondition;
  title: string;
  shortName: string;
  badgeLabel: string;
  description: string;
  iconName: string;
  accentColor: string;
  bgColor: string;
  keyNutrients: string[];
}

export interface NutrientFactor {
  name: string;
  level: "Low" | "Moderate" | "High" | "Contains" | "None";
  impact: "positive" | "neutral" | "warning" | "danger";
  detail: string;
}

export interface FoodAlternative {
  name: string;
  reason: string;
  icon: string;
}

export interface FoodSafetyAnalysis {
  id: string;
  foodName: string;
  category: string;
  /** Primary (first) condition the analysis was evaluated against. */
  condition: PatientCondition;
  /** All conditions considered — analyses are merged worst-case across them. */
  conditions?: PatientCondition[];
  status: SafetyStatus;
  statusHeadline: string;
  summary: string;
  detailedWhy: string;
  factors: NutrientFactor[];
  alternatives: FoodAlternative[];
  portionGuidance?: string;
  timestamp: string;
  source?: "text" | "scan";
  scanConfidence?: number;
}

export interface PatientProfile {
  name: string;
  age: number | null;
  gender: string | null;
  email?: string;
  city?: string | null;
  primaryCondition: PatientCondition;
  /** All active conditions. Falls back to [primaryCondition] when absent. */
  conditions?: PatientCondition[];
  notes: string;
  allergensList: string[];
  doctorName?: string | null;
  /** False until the user finishes the post-signup health onboarding flow. */
  onboardingCompleted?: boolean;
}

/** Conditions for a profile — handles legacy profiles that only have primaryCondition. */
export function getProfileConditions(profile: Pick<PatientProfile, "primaryCondition" | "conditions">): PatientCondition[] {
  if (Array.isArray(profile.conditions) && profile.conditions.length > 0) {
    return profile.conditions;
  }
  return [profile.primaryCondition];
}

// ─── 5 Patient Medical Categories ─────────────────────────────────────────────
export const PATIENT_CONDITIONS: ConditionMeta[] = [
  {
    id: "ckd",
    title: "Chronic Kidney Disease",
    shortName: "CKD",
    badgeLabel: "Kidney Health (CKD)",
    description: "Monitors Potassium, Phosphorus, Sodium & Protein load.",
    iconName: "fitness-outline",
    accentColor: "#0D9488",
    bgColor: "#F0FDFA",
    keyNutrients: ["Potassium", "Phosphorus", "Sodium", "Protein"],
  },
  {
    id: "diabetes",
    title: "Diabetes (Type 1 & 2)",
    shortName: "Diabetes",
    badgeLabel: "Glycemic & Glucose",
    description: "Evaluates Glycemic Index, Simple Sugars & Carbohydrate load.",
    iconName: "pulse-outline",
    accentColor: "#2563EB",
    bgColor: "#EFF6FF",
    keyNutrients: ["Glycemic Index", "Sugars", "Total Carbs", "Fiber"],
  },
  {
    id: "hypertension",
    title: "Heart Disease & Hypertension",
    shortName: "Heart / BP",
    badgeLabel: "Heart & Blood Pressure",
    description: "Monitors Sodium, Saturated Fats & Cholesterol.",
    iconName: "heart-outline",
    accentColor: "#DC2626",
    bgColor: "#FEF2F2",
    keyNutrients: ["Sodium", "Saturated Fat", "Trans Fat", "Cholesterol"],
  },
  {
    id: "celiac",
    title: "Celiac Disease",
    shortName: "Celiac",
    badgeLabel: "Gluten-Free",
    description: "Identifies Wheat, Rye, Barley, Spelt & hidden gluten cross-contamination.",
    iconName: "shield-checkmark-outline",
    accentColor: "#D97706",
    bgColor: "#FFFBEB",
    keyNutrients: ["Gluten Presence", "Cross-Contact Risk", "Safe Grains"],
  },
  {
    id: "allergy",
    title: "Food Allergy",
    shortName: "Allergy",
    badgeLabel: "Allergen Screening",
    description: "Flags Peanuts, Tree Nuts, Dairy, Soy, Shellfish & Histamines.",
    iconName: "alert-circle-outline",
    accentColor: "#7C3AED",
    bgColor: "#F5F3FF",
    keyNutrients: ["Peanuts / Nuts", "Dairy", "Shellfish", "Soy / Eggs"],
  },
];

// ─── Initial Search History ──────────────────────────────────────────────────
export const INITIAL_HISTORY: FoodSafetyAnalysis[] = [
  {
    id: "check-1",
    foodName: "Banana",
    category: "Fruit",
    condition: "ckd",
    status: "moderation",
    statusHeadline: "Consume in Moderation",
    summary:
      "Banana contains a relatively high amount of potassium (~422mg per medium fruit), which can elevate serum potassium levels for individuals managing kidney disease.",
    detailedWhy:
      "For patients with Chronic Kidney Disease, the kidneys cannot efficiently filter excess potassium from the bloodstream. High potassium (hyperkalemia) can affect cardiac rhythm. While bananas provide healthy vitamins, portion control or lower-potassium fruit substitutes are advisable.",
    factors: [
      { name: "Potassium", level: "High", impact: "warning", detail: "~422mg per medium fruit" },
      { name: "Sodium", level: "Low", impact: "positive", detail: "< 1mg (Kidney-friendly)" },
      { name: "Phosphorus", level: "Moderate", impact: "neutral", detail: "26mg per serving" },
      { name: "Saturated Fat", level: "None", impact: "positive", detail: "0g saturated fat" },
    ],
    alternatives: [
      { name: "Apple", reason: "Low potassium (~195mg), high fiber", icon: "nutrition-outline" },
      { name: "Blueberries", reason: "Rich in antioxidants, very low potassium", icon: "leaf-outline" },
      { name: "Pear", reason: "Gentle on kidneys with low mineral load", icon: "nutrition-outline" },
    ],
    portionGuidance: "Limit to half a medium banana (approx 60g) or enjoy lower-potassium berries.",
    timestamp: "Today, 6:42 PM",
  },
  {
    id: "check-2",
    foodName: "Pepperoni Pizza",
    category: "Prepared Food",
    condition: "hypertension",
    status: "not_recommended",
    statusHeadline: "Not Recommended",
    summary:
      "Pepperoni pizza is exceptionally high in sodium and saturated fats, presenting acute cardiovascular strain for patients with hypertension.",
    detailedWhy:
      "Processed cured meats combined with aged cheese and salted dough can exceed 1,500mg of sodium in just two slices (over 65% of the recommended daily limit). Excessive sodium causes water retention, immediately increasing arterial pressure.",
    factors: [
      { name: "Sodium", level: "High", impact: "danger", detail: "~780mg per slice (Very High)" },
      { name: "Saturated Fat", level: "High", impact: "danger", detail: "4.8g per slice" },
      { name: "Potassium", level: "Moderate", impact: "neutral", detail: "180mg" },
    ],
    alternatives: [
      { name: "Cauliflower Crust Veggie Pizza", reason: "Significantly lower sodium with fresh herbs", icon: "pizza-outline" },
      { name: "Grilled Chicken Flatbread", reason: "Lean protein with minimal sodium burden", icon: "restaurant-outline" },
    ],
    portionGuidance: "Avoid regular cured pepperoni pizza. Opt for unsalted homemade thin crust with fresh basil and tomatoes.",
    timestamp: "Today, 3:15 PM",
  },
  {
    id: "check-3",
    foodName: "White Rice (Boiled)",
    category: "Grains",
    condition: "diabetes",
    status: "moderation",
    statusHeadline: "Consume in Moderation",
    summary:
      "White rice has a high glycemic index (GI ~73) and can cause rapid postprandial blood glucose spikes unless paired with lean protein and fiber.",
    detailedWhy:
      "Refined white rice has had its fibrous bran and germ removed, leaving fast-digesting starches. Without sufficient fiber or fat to slow absorption, blood sugar levels rise quickly.",
    factors: [
      { name: "Glycemic Index", level: "High", impact: "warning", detail: "GI ~73 (Rapid glucose spike)" },
      { name: "Dietary Fiber", level: "Low", impact: "warning", detail: "0.4g per cup" },
      { name: "Total Carbs", level: "High", impact: "warning", detail: "45g per cup" },
      { name: "Sodium", level: "None", impact: "positive", detail: "0mg naturally" },
    ],
    alternatives: [
      { name: "Quinoa", reason: "Low GI, complete protein, high fiber", icon: "leaf-outline" },
      { name: "Cauliflower Rice", reason: "Virtually zero glycemic impact (< 3g carbs)", icon: "nutrition-outline" },
      { name: "Wild Brown Rice", reason: "Intact bran slows glucose breakdown", icon: "nutrition-outline" },
    ],
    portionGuidance: "Keep portions strictly under 1/2 cup cooked (approx 75g) and always pair with non-starchy greens.",
    timestamp: "Yesterday, 1:20 PM",
  },
  {
    id: "check-4",
    foodName: "Grilled Salmon Fillet",
    category: "Seafood / Protein",
    condition: "ckd",
    status: "safe",
    statusHeadline: "Safe to Consume",
    summary:
      "Fresh grilled salmon is an excellent source of high-quality protein and anti-inflammatory Omega-3 fatty acids with manageable potassium levels.",
    detailedWhy:
      "Wild and fresh salmon provides essential amino acids without synthetic additives or phosphate preservatives typically found in processed meats.",
    factors: [
      { name: "Protein Quality", level: "High", impact: "positive", detail: "22g clean bioavailable protein" },
      { name: "Sodium", level: "Low", impact: "positive", detail: "55mg (when unseasoned)" },
      { name: "Omega-3 Fats", level: "High", impact: "positive", detail: "Cardioprotective & anti-inflammatory" },
      { name: "Phosphorus", level: "Moderate", impact: "neutral", detail: "200mg (organic source)" },
    ],
    alternatives: [
      { name: "Atlantic Cod", reason: "Even lower potassium and phosphorus profile", icon: "water-outline" },
      { name: "Egg Whites", reason: "Pure protein with zero phosphorus burden", icon: "egg-outline" },
    ],
    portionGuidance: "Recommended portion is 3 to 4 oz (85g - 115g) cooked without added table salt.",
    timestamp: "May 12, 11:30 AM",
  },
];

// ─── Patient Profile ─────────────────────────────────────────────────────────
export const INITIAL_PATIENT: PatientProfile = {
  name: "Priyanshu",
  age: 32,
  gender: "Male",
  email: "priyanshu@example.com",
  city: "Mumbai",
  primaryCondition: "ckd",
  conditions: ["ckd"],
  notes: "Stage 2 CKD management with potassium and sodium moderation. Follows low-dairy diet.",
  allergensList: ["Peanuts", "Shellfish"],
  doctorName: "Dr. Sarah Mitchell, MD (Nephrology)",
  onboardingCompleted: true,
};

/** Recent search suggestions — India-focused staples; each still evaluated individually. */
export const FOOD_SUGGESTIONS = [
  "Idli",
  "Dal",
  "Roti",
  "Khichdi",
  "Banana",
  "Curd",
  "Poha",
  "Paneer",
  "Rice",
  "Dosa",
] as const;

// ─── Clinical Analysis Evaluation Engine ─────────────────────────────────────
export function evaluateFoodSafety(
  foodQuery: string,
  condition: PatientCondition
): FoodSafetyAnalysis {
  const query = foodQuery.toLowerCase().trim();

  const isIndianStaple = (terms: string[]) => terms.some((t) => query.includes(t));

  // Helper template generator
  const createResult = (
    name: string,
    cat: string,
    status: SafetyStatus,
    statusHeadline: string,
    summary: string,
    detailedWhy: string,
    factors: NutrientFactor[],
    alternatives: FoodAlternative[],
    portionGuidance: string
  ): FoodSafetyAnalysis => {
    const now = new Date();
    return {
      id: `check-${Date.now()}`,
      foodName: name,
      category: cat,
      condition,
      status,
      statusHeadline,
      summary,
      detailedWhy,
      factors,
      alternatives,
      portionGuidance,
      timestamp: `Today, ${now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`,
    };
  };

  // ─── 1. CHRONIC KIDNEY DISEASE (CKD) ──────────────────────────────
  if (condition === "ckd") {
    if (query.includes("banana") || query.includes("avocado") || query.includes("spinach") || query.includes("potato") || query.includes("tomato") || query.includes("orange")) {
      return createResult(
        query.charAt(0).toUpperCase() + query.slice(1),
        "Fresh Produce",
        "moderation",
        "Consume in Moderation",
        `${query.charAt(0).toUpperCase() + query.slice(1)} has a relatively high potassium content. Patients managing kidney function should carefully manage potassium intake.`,
        "In CKD, impaired renal clearance can cause potassium accumulation in the blood (hyperkalemia), potentially stressing heart rhythms. Eating small portions or choosing lower-potassium alternatives helps maintain electrolyte equilibrium.",
        [
          { name: "Potassium", level: "High", impact: "warning", detail: "Elevated potassium load per standard serving" },
          { name: "Sodium", level: "Low", impact: "positive", detail: "Naturally very low in sodium" },
          { name: "Phosphorus", level: "Moderate", impact: "neutral", detail: "Organic plant phosphorus" },
        ],
        [
          { name: "Apples & Apple Sauce", reason: "Naturally low in potassium and gentle on kidneys", icon: "nutrition-outline" },
          { name: "Blueberries & Strawberries", reason: "Rich in polyphenols with low mineral density", icon: "leaf-outline" },
          { name: "Cabbage & Cauliflower", reason: "Crunchy, low-potassium vegetable alternatives", icon: "nutrition-outline" },
        ],
        "Limit intake to a small portion (e.g. 50g-75g) and avoid consuming alongside other high-potassium foods."
      );
    }

    if (query.includes("pizza") || query.includes("bacon") || query.includes("sausage") || query.includes("canned") || query.includes("instant") || query.includes("soda")) {
      return createResult(
        query.charAt(0).toUpperCase() + query.slice(1),
        "Processed Foods",
        "not_recommended",
        "Not Recommended",
        `Processed items like ${query} contain inorganic sodium and chemical phosphate additives that place acute strain on compromised kidneys.`,
        "Inorganic phosphates added as preservatives in processed foods are absorbed nearly 100% by the gastrointestinal tract, causing rapid vascular calcification and fluid retention in kidney disease patients.",
        [
          { name: "Sodium", level: "High", impact: "danger", detail: "Exceeds single-meal renal thresholds (> 600mg)" },
          { name: "Inorganic Phosphorus", level: "High", impact: "danger", detail: "Highly bioavailable preservative phosphate" },
          { name: "Saturated Fat", level: "High", impact: "danger", detail: "Elevates vascular inflammation" },
        ],
        [
          { name: "Fresh Grilled Chicken Breast", reason: "Unprocessed lean protein with no added phosphates", icon: "restaurant-outline" },
          { name: "Homemade Veggie Stir-fry", reason: "Cooked with fresh garlic, herbs and zero salt", icon: "leaf-outline" },
        ],
        "Strictly avoid processed cured items. Prefer whole, scratch-cooked meals."
      );
    }

    // Default Safe for CKD
    return createResult(
      query.charAt(0).toUpperCase() + query.slice(1),
      "General Food",
      "safe",
      "Safe to Consume",
      `${query.charAt(0).toUpperCase() + query.slice(1)} aligns well with renal dietary guidelines with manageable potassium, phosphorus, and sodium levels.`,
      "This food does not contain excessive minerals that strain renal filtration. It provides healthy nutrition without triggering hyperkalemia or fluid retention when prepared without added table salt.",
      [
        { name: "Potassium", level: "Low", impact: "positive", detail: "Within safe kidney consumption thresholds" },
        { name: "Sodium", level: "Low", impact: "positive", detail: "Low sodium burden on blood pressure" },
        { name: "Phosphorus", level: "Low", impact: "positive", detail: "Minimal phosphate retention risk" },
      ],
      [
        { name: "Fresh Steamed Greens", reason: "Nutritious and light on renal filtration", icon: "leaf-outline" },
        { name: "White Rice or Pasta", reason: "Low potassium carbohydrate staple", icon: "restaurant-outline" },
      ],
      "Standard serving size (1 cup or 100g) prepared with fresh herbs rather than salt."
    );
  }

  // ─── 2. DIABETES ──────────────────────────────────────────────────
  if (condition === "diabetes") {
    if (query.includes("sugar") || query.includes("soda") || query.includes("cake") || query.includes("donut") || query.includes("candy") || query.includes("juice") || query.includes("syrup")) {
      return createResult(
        query.charAt(0).toUpperCase() + query.slice(1),
        "High Sugar Food",
        "not_recommended",
        "Not Recommended",
        `High concentration of refined simple sugars causes rapid, dangerous spikes in blood glucose levels.`,
        "Refined sugars enter the bloodstream almost immediately, requiring huge surges of insulin. In diabetic patients, this leads to prolonged hyperglycemia, insulin resistance, and vascular stress.",
        [
          { name: "Glycemic Index", level: "High", impact: "danger", detail: "GI > 80 (Severe spike potential)" },
          { name: "Added Sugars", level: "High", impact: "danger", detail: "> 25g simple fast sugars" },
          { name: "Dietary Fiber", level: "None", impact: "warning", detail: "0g fiber to buffer glucose absorption" },
        ],
        [
          { name: "Sparkling Water with Lime", reason: "Zero calories, zero blood sugar impact", icon: "water-outline" },
          { name: "Fresh Berries with Greek Yogurt", reason: "Low GI fruit with protein buffer", icon: "nutrition-outline" },
        ],
        "Avoid sugary drinks and refined confections completely."
      );
    }

    if (
      isIndianStaple(["idli", "dosa", "poha", "upma", "paratha", "chapati"]) ||
      query.includes("rice") ||
      query.includes("bread") ||
      query.includes("potato") ||
      query.includes("pasta") ||
      query.includes("banana") ||
      query.includes("mango")
    ) {
      return createResult(
        query.charAt(0).toUpperCase() + query.slice(1),
        "Carbohydrate Rich",
        "moderation",
        "Consume in Moderation",
        `${query.charAt(0).toUpperCase() + query.slice(1)} contains moderate-to-high carbohydrates that can elevate blood glucose unless paired with dietary fiber or lean protein.`,
        "Digestible carbohydrates break down into glucose. When eating moderate-GI carbohydrates, pairing with healthy fats or proteins slows gastric emptying and flattens the glycemic curve.",
        [
          { name: "Carbohydrates", level: "Moderate", impact: "warning", detail: "30g-45g total carbs per cup" },
          { name: "Glycemic Load", level: "Moderate", impact: "warning", detail: "Medium post-meal glycemic response" },
          { name: "Fiber", level: "Moderate", impact: "positive", detail: "Helps modulate glucose entry" },
        ],
        [
          { name: "Moong Dal Khichdi", reason: "Protein-fiber balance with moderate glycemic load", icon: "leaf-outline" },
          { name: "Vegetable Upma (semolina)", reason: "Smaller portions with added vegetables and fiber", icon: "nutrition-outline" },
          { name: "Ragi / Millet Dosa", reason: "Lower GI millet alternative to white rice dosa", icon: "restaurant-outline" },
        ],
        "Limit to 1/2 cup portion and always consume with protein (dal, eggs, paneer) and non-starchy vegetables."
      );
    }

    if (isIndianStaple(["dal", "sambar", "curd", "raita"])) {
      return createResult(
        query.charAt(0).toUpperCase() + query.slice(1),
        "Indian Staple",
        "safe",
        "Safe to Consume",
        `${query.charAt(0).toUpperCase() + query.slice(1)} is a protein-rich Indian staple with moderate carbohydrates and helpful fiber when prepared without excess oil or sugar.`,
        "Lentils and fermented dairy provide steady energy with protein that helps buffer glucose absorption — a common pattern in Indian meals.",
        [
          { name: "Glycemic Index", level: "Low", impact: "positive", detail: "Moderate GI when paired with vegetables" },
          { name: "Protein", level: "Moderate", impact: "positive", detail: "Dal provides plant protein" },
          { name: "Added Sugars", level: "Low", impact: "positive", detail: "Naturally low when unsweetened" },
        ],
        [
          { name: "Mixed Vegetable Dal", reason: "Extra fiber from seasonal vegetables", icon: "leaf-outline" },
          { name: "Plain Curd", reason: "Protein-rich, low GI accompaniment", icon: "nutrition-outline" },
        ],
        "Standard katori (small bowl) with salad or sabzi on the side."
      );
    }

    // Default Safe for Diabetes
    return createResult(
      query.charAt(0).toUpperCase() + query.slice(1),
      "Low Glycemic Food",
      "safe",
      "Safe to Consume",
      `${query.charAt(0).toUpperCase() + query.slice(1)} has a low glycemic footprint, minimal simple sugars, and supports stable blood sugar balance.`,
      "Foods with high fiber, lean proteins, or healthy unsaturated fats have minimal impact on blood glucose spikes, making them safe for daily diabetes management.",
      [
        { name: "Glycemic Index", level: "Low", impact: "positive", detail: "GI < 40 (Negligible glucose spike)" },
        { name: "Total Sugars", level: "Low", impact: "positive", detail: "< 3g sugar per serving" },
        { name: "Dietary Fiber", level: "High", impact: "positive", detail: "Stabilizes insulin response" },
      ],
      [
        { name: "Avocado & Olive Oil", reason: "Heart-healthy fats that enhance insulin sensitivity", icon: "leaf-outline" },
        { name: "Leafy Greens (Kale/Spinach)", reason: "Abundant micronutrients with zero glucose impact", icon: "nutrition-outline" },
      ],
      "Safe for regular consumption as part of balanced meal planning."
    );
  }

  // ─── 3. HEART DISEASE & HYPERTENSION ──────────────────────────────
  if (condition === "hypertension") {
    if (
      isIndianStaple(["biryani", "pickle", "papad", "namkeen"]) ||
      query.includes("pizza") ||
      query.includes("canned soup") ||
      query.includes("chips") ||
      query.includes("hot dog") ||
      query.includes("sausage") ||
      query.includes("soy sauce") ||
      query.includes("ramen") ||
      query.includes("bacon")
    ) {
      return createResult(
        query.charAt(0).toUpperCase() + query.slice(1),
        "High Sodium Food",
        "not_recommended",
        "Not Recommended",
        `Contains dangerous levels of sodium (> 600mg per serving) that immediately increase intravascular volume and blood pressure.`,
        "Excess sodium intake causes fluid retention and arterial constriction. For patients with hypertension or heart disease, heavy sodium meals can trigger acute BP elevations and cardiac strain.",
        [
          { name: "Sodium", level: "High", impact: "danger", detail: "High sodium concentration per serving" },
          { name: "Saturated Fat", level: "High", impact: "danger", detail: "Promotes endothelial inflammation" },
          { name: "Cholesterol", level: "Moderate", impact: "warning", detail: "Atherosclerotic risk factor" },
        ],
        [
          { name: "Plain Steamed Rice with Dal", reason: "Home-cooked, unsalted staple common across India", icon: "water-outline" },
          { name: "Phulkas with Low-Salt Sabzi", reason: "Whole wheat roti with fresh vegetable curry, minimal salt", icon: "restaurant-outline" },
        ],
        "Avoid restaurant biryani and packaged namkeen. Home-cooked meals with minimal added salt are safer."
      );
    }

    if (
      isIndianStaple(["paneer", "butter chicken", "malai", "ghee"]) ||
      query.includes("cheese") ||
      query.includes("butter") ||
      query.includes("steak") ||
      query.includes("beef") ||
      query.includes("pork") ||
      query.includes("burger")
    ) {
      return createResult(
        query.charAt(0).toUpperCase() + query.slice(1),
        "Moderate Saturated Fat",
        "moderation",
        "Consume in Moderation",
        `Contains saturated fats and moderate sodium that should be limited to prevent long-term arterial plaque accumulation.`,
        "Dietary saturated fats raise LDL cholesterol. Moderate consumption balanced with high-potassium greens and omega-3s helps safeguard coronary artery health.",
        [
          { name: "Saturated Fat", level: "Moderate", impact: "warning", detail: "3g-6g per serving" },
          { name: "Sodium", level: "Moderate", impact: "warning", detail: "250mg-400mg" },
          { name: "Potassium", level: "Moderate", impact: "positive", detail: "Helps buffer vascular tension" },
        ],
        [
          { name: "Wild Salmon / Tuna", reason: "Rich in cardioprotective EPA and DHA fatty acids", icon: "water-outline" },
          { name: "Extra Virgin Olive Oil", reason: "Monounsaturated fat that supports HDL levels", icon: "leaf-outline" },
        ],
        "Limit to 3 oz lean cuts no more than 1-2 times per week."
      );
    }

    // Default Safe for Hypertension
    return createResult(
      query.charAt(0).toUpperCase() + query.slice(1),
      "Cardioprotective Food",
      "safe",
      "Safe to Consume",
      `${query.charAt(0).toUpperCase() + query.slice(1)} is naturally low in sodium and supports healthy vascular elasticity.`,
      "Rich in natural minerals like potassium and magnesium, this food aids vasodilation and helps counter the hypertensive effects of dietary sodium.",
      [
        { name: "Sodium", level: "Low", impact: "positive", detail: "< 50mg (DASH diet compliant)" },
        { name: "Potassium", level: "High", impact: "positive", detail: "Promotes natural vasodilation" },
        { name: "Saturated Fat", level: "None", impact: "positive", detail: "0g saturated fat" },
      ],
      [
        { name: "Steamed Broccoli", reason: "Potassium and antioxidant powerhouse", icon: "leaf-outline" },
        { name: "Raw Walnuts", reason: "Plant Omega-3 ALA for arterial health", icon: "nutrition-outline" },
      ],
      "Safe for unrestricted daily portioning in DASH and Mediterranean eating plans."
    );
  }

  // ─── 4. CELIAC DISEASE ────────────────────────────────────────────
  if (condition === "celiac") {
    if (
      isIndianStaple(["roti", "chapati", "naan", "paratha", "puri", "bhatura"]) ||
      query.includes("wheat") ||
      query.includes("bread") ||
      query.includes("pasta") ||
      query.includes("pizza") ||
      query.includes("beer") ||
      query.includes("barley") ||
      query.includes("rye") ||
      query.includes("cookie") ||
      query.includes("flour")
    ) {
      return createResult(
        query.charAt(0).toUpperCase() + query.slice(1),
        "Gluten-Containing Food",
        "not_recommended",
        "Not Recommended",
        `Contains gluten proteins (gliadin/glutenin) that trigger autoimmune intestinal villi destruction in Celiac patients.`,
        "Even microscopic trace amounts of gluten provoke an autoimmune T-cell response in celiac disease, causing blunting of intestinal villi, chronic malabsorption, and systemic inflammation.",
        [
          { name: "Gluten Content", level: "Contains", impact: "danger", detail: "Wheat/Rye/Barley proteins present" },
          { name: "Autoimmune Trigger", level: "High", impact: "danger", detail: "Causes intestinal mucosal damage" },
        ],
        [
          { name: "Rice Roti / Akki Roti", reason: "South Indian rice-flour flatbread, naturally gluten-free", icon: "leaf-outline" },
          { name: "Idli / Dosa (rice-based)", reason: "Fermented rice and lentil staples without wheat", icon: "restaurant-outline" },
          { name: "Buckwheat / Rajgira Roti", reason: "Traditional gluten-free grain used across India", icon: "nutrition-outline" },
        ],
        "Strict 0% gluten tolerance. Look strictly for Certified Gluten-Free labeling."
      );
    }

    if (query.includes("oats") || query.includes("soy sauce") || query.includes("dressing") || query.includes("gravy") || query.includes("processed meat")) {
      return createResult(
        query.charAt(0).toUpperCase() + query.slice(1),
        "Potential Cross-Contact",
        "moderation",
        "Consume in Moderation",
        `Naturally gluten-free grain or condiment that frequently suffers from industrial wheat cross-contamination.`,
        "Oats and pre-packaged sauces are often processed on shared mill lines with wheat. Unless explicitly labeled 'Certified Gluten-Free', trace cross-contamination can occur.",
        [
          { name: "Cross-Contact Risk", level: "Moderate", impact: "warning", detail: "Shared harvesting or manufacturing equipment" },
          { name: "Gluten Level", level: "Low", impact: "neutral", detail: "Check specific packaging for certification" },
        ],
        [
          { name: "Tamari (Gluten-Free Soy Sauce)", reason: "Fermented without wheat filler", icon: "water-outline" },
          { name: "Certified GF Rolled Oats", reason: "Batch-tested < 20 ppm gluten", icon: "leaf-outline" },
        ],
        "Verify certified gluten-free seal on the package prior to consumption."
      );
    }

    // Default Safe for Celiac
    return createResult(
      query.charAt(0).toUpperCase() + query.slice(1),
      "Naturally Gluten-Free",
      "safe",
      "Safe to Consume",
      `${query.charAt(0).toUpperCase() + query.slice(1)} is naturally 100% free of wheat, barley, and rye gluten proteins.`,
      "Whole unprocessed fresh meats, produce, eggs, and naturally gluten-free grains do not contain the amino acid sequences that trigger celiac autoimmune reactions.",
      [
        { name: "Gluten Content", level: "None", impact: "positive", detail: "0 ppm gluten peptides" },
        { name: "Intestinal Safety", level: "High", impact: "positive", detail: "Safe for mucosal recovery" },
      ],
      [
        { name: "Fresh Fruits & Veggies", reason: "Naturally non-immunogenic produce", icon: "nutrition-outline" },
        { name: "Quinoa, Buckwheat, Rice", reason: "Complete gluten-free complex carbohydrate bases", icon: "leaf-outline" },
      ],
      "Safe for consumption. Ensure food preparation surfaces are free of wheat crumbs."
    );
  }

  // ─── 5. FOOD ALLERGY ──────────────────────────────────────────────
  if (condition === "allergy") {
    if (query.includes("peanut") || query.includes("shellfish") || query.includes("shrimp") || query.includes("crab") || query.includes("lobster") || query.includes("walnut") || query.includes("almond") || query.includes("cashew")) {
      return createResult(
        query.charAt(0).toUpperCase() + query.slice(1),
        "Major Allergen",
        "not_recommended",
        "Not Recommended",
        `Contains major IgE-mediated allergens listed on patient profile (Peanuts / Tree Nuts / Shellfish).`,
        "Exposure can trigger immediate hypersensitivity reactions ranging from localized urticaria to severe bronchospasm and anaphylaxis. Strict avoidance is medically mandatory.",
        [
          { name: "Allergen Match", level: "Contains", impact: "danger", detail: "Matches patient profile allergen alert" },
          { name: "Anaphylaxis Risk", level: "High", impact: "danger", detail: "IgE immune reaction risk" },
        ],
        [
          { name: "Sunflower Seed Butter", reason: "Nut-free spread with identical creamy texture", icon: "leaf-outline" },
          { name: "Wild Alaskan Cod", reason: "White fish safe if non-allergic to finfish", icon: "water-outline" },
          { name: "Pumpkin Seeds", reason: "Nutrient-dense nut-free crunch alternative", icon: "nutrition-outline" },
        ],
        "DO NOT CONSUME. Ensure Epinephrine auto-injector is accessible."
      );
    }

    if (query.includes("milk") || query.includes("cheese") || query.includes("egg") || query.includes("soy") || query.includes("sesame")) {
      return createResult(
        query.charAt(0).toUpperCase() + query.slice(1),
        "Common Allergenic Item",
        "moderation",
        "Consume in Moderation",
        `Belongs to the Top 9 common food allergen groups. Review patient-specific allergy panels before ingestion.`,
        "Secondary allergens like dairy or soy can trigger digestive discomfort or atopic flares. If no clinical IgE diagnosis exists, small test portions are suggested.",
        [
          { name: "Allergen Family", level: "Moderate", impact: "warning", detail: "Common food allergen group" },
          { name: "Tolerance Check", level: "Moderate", impact: "neutral", detail: "Subject to individual patient sensitivity" },
        ],
        [
          { name: "Oat Milk (Unsweetened)", reason: "Dairy-free, soy-free hypoallergenic milk", icon: "water-outline" },
          { name: "Coconut Amino Sauce", reason: "Soy-free seasoning substitute", icon: "leaf-outline" },
        ],
        "Verify your personal allergy panel before introducing this item."
      );
    }

    // Default Safe for Allergy
    return createResult(
      query.charAt(0).toUpperCase() + query.slice(1),
      "Hypoallergenic Food",
      "safe",
      "Safe to Consume",
      `${query.charAt(0).toUpperCase() + query.slice(1)} does not contain any of the patient's flagged allergens and has a low historical sensitization rate.`,
      "This item is free of common trigger proteins that stimulate IgE or histamine reactions, making it safe for patient dietary inclusion.",
      [
        { name: "Allergen Presence", level: "None", impact: "positive", detail: "No peanut, nut, or shellfish traces" },
        { name: "Histamine Load", level: "Low", impact: "positive", detail: "Minimal mast cell activation" },
      ],
      [
        { name: "Organic Steamed Rice", reason: "Gold-standard hypoallergenic staple", icon: "restaurant-outline" },
        { name: "Steamed Zucchini", reason: "Gentle on gastrointestinal barrier", icon: "leaf-outline" },
      ],
      "Safe for consumption. Wash fresh produce thoroughly to eliminate environmental pollen."
    );
  }

  // Fallback
  return createResult(
    query.charAt(0).toUpperCase() + query.slice(1),
    "Food Item",
    "safe",
    "Safe to Consume",
    `Analysis indicates ${query} is safe for consumption under standard dietary guidelines.`,
    "No acute clinical risks identified for the current patient category.",
    [{ name: "Overall Profile", level: "Low", impact: "positive", detail: "Within safe health parameters" }],
    [{ name: "Fresh Vegetables", reason: "Healthy staple", icon: "leaf-outline" }],
    "Enjoy as part of a balanced diet."
  );
}

// ─── Multi-Condition Merge (worst status wins) ───────────────────────────────
const STATUS_PRIORITY: Record<SafetyStatus, number> = {
  safe: 0,
  moderation: 1,
  not_recommended: 2,
};

const HEADLINE_FOR_STATUS: Record<SafetyStatus, string> = {
  safe: "Safe to Consume",
  moderation: "Consume in Moderation",
  not_recommended: "Not Recommended",
};

const CONDITION_SHORT: Record<PatientCondition, string> = {
  ckd: "CKD",
  diabetes: "Diabetes",
  hypertension: "Heart/BP",
  celiac: "Celiac",
  allergy: "Allergy",
};

/**
 * Evaluate a food against EVERY selected condition and merge the results.
 * The final verdict is the most restrictive one — a food must be safe for all
 * conditions to be marked safe.
 */
export function evaluateFoodSafetyMulti(
  foodQuery: string,
  conditions: PatientCondition[]
): FoodSafetyAnalysis {
  const unique = [...new Set(conditions.length > 0 ? conditions : ["ckd" as PatientCondition])];
  const results = unique.map((c) => evaluateFoodSafety(foodQuery, c));

  if (results.length === 1) return { ...results[0], conditions: unique };

  // Worst status wins.
  const worst = results.reduce((a, b) => (STATUS_PRIORITY[b.status] > STATUS_PRIORITY[a.status] ? b : a));

  const seenFactors = new Set<string>();
  const factors: NutrientFactor[] = [];
  for (const r of results) {
    for (const f of r.factors) {
      const key = `${f.name}|${f.level}`;
      if (!seenFactors.has(key)) {
        seenFactors.add(key);
        factors.push(f);
      }
    }
  }

  const seenAlts = new Set<string>();
  const alternatives: FoodAlternative[] = [];
  for (const r of results) {
    for (const a of r.alternatives) {
      if (!seenAlts.has(a.name.toLowerCase())) {
        seenAlts.add(a.name.toLowerCase());
        alternatives.push(a);
      }
    }
  }

  const summaryParts = results.map(
    (r) => `${CONDITION_SHORT[r.condition]}: ${r.summary}`
  );

  return {
    id: `check-${Date.now()}`,
    foodName: worst.foodName,
    category: worst.category,
    condition: unique[0],
    conditions: unique,
    status: worst.status,
    statusHeadline: HEADLINE_FOR_STATUS[worst.status],
    summary: summaryParts.join(" "),
    detailedWhy: results.map((r) => `[${CONDITION_SHORT[r.condition]}] ${r.detailedWhy}`).join("\n\n"),
    factors: factors.slice(0, 6),
    alternatives: alternatives.slice(0, 4),
    portionGuidance: results
      .map((r) => (r.portionGuidance ? `${CONDITION_SHORT[r.condition]}: ${r.portionGuidance}` : ""))
      .filter(Boolean)
      .join(" "),
    timestamp: `Today, ${new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`,
  };
}

// ─── Reactive Store for Food Safety Analyses ─────────────────────────────────
type Listener = () => void;
class FoodSafetyStore {
  private history: FoodSafetyAnalysis[] = [];
  private currentPatient: PatientProfile = { ...INITIAL_PATIENT };
  private selectedConditions: PatientCondition[] = ["ckd"];
  private listeners: Set<Listener> = new Set();

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((cb) => cb());
  }

  getHistory(): FoodSafetyAnalysis[] {
    return this.history;
  }

  setHistory(history: FoodSafetyAnalysis[]) {
    this.history = history;
    this.notify();
  }

  getPatient(): PatientProfile {
    return this.currentPatient;
  }

  updatePatient(profile: Partial<PatientProfile>) {
    this.currentPatient = { ...this.currentPatient, ...profile };
    if (profile.conditions && profile.conditions.length > 0) {
      this.selectedConditions = [...profile.conditions];
      this.currentPatient.primaryCondition = profile.conditions[0];
    } else if (profile.primaryCondition) {
      this.selectedConditions = [profile.primaryCondition];
    }
    this.notify();
  }

  hydratePatient(profile: PatientProfile) {
    this.currentPatient = { ...profile };
    const conds = getProfileConditions(profile);
    this.selectedConditions = conds;
    this.currentPatient.primaryCondition = conds[0];
    this.notify();
  }

  getSelectedConditions(): PatientCondition[] {
    return this.selectedConditions;
  }

  setSelectedConditions(conditions: PatientCondition[]) {
    const unique = [...new Set(conditions)];
    this.selectedConditions = unique;
    this.currentPatient.conditions = unique;
    this.currentPatient.primaryCondition = unique[0] ?? "ckd";
    this.notify();
  }

  addAnalysis(analysis: FoodSafetyAnalysis) {
    this.history = [analysis, ...this.history];
    this.notify();
  }

  clearHistory() {
    this.history = [];
    this.notify();
  }
}

export const foodSafetyStore = new FoodSafetyStore();
