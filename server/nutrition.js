/* NutriSafe — food nutrition catalog + daily totals
 *
 * The food log stores nutrition per ONE unit of whatever unit the patient
 * recorded (g, ml, piece, cup, ...). Consumed totals are always
 * `nutritionPerUnit × quantity`, so changing a quantity recalculates the day
 * without re-fetching any external service.
 *
 * Values are realistic per-100g estimates for common foods (India-focused
 * staples included). Unknown foods fall back to a category heuristic — the
 * result is deterministic, never a hard failure, and labelled as an estimate
 * in the API response. This module is intentionally dependency-free.
 */

const NUTRIENT_KEYS = [
  "calories",
  "protein",
  "carbs",
  "fat",
  "fiber",
  "sugar",
  "sodium",
  "potassium",
  "phosphorus",
  "saturatedFat",
  "cholesterol",
];

/** Grams represented by one unit when a food has no specific override. */
const DEFAULT_UNIT_GRAMS = Object.freeze({
  g: 1,
  ml: 1,
  serving: 100,
  piece: 60,
  cup: 240,
  bowl: 200,
  slice: 30,
  tbsp: 15,
  tsp: 5,
});

const UNITS = Object.keys(DEFAULT_UNIT_GRAMS);

/** Positional facts builder keeps the catalog readable. */
function f(
  calories,
  protein,
  carbs,
  fat,
  fiber,
  sugar,
  sodium,
  potassium,
  phosphorus,
  saturatedFat = 0,
  cholesterol = 0
) {
  return {
    calories,
    protein,
    carbs,
    fat,
    fiber,
    sugar,
    sodium,
    potassium,
    phosphorus,
    saturatedFat,
    cholesterol,
  };
}

