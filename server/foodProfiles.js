/* NutriSafe — recipe / allergen / gluten profiles for the reference catalog.
 *
 * These profiles describe the *traditional or generic* preparation of a food,
 * not a specific brand, restaurant, or home recipe. They exist so the safety
 * engine can:
 *   - treat confirmed allergens as hard constraints,
 *   - distinguish "contains", "free", and "cannot establish" for gluten,
 *   - avoid inferring allergen safety from a food name alone.
 *
 * Keys are the stable food ids exported by server/safety-engine.js:
 *   entry.id when present, otherwise a slug of the primary catalog alias.
 *
 * Fields:
 *   ingredients       – representative ingredients shown as evidence
 *   gluten            – "contains" | "free" | "uncertain"
 *   allergens         – allergens confirmed in the representative recipe
 *   possibleAllergens – allergens that may be present depending on preparation
 *   allergensKnown    – false when ingredient composition is unavailable
 *   crossContact      – true when shared preparation/serving risk is material
 *   note              – short caveat for the explanation
 *
 * Canonical allergen tokens: dairy, wheat, peanut, tree_nut, soy, egg,
 * fish, shellfish, sesame.
 */

const FREE = Object.freeze([]);

const PROFILES = {
  banana: { ingredients: ["banana"], gluten: "free", allergens: FREE },
  apple: { ingredients: ["apple"], gluten: "free", allergens: FREE },
  orange: { ingredients: ["orange"], gluten: "free", allergens: FREE },
  mango: { ingredients: ["mango"], gluten: "free", allergens: FREE },
  grapes: { ingredients: ["grapes"], gluten: "free", allergens: FREE },
  watermelon: { ingredients: ["watermelon"], gluten: "free", allergens: FREE },
  papaya: { ingredients: ["papaya"], gluten: "free", allergens: FREE },
  guava: { ingredients: ["guava"], gluten: "free", allergens: FREE },
  pear: { ingredients: ["pear"], gluten: "free", allergens: FREE },
  pineapple: { ingredients: ["pineapple"], gluten: "free", allergens: FREE },
  pomegranate: { ingredients: ["pomegranate"], gluten: "free", allergens: FREE },
  strawberry: { ingredients: ["strawberries"], gluten: "free", allergens: FREE },

  "white-rice": { ingredients: ["rice", "water"], gluten: "free", allergens: FREE },
  "brown-rice": { ingredients: ["brown rice", "water"], gluten: "free", allergens: FREE },
  khichdi: {
    ingredients: ["rice", "lentils", "vegetables", "optional ghee"],
    gluten: "free",
    allergens: FREE,
    possibleAllergens: ["dairy"],
    crossContact: true,
  },
  roti: {
    ingredients: ["whole wheat flour", "water"],
    gluten: "contains",
    allergens: ["wheat"],
  },
  paratha: {
    ingredients: ["whole wheat flour", "oil or ghee"],
    gluten: "contains",
    allergens: ["wheat"],
    possibleAllergens: ["dairy"],
  },
  bread: {
    ingredients: ["wheat flour", "yeast", "salt"],
    gluten: "contains",
    allergens: ["wheat"],
  },
  oats: {
    ingredients: ["oats"],
    gluten: "uncertain",
    allergens: FREE,
    crossContact: true,
    note: "Oats are naturally gluten-free but are commonly milled on shared wheat lines; only certified gluten-free oats are verified.",
  },
  poha: {
    ingredients: ["flattened rice", "vegetables", "optional peanuts"],
    gluten: "free",
    allergens: FREE,
    possibleAllergens: ["peanut"],
    crossContact: true,
  },
  upma: {
    ingredients: ["semolina (rava)", "vegetables", "oil"],
    gluten: "contains",
    allergens: ["wheat"],
  },
  idli: { ingredients: ["rice", "lentils", "water"], gluten: "free", allergens: FREE },
  dosa: { ingredients: ["rice", "lentils", "oil"], gluten: "free", allergens: FREE },
  pasta: {
    ingredients: ["durum wheat semolina", "water"],
    gluten: "contains",
    allergens: ["wheat"],
  },
  quinoa: { ingredients: ["quinoa", "water"], gluten: "free", allergens: FREE },
  dal: {
    ingredients: ["lentils", "water", "spices", "optional ghee"],
    gluten: "free",
    allergens: FREE,
    possibleAllergens: ["dairy"],
    crossContact: true,
  },
  rajma: {
    ingredients: ["kidney beans", "tomato", "onion", "spices"],
    gluten: "free",
    allergens: FREE,
    crossContact: true,
  },
  chole: {
    ingredients: ["chickpeas", "tomato", "onion", "spices"],
    gluten: "free",
    allergens: FREE,
    crossContact: true,
  },
  paneer: { ingredients: ["milk"], gluten: "free", allergens: ["dairy"] },
  tofu: { ingredients: ["soybeans", "water"], gluten: "free", allergens: ["soy"] },
  egg: { ingredients: ["egg"], gluten: "free", allergens: ["egg"] },
  chicken: { ingredients: ["chicken"], gluten: "free", allergens: FREE },
  fish: { ingredients: ["fish"], gluten: "free", allergens: ["fish"] },
  mutton: { ingredients: ["mutton"], gluten: "free", allergens: FREE },
  beans: { ingredients: ["green beans", "spices"], gluten: "free", allergens: FREE },
  milk: { ingredients: ["milk"], gluten: "free", allergens: ["dairy"] },
  curd: { ingredients: ["milk", "live cultures"], gluten: "free", allergens: ["dairy"] },
  cheese: { ingredients: ["milk", "salt", "cultures"], gluten: "free", allergens: ["dairy"] },
  "peanut-butter": { ingredients: ["peanuts"], gluten: "free", allergens: ["peanut"] },
  butter: { ingredients: ["milk cream"], gluten: "free", allergens: ["dairy"] },
  ghee: { ingredients: ["milk fat"], gluten: "free", allergens: ["dairy"] },
  oil: { ingredients: ["cooking oil"], gluten: "free", allergens: FREE },
  almond: { ingredients: ["almonds"], gluten: "free", allergens: ["tree_nut"] },
  peanut: { ingredients: ["peanuts"], gluten: "free", allergens: ["peanut"] },

  "sweet-potato": { ingredients: ["sweet potato"], gluten: "free", allergens: FREE },
  potato: { ingredients: ["potato"], gluten: "free", allergens: FREE },
  spinach: { ingredients: ["spinach"], gluten: "free", allergens: FREE },
  broccoli: { ingredients: ["broccoli"], gluten: "free", allergens: FREE },
  tomato: { ingredients: ["tomato"], gluten: "free", allergens: FREE },
  cucumber: { ingredients: ["cucumber"], gluten: "free", allergens: FREE },
  carrot: { ingredients: ["carrot"], gluten: "free", allergens: FREE },
  "mixed-vegetables": {
    ingredients: ["mixed vegetables", "oil", "spices"],
    gluten: "free",
    allergens: FREE,
    possibleAllergens: ["dairy"],
    crossContact: true,
  },

  samosa: {
    ingredients: ["wheat flour pastry", "potato or vegetable filling", "oil"],
    gluten: "contains",
    allergens: ["wheat"],
    crossContact: true,
  },
  pakora: {
    ingredients: ["gram flour", "vegetables", "oil"],
    gluten: "uncertain",
    allergens: FREE,
    crossContact: true,
    note: "Gram flour is normally gluten-free, but frying oil and shared kitchens are a common cross-contact source.",
  },
  pizza: {
    ingredients: ["wheat crust", "cheese", "tomato sauce"],
    gluten: "contains",
    allergens: ["wheat", "dairy"],
    crossContact: true,
  },
  burger: {
    ingredients: ["wheat bun", "patty", "sauce", "optional cheese"],
    gluten: "contains",
    allergens: ["wheat"],
    possibleAllergens: ["dairy"],
    crossContact: true,
  },
  fries: {
    ingredients: ["potato", "frying oil"],
    gluten: "uncertain",
    allergens: FREE,
    crossContact: true,
    note: "Potato is gluten-free, but shared fryers commonly carry wheat batter or crumbs.",
  },
  biscuit: {
    ingredients: ["wheat flour", "sugar", "fat"],
    gluten: "contains",
    allergens: ["wheat"],
    possibleAllergens: ["dairy"],
    crossContact: true,
  },
  chocolate: {
    ingredients: ["cocoa", "sugar", "cocoa butter", "optional milk"],
    gluten: "uncertain",
    allergens: FREE,
    possibleAllergens: ["dairy", "tree_nut", "peanut"],
    crossContact: true,
  },
  cake: {
    ingredients: ["wheat flour", "sugar", "egg", "fat"],
    gluten: "contains",
    allergens: ["wheat", "egg"],
    possibleAllergens: ["dairy", "tree_nut"],
    crossContact: true,
  },
  "ice-cream": {
    ingredients: ["milk", "sugar", "cream"],
    gluten: "free",
    allergens: ["dairy"],
    possibleAllergens: ["tree_nut", "peanut"],
    crossContact: true,
  },

  sugar: { ingredients: ["sugar"], gluten: "free", allergens: FREE },
  honey: { ingredients: ["honey"], gluten: "free", allergens: FREE },

  "gulab-jamun": {
    ingredients: ["khoya (dairy)", "maida (wheat flour)", "sugar syrup", "ghee"],
    gluten: "contains",
    allergens: ["dairy", "wheat"],
    note: "Traditional gulab jamun uses khoya and maida and is soaked in sugar syrup; recipes differ, but wheat and dairy are standard.",
  },
  jalebi: {
    ingredients: ["maida (wheat flour)", "sugar syrup", "ghee or oil"],
    gluten: "contains",
    allergens: ["wheat"],
    possibleAllergens: ["dairy"],
    crossContact: true,
  },
  laddu: {
    ingredients: ["gram flour or semolina", "sugar", "ghee", "optional nuts"],
    gluten: "uncertain",
    allergens: ["dairy"],
    possibleAllergens: ["wheat", "tree_nut", "peanut"],
    crossContact: true,
    note: "Laddu recipes vary: besan laddus are normally gluten-free, while semolina/rava laddus contain wheat. Nuts are common.",
  },
  kheer: {
    ingredients: ["rice", "milk", "sugar", "optional nuts"],
    gluten: "free",
    allergens: ["dairy"],
    possibleAllergens: ["tree_nut"],
    crossContact: true,
  },
  halwa: {
    ingredients: ["semolina or vegetables", "sugar", "ghee", "optional nuts"],
    gluten: "uncertain",
    allergens: ["dairy"],
    possibleAllergens: ["wheat", "tree_nut"],
    crossContact: true,
    note: "Sooji/rava halwa contains wheat; gajar halwa normally does not. The reference data cannot distinguish the recipe.",
  },
  "sweet-generic": {
    ingredients: ["sugar", "flour or dairy base", "fat"],
    gluten: "uncertain",
    allergens: FREE,
    possibleAllergens: ["dairy", "wheat", "tree_nut", "peanut"],
    crossContact: true,
    note: "The specific sweet is not identified; flour, dairy, and nuts are common.",
  },

  tea: {
    ingredients: ["tea", "water", "optional milk", "sugar"],
    gluten: "free",
    allergens: FREE,
    possibleAllergens: ["dairy"],
    crossContact: true,
  },
  coffee: {
    ingredients: ["coffee", "water", "optional milk"],
    gluten: "free",
    allergens: FREE,
    possibleAllergens: ["dairy"],
    crossContact: true,
  },
  "orange-juice": { ingredients: ["oranges"], gluten: "free", allergens: FREE },
  "coconut-water": { ingredients: ["coconut water"], gluten: "free", allergens: FREE },
  soda: {
    ingredients: ["carbonated water", "sugar", "flavourings"],
    gluten: "free",
    allergens: FREE,
  },
};

/** Unknown foods deliberately carry no inferred allergen or gluten claims. */
const UNKNOWN_PROFILE = Object.freeze({
  ingredients: [],
  gluten: "uncertain",
  allergens: FREE,
  possibleAllergens: FREE,
  allergensKnown: false,
  crossContact: true,
  note: "No ingredient profile is available for this food.",
});

function getFoodProfile(foodId) {
  const profile = PROFILES[foodId];
  if (!profile) return { ...UNKNOWN_PROFILE };
  return {
    ingredients: profile.ingredients ?? [],
    gluten: profile.gluten ?? "uncertain",
    allergens: profile.allergens ?? FREE,
    possibleAllergens: profile.possibleAllergens ?? FREE,
    allergensKnown: profile.allergensKnown !== false,
    crossContact: profile.crossContact === true,
    note: profile.note ?? "",
  };
}

module.exports = {
  PROFILES,
  UNKNOWN_PROFILE,
  getFoodProfile,
};