const CATALOG = [
  // ─── Fruit ──────────────────────────────────────────────────────────────────
  {
    aliases: ["banana", "kela"],
    category: "Fruit",
    per100g: f(89, 1.1, 22.8, 0.3, 2.6, 12.2, 1, 358, 22),
    units: { piece: 118, serving: 118 },
  },
  {
    aliases: ["apple", "seb"],
    category: "Fruit",
    per100g: f(52, 0.3, 13.8, 0.2, 2.4, 10.4, 1, 107, 11),
    units: { piece: 182, serving: 182 },
  },
  {
    aliases: ["orange", "santra"],
    category: "Fruit",
    per100g: f(47, 0.9, 11.8, 0.1, 2.4, 9.4, 0, 181, 14),
    units: { piece: 140, serving: 140 },
  },
  {
    aliases: ["mango", "aam"],
    category: "Fruit",
    per100g: f(60, 0.8, 15, 0.4, 1.6, 13.7, 1, 168, 14),
    units: { piece: 200, serving: 200 },
  },
  {
    aliases: ["grapes", "grape", "angoor"],
    category: "Fruit",
    per100g: f(69, 0.7, 18.1, 0.2, 0.9, 15.5, 2, 191, 20),
    units: { cup: 151, serving: 100 },
  },
  {
    aliases: ["watermelon", "tarbooz"],
    category: "Fruit",
    per100g: f(30, 0.6, 7.6, 0.2, 0.4, 6.2, 1, 112, 11),
    units: { cup: 152, serving: 150 },
  },
  {
    aliases: ["papaya", "papita"],
    category: "Fruit",
    per100g: f(43, 0.5, 10.8, 0.3, 1.7, 7.8, 8, 182, 10),
    units: { cup: 145, serving: 140 },
  },
  {
    aliases: ["guava", "amrud"],
    category: "Fruit",
    per100g: f(68, 2.6, 14.3, 1, 5.4, 8.9, 2, 417, 40),
    units: { piece: 55, serving: 55 },
  },
  {
    aliases: ["pear", "nashpati"],
    category: "Fruit",
    per100g: f(57, 0.4, 15.2, 0.1, 3.1, 9.8, 1, 116, 12),
    units: { piece: 178, serving: 178 },
  },
  {
    aliases: ["pineapple", "ananas"],
    category: "Fruit",
    per100g: f(50, 0.5, 13.1, 0.1, 1.4, 9.9, 1, 109, 8),
    units: { cup: 165, serving: 100 },
  },
  {
    aliases: ["pomegranate", "anar"],
    category: "Fruit",
    per100g: f(83, 1.7, 18.7, 1.2, 4, 13.7, 3, 236, 36),
    units: { cup: 174, serving: 100 },
  },
  {
    aliases: ["strawberry", "blueberry", "berries", "berry"],
    category: "Fruit",
    per100g: f(50, 0.8, 12, 0.4, 2.6, 8, 2, 150, 20),
    units: { cup: 150, serving: 100 },
  },

  // ─── Grains & staples ───────────────────────────────────────────────────────
  {
    aliases: ["white rice", "steamed rice", "rice", "chawal"],
    category: "Grains",
    per100g: f(130, 2.7, 28.2, 0.3, 0.4, 0.1, 1, 35, 43),
    units: { cup: 158, bowl: 200, serving: 150 },
  },
  {
    aliases: ["brown rice"],
    category: "Grains",
    per100g: f(112, 2.3, 23.5, 0.8, 1.8, 0.4, 5, 86, 83),
    units: { cup: 195, bowl: 200, serving: 150 },
  },
  {
    aliases: ["khichdi", "khichri"],
    category: "Grains",
    per100g: f(120, 4.2, 21.5, 2.2, 2, 1.2, 250, 150, 80),
    units: { bowl: 200, serving: 200 },
  },
  {
    aliases: ["roti", "chapati", "chapatti", "phulka"],
    category: "Grains",
    per100g: f(297, 9.5, 46, 7.5, 5, 2, 400, 200, 150),
    units: { piece: 40, serving: 40 },
  },
  {
    aliases: ["paratha", "parantha"],
    category: "Grains",
    per100g: f(330, 6.4, 45, 13, 4.5, 3, 450, 180, 120),
    units: { piece: 80, serving: 80 },
  },
  {
    aliases: ["bread", "toast", "slice of bread"],
    category: "Grains",
    per100g: f(265, 9, 49, 3.2, 2.7, 5, 491, 115, 75),
    units: { slice: 28, serving: 28 },
  },
  {
    aliases: ["oats", "oatmeal", "porridge"],
    category: "Grains",
    per100g: f(389, 16.9, 66.3, 6.9, 10.6, 1, 2, 429, 523),
    units: { cup: 81, serving: 40 },
  },
  {
    aliases: ["poha", "flattened rice"],
    category: "Grains",
    per100g: f(130, 2.6, 26, 2.2, 1, 1, 250, 60, 30),
    units: { bowl: 200, serving: 200 },
  },
  {
    aliases: ["upma", "uppuma"],
    category: "Grains",
    per100g: f(150, 4, 24, 4.5, 3, 1.5, 300, 120, 60),
    units: { bowl: 200, serving: 200 },
  },
  {
    aliases: ["idli", "idly"],
    category: "Grains",
    per100g: f(160, 4.5, 30, 1.5, 1.5, 1, 300, 80, 60),
    units: { piece: 40, serving: 80 },
  },
  {
    aliases: ["dosa", "dose"],
    category: "Grains",
    per100g: f(168, 4, 28, 5, 2, 1, 350, 100, 60),
    units: { piece: 80, serving: 80 },
  },
  {
    aliases: ["pasta", "noodles", "noodle"],
    category: "Grains",
    per100g: f(158, 5.8, 30.9, 0.9, 1.8, 0.6, 1, 44, 58),
    units: { cup: 140, bowl: 200, serving: 150 },
  },
  {
    aliases: ["quinoa"],
    category: "Grains",
    per100g: f(120, 4.4, 21.3, 1.9, 2.8, 0.9, 7, 172, 152),
    units: { cup: 185, bowl: 200, serving: 150 },
  },

  // ─── Legumes & protein ──────────────────────────────────────────────────────
  {
    aliases: ["dal", "daal", "lentil", "lentils", "sambar", "sambhar"],
    category: "Protein",
    per100g: f(116, 5.4, 18, 1.5, 3, 1.5, 200, 180, 90),
    units: { bowl: 200, cup: 200, serving: 150 },
  },
  {
    aliases: ["rajma", "kidney beans"],
    category: "Protein",
    per100g: f(127, 8.7, 22.8, 0.5, 6.4, 0.3, 1, 403, 140),
    units: { bowl: 200, cup: 177, serving: 150 },
  },
  {
    aliases: ["chole", "chana", "chickpeas", "chickpea"],
    category: "Protein",
    per100g: f(164, 8.9, 27.4, 2.6, 7.6, 4.8, 7, 291, 168),
    units: { bowl: 200, cup: 164, serving: 150 },
  },
  {
    aliases: ["paneer", "cottage cheese"],
    category: "Protein",
    per100g: f(265, 18.3, 1.2, 20.8, 0, 1.2, 18, 138, 200),
    units: { piece: 30, serving: 100 },
  },
  {
    aliases: ["tofu", "soya", "soy"],
    category: "Protein",
    per100g: f(144, 15.8, 4.3, 8.7, 2.3, 0.6, 14, 237, 190),
    units: { piece: 85, serving: 100 },
  },
  {
    aliases: ["egg", "eggs", "anda"],
    category: "Protein",
    per100g: f(155, 13, 1.1, 11, 0, 1.1, 124, 126, 198, 3.3, 373),
    units: { piece: 50, serving: 50 },
  },
  {
    aliases: ["chicken", "murgh"],
    category: "Protein",
    per100g: f(165, 31, 0, 3.6, 0, 0, 74, 256, 200, 1, 85),
    units: { piece: 100, serving: 100 },
  },
  {
    aliases: ["fish", "machli", "salmon", "tuna"],
    category: "Protein",
    per100g: f(206, 22, 0, 12, 0, 0, 61, 380, 240, 3, 60),
    units: { piece: 100, serving: 100 },
  },
  {
    aliases: ["mutton", "lamb", "goat meat"],
    category: "Protein",
    per100g: f(258, 25, 0, 17, 0, 0, 72, 310, 190, 7.5, 95),
    units: { piece: 100, serving: 100 },
  },
  {
    aliases: ["beans", "green beans", "lobia"],
    category: "Protein",
    per100g: f(127, 8.7, 22.8, 0.5, 6.4, 0.3, 1, 403, 140),
    units: { bowl: 200, cup: 177, serving: 150 },
  },

  // ─── Dairy ──────────────────────────────────────────────────────────────────
  {
    aliases: ["milk", "doodh"],
    category: "Dairy",
    per100g: f(61, 3.2, 4.8, 3.3, 0, 5.1, 43, 132, 93),
    units: { cup: 244, ml: 1, serving: 244 },
  },
  {
    aliases: ["curd", "yogurt", "yoghurt", "dahi", "raita"],
    category: "Dairy",
    per100g: f(61, 3.5, 4.7, 3.3, 0, 4.7, 46, 155, 95),
    units: { cup: 245, bowl: 200, serving: 150 },
  },
  {
    aliases: ["cheese"],
    category: "Dairy",
    per100g: f(402, 25, 1.3, 33, 0, 0.5, 621, 98, 512, 21, 105),
    units: { slice: 28, serving: 30 },
  },
  {
    aliases: ["peanut butter"],
    category: "Fats & Nuts",
    per100g: f(588, 25, 20, 50, 6, 9, 459, 649, 335, 10, 0),
    units: { tbsp: 16, tsp: 5, serving: 32 },
  },
  {
    aliases: ["butter"],
    category: "Fats & Nuts",
    per100g: f(717, 0.9, 0.1, 81, 0, 0.1, 643, 24, 24, 51, 215),
    units: { tbsp: 14, tsp: 5, serving: 14 },
  },
  {
    aliases: ["ghee", "clarified butter"],
    category: "Fats & Nuts",
    per100g: f(884, 0, 0, 100, 0, 0, 0, 0, 0, 60, 256),
    units: { tbsp: 14, tsp: 5, serving: 14 },
  },
  {
    aliases: ["oil", "olive oil", "mustard oil", "cooking oil"],
    category: "Fats & Nuts",
    per100g: f(884, 0, 0, 100, 0, 0, 0, 0, 0, 14, 0),
    units: { tbsp: 14, tsp: 5, serving: 14 },
  },
  {
    aliases: ["almond", "almonds", "badam"],
    category: "Fats & Nuts",
    per100g: f(579, 21.2, 21.6, 49.9, 12.5, 4.4, 1, 733, 481),
    units: { piece: 1.2, serving: 28, cup: 143 },
  },
  {
    aliases: ["peanut", "peanuts", "groundnut", "moongphali"],
    category: "Fats & Nuts",
    per100g: f(567, 25.8, 16.1, 49.2, 8.5, 4.7, 18, 705, 376),
    units: { piece: 1, serving: 28, cup: 146 },
  },

  // ─── Vegetables ─────────────────────────────────────────────────────────────
  {
    aliases: ["sweet potato", "shakarkandi"],
    category: "Vegetables",
    per100g: f(86, 1.6, 20, 0.1, 3, 4.2, 55, 337, 47),
    units: { piece: 130, cup: 133, serving: 130 },
  },
  {
    aliases: ["potato", "aloo", "boiled potato"],
    category: "Vegetables",
    per100g: f(87, 1.9, 20, 0.1, 1.8, 0.9, 4, 328, 44),
    units: { piece: 150, cup: 156, serving: 150 },
  },
  {
    aliases: ["spinach", "palak", "greens"],
    category: "Vegetables",
    per100g: f(23, 2.9, 3.6, 0.4, 2.2, 0.4, 79, 558, 49),
    units: { cup: 30, bowl: 100, serving: 100 },
  },
  {
    aliases: ["broccoli"],
    category: "Vegetables",
    per100g: f(34, 2.8, 6.6, 0.4, 2.6, 1.7, 33, 316, 66),
    units: { cup: 91, serving: 100 },
  },
  {
    aliases: ["tomato", "tamatar"],
    category: "Vegetables",
    per100g: f(18, 0.9, 3.9, 0.2, 1.2, 2.6, 5, 237, 24),
    units: { piece: 123, cup: 180, serving: 100 },
  },
  {
    aliases: ["cucumber", "kheera"],
    category: "Vegetables",
    per100g: f(15, 0.7, 3.6, 0.1, 0.5, 1.7, 2, 147, 24),
    units: { piece: 200, cup: 104, serving: 100 },
  },
  {
    aliases: ["carrot", "gajar"],
    category: "Vegetables",
    per100g: f(41, 0.9, 9.6, 0.2, 2.8, 4.7, 69, 320, 35),
    units: { piece: 61, cup: 128, serving: 100 },
  },
  {
    aliases: ["mixed vegetables", "sabzi", "sabji", "vegetable curry"],
    category: "Vegetables",
    per100g: f(80, 2.8, 10, 3, 3, 3, 250, 300, 60),
    units: { bowl: 200, cup: 200, serving: 150 },
  },

  // ─── Prepared & snack foods ─────────────────────────────────────────────────
  {
    aliases: ["samosa"],
    category: "Prepared Food",
    per100g: f(308, 5.5, 32, 18, 3, 2, 550, 150, 70),
    units: { piece: 60, serving: 60 },
  },
  {
    aliases: ["pakora", "pakoda", "bhajji", "bhajjiya"],
    category: "Prepared Food",
    per100g: f(315, 7, 30, 19, 3.5, 2, 500, 180, 80),
    units: { piece: 25, serving: 100 },
  },
  {
    aliases: ["pizza"],
    category: "Prepared Food",
    per100g: f(266, 11, 33, 10, 2.3, 3.6, 598, 172, 188, 4.5, 17),
    units: { slice: 107, serving: 214 },
  },
  {
    aliases: ["burger", "hamburger"],
    category: "Prepared Food",
    per100g: f(295, 17, 24, 14, 1.5, 5, 500, 200, 130, 5, 40),
    units: { piece: 120, serving: 120 },
  },
  {
    aliases: ["fries", "french fries", "chips"],
    category: "Prepared Food",
    per100g: f(312, 3.4, 41, 15, 3.8, 0.3, 210, 579, 125, 2.3, 0),
    units: { serving: 117, cup: 100 },
  },
  {
    aliases: ["biscuit", "cookie", "cracker"],
    category: "Snacks",
    per100g: f(450, 6, 70, 16, 2, 25, 500, 150, 100, 8, 0),
    units: { piece: 10, serving: 30 },
  },
  {
    aliases: ["chocolate"],
    category: "Snacks",
    per100g: f(546, 4.9, 61, 31, 3.4, 52, 24, 372, 206, 18, 8),
    units: { piece: 10, serving: 30 },
  },
  {
    aliases: ["cake", "pastry"],
    category: "Snacks",
    per100g: f(350, 5, 50, 15, 1, 30, 350, 120, 90, 6, 55),
    units: { slice: 80, piece: 80, serving: 80 },
  },
  {
    aliases: ["ice cream"],
    category: "Snacks",
    per100g: f(207, 3.5, 24, 11, 0.7, 21, 80, 199, 105, 6.8, 44),
    units: { cup: 132, serving: 100 },
  },
  {
    aliases: ["sugar", "cheeni"],
    category: "Sweets & Sugars",
    per100g: f(387, 0, 100, 0, 0, 100, 1, 2, 0),
    units: { tsp: 4, tbsp: 12, serving: 4 },
  },
  {
    aliases: ["honey", "shahad"],
    category: "Sweets & Sugars",
    per100g: f(304, 0.3, 82.4, 0, 0.2, 82.1, 4, 52, 4),
    units: { tsp: 7, tbsp: 21, serving: 21 },
  },
  {
    aliases: ["halwa", "laddu", "laddoo", "gulab jamun", "jalebi", "kheer", "sweet"],
    category: "Sweets & Sugars",
    per100g: f(350, 4, 55, 13, 1, 40, 120, 120, 70, 5, 30),
    units: { piece: 50, bowl: 150, serving: 100 },
  },

  // ─── Beverages ──────────────────────────────────────────────────────────────
  {
    aliases: ["tea", "chai", "milk tea", "green tea"],
    category: "Beverages",
    per100g: f(40, 1.4, 5, 1.5, 0, 4.5, 15, 60, 40),
    units: { cup: 240, ml: 1, serving: 240 },
  },
  {
    aliases: ["coffee", "filter coffee"],
    category: "Beverages",
    per100g: f(2, 0.1, 0, 0, 0, 0, 2, 49, 3),
    units: { cup: 240, ml: 1, serving: 240 },
  },
  {
    aliases: ["orange juice", "fruit juice", "juice"],
    category: "Beverages",
    per100g: f(45, 0.7, 10.4, 0.2, 0.2, 8.4, 1, 200, 17),
    units: { cup: 248, ml: 1, serving: 250 },
  },
  {
    aliases: ["coconut water", "nariyal pani"],
    category: "Beverages",
    per100g: f(19, 0.7, 3.7, 0.2, 1.1, 2.6, 105, 250, 20),
    units: { cup: 240, ml: 1, serving: 240 },
  },
  {
    aliases: ["soda", "cola", "soft drink"],
    category: "Beverages",
    per100g: f(41, 0, 10.6, 0, 0, 10.6, 4, 2, 10),
    units: { cup: 240, ml: 1, serving: 330 },
  },
];

const NORMALIZED_ALIASES = [];
for (const entry of CATALOG) {
  for (const alias of entry.aliases) {
    NORMALIZED_ALIASES.push({ alias: normalizeName(alias), entry });
  }
}
// Longest alias first so "sweet potato" wins over "potato" and "brown rice"
// over "rice", regardless of catalog order.
NORMALIZED_ALIASES.sort((a, b) => b.alias.length - a.alias.length);

function normalizeName(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findCatalogEntry(foodName) {
  const query = normalizeName(foodName);
  if (!query) return null;

  // Exact alias first.
  for (const item of NORMALIZED_ALIASES) {
    if (query === item.alias) return item.entry;
  }
  // Then phrase containment for aliases long enough to be unambiguous.
  for (const item of NORMALIZED_ALIASES) {
    if (item.alias.length >= 4 && query.includes(item.alias)) return item.entry;
  }
  // Short aliases ("dal", "egg", "oil") must match a whole word.
  for (const item of NORMALIZED_ALIASES) {
    if (item.alias.length < 4) {
      const re = new RegExp(`(^|[^a-z0-9])${escapeRegex(item.alias)}([^a-z0-9]|$)`);
      if (re.test(query)) return item.entry;
    }
  }
  return null;
}

function heuristicCategory(foodName) {
  const q = normalizeName(foodName);
  if (/tea|coffee|juice|water|soda|cola|drink|shake|smoothie/.test(q)) return "Beverages";
  if (
    /sweet|dessert|cake|cookie|biscuit|chocolate|ice cream|halwa|laddu|gulab|jalebi|sugar|honey/.test(
      q
    )
  )
    return "Sweets & Sugars";
  if (/fried|samosa|pakora|bhajji|fries|chips/.test(q)) return "Prepared Food";
  if (
    /fruit|berry|melon|grape|mango|apple|orange|papaya|guava|pear|peach|plum|kiwi|pineapple/.test(q)
  )
    return "Fruit";
  if (
    /salad|vegetable|sabzi|sabji|greens|spinach|broccoli|cabbage|cauliflower|beans|bhindi|okra|brinjal|eggplant|gourd/.test(
      q
    )
  )
    return "Vegetables";
  if (/chicken|fish|mutton|beef|pork|egg|paneer|tofu|dal|lentil|chana|rajma|chole|soy/.test(q))
    return "Protein";
  if (/milk|curd|yogurt|cheese|cream|butter|ghee/.test(q)) return "Dairy";
  if (
    /rice|roti|chapati|bread|pasta|noodle|quinoa|millet|bajra|jowar|poha|upma|oats|cereal/.test(q)
  )
    return "Grains";
  return "General Food";
}

function heuristicFacts(foodName) {
  const category = heuristicCategory(foodName);
  switch (category) {
    case "Beverages":
      return f(45, 1, 8, 1.2, 0.2, 6, 30, 90, 40);
    case "Sweets & Sugars":
      return f(350, 4, 55, 13, 1, 40, 150, 130, 80, 5, 30);
    case "Prepared Food":
      return f(280, 8, 32, 13, 2.5, 4, 480, 220, 110, 4.5, 25);
    case "Fruit":
      return f(60, 0.8, 14, 0.3, 2.2, 10, 2, 250, 20);
    case "Vegetables":
      return f(55, 2.5, 8, 2, 3, 3, 200, 280, 60);
    case "Protein":
      return f(165, 15, 8, 8, 2, 1, 220, 250, 150, 2.5, 40);
    case "Dairy":
      return f(85, 5, 6, 4, 0, 5, 80, 160, 110, 2.5, 15);
    case "Grains":
      return f(160, 4.5, 30, 3, 2.5, 1.5, 280, 120, 70);
    case "Fats & Nuts":
      return f(550, 15, 20, 45, 6, 5, 200, 500, 300, 8, 0);
    default:
      return f(160, 6, 20, 6, 2, 5, 300, 250, 120, 2, 5);
  }
}

function round(value, digits = 2) {
  const p = 10 ** digits;
  return Math.round((Number(value) + Number.EPSILON) * p) / p;
}

function emptyNutrition() {
  const out = {};
  for (const key of NUTRIENT_KEYS) out[key] = 0;
  return out;
}

/** Multiply every nutrient by a factor (unit conversion or quantity). */
function scaleNutrition(nutrition, factor, digits = 2) {
  const out = emptyNutrition();
  const safeFactor = Number.isFinite(factor) && factor > 0 ? factor : 0;
  for (const key of NUTRIENT_KEYS) {
    const value = Number(nutrition?.[key]);
    out[key] = round((Number.isFinite(value) ? value : 0) * safeFactor, digits);
  }
  return out;
}

/**
 * Validate a client-supplied nutrition object. Returns null when the input is
 * not an object or contains an out-of-range value, so routes can answer 400.
 */
function sanitizeNutrition(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const out = emptyNutrition();
  let hasValue = false;
  for (const key of NUTRIENT_KEYS) {
    if (!(key in input)) continue;
    const value = Number(input[key]);
    if (!Number.isFinite(value) || value < 0 || value > 1_000_000) return null;
    out[key] = round(value, 2);
    hasValue = true;
  }
  return hasValue ? out : null;
}

/**
 * Nutrition for one recorded unit of a food.
 * @returns {{ nutritionPerUnit: object, category: string, gramsPerUnit: number, nutritionSource: "catalog"|"estimated" }}
 */
function estimateNutrition(foodName, unit) {
  const entry = findCatalogEntry(foodName);
  const per100g = entry ? entry.per100g : heuristicFacts(foodName);
  const category = entry ? entry.category : heuristicCategory(foodName);
  const gramsPerUnit = entry?.units?.[unit] ?? DEFAULT_UNIT_GRAMS[unit] ?? 100;

  return {
    nutritionPerUnit: scaleNutrition(per100g, gramsPerUnit / 100, 2),
    category,
    gramsPerUnit: round(gramsPerUnit, 2),
    nutritionSource: entry ? "catalog" : "estimated",
  };
}

/**
 * Daily totals from food-log items. Only `status === "eaten"` items count —
 * not-eaten items are counted separately and never contribute nutrients.
 */
function summarizeFoodLog(items) {
  const totals = emptyNutrition();
  let eatenCount = 0;
  let notEatenCount = 0;

  for (const item of Array.isArray(items) ? items : []) {
    if (!item || item.status !== "eaten") {
      notEatenCount += 1;
      continue;
    }
    eatenCount += 1;
    const scaled = scaleNutrition(item.nutritionPerUnit, item.quantity, 4);
    for (const key of NUTRIENT_KEYS) totals[key] += scaled[key];
  }

  for (const key of NUTRIENT_KEYS) totals[key] = round(totals[key], 1);
  return { totals, eatenCount, notEatenCount };
}

module.exports = {
  NUTRIENT_KEYS,
  UNITS,
  DEFAULT_UNIT_GRAMS,
  emptyNutrition,
  scaleNutrition,
  sanitizeNutrition,
  estimateNutrition,
  summarizeFoodLog,
  findCatalogEntry,
};
