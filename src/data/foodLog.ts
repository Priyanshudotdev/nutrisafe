// ─── Food Log — domain types, calculations & date helpers ───────────────────
//
// The food log keeps planned food and actually eaten food in one list,
// separated by `status`. Only items with status "eaten" contribute to the
// daily totals. Each item stores nutrition for ONE recorded unit, so
// `nutritionPerUnit × quantity` is always the effective consumed value.

export type ConsumptionStatus = "eaten" | "not_eaten";

export type FoodUnit = "g" | "ml" | "serving" | "piece" | "cup" | "bowl" | "slice" | "tbsp" | "tsp";

export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

export interface NutritionFacts {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  potassium: number;
  phosphorus: number;
  saturatedFat: number;
  cholesterol: number;
}

export type NutritionSource = "catalog" | "estimated" | "manual";

export interface FoodLogItem {
  id: string;
  /** Local calendar day, YYYY-MM-DD. */
  date: string;
  meal: MealSlot;
  foodName: string;
  category: string;
  quantity: number;
  unit: FoodUnit;
  status: ConsumptionStatus;
  /** Nutrition for one unit (quantity = 1), scaled by `quantity` for totals. */
  nutritionPerUnit: NutritionFacts;
  nutritionSource?: NutritionSource;
  createdAt: string;
  updatedAt: string;
}

export interface DailyNutritionSummary {
  totals: NutritionFacts;
  eatenCount: number;
  notEatenCount: number;
}

/** A day with at least one log entry, used for history navigation. */
export interface FoodLogDayMarker {
  date: string;
  calories: number;
  eatenCount: number;
  itemCount: number;
}

export interface FoodLogDay {
  date: string;
  items: FoodLogItem[];
  summary: DailyNutritionSummary;
  days: FoodLogDayMarker[];
}

export interface CreateFoodLogInput {
  date: string;
  meal: MealSlot;
  foodName: string;
  quantity: number;
  unit: FoodUnit;
  status: ConsumptionStatus;
}

export interface UpdateFoodLogInput {
  date?: string;
  meal?: MealSlot;
  foodName?: string;
  quantity?: number;
  unit?: FoodUnit;
  status?: ConsumptionStatus;
}

export const FOOD_UNITS: { id: FoodUnit; label: string }[] = [
  { id: "g", label: "g" },
  { id: "ml", label: "ml" },
  { id: "serving", label: "serving" },
  { id: "piece", label: "piece" },
  { id: "cup", label: "cup" },
  { id: "bowl", label: "bowl" },
  { id: "slice", label: "slice" },
  { id: "tbsp", label: "tbsp" },
  { id: "tsp", label: "tsp" },
];

export const MEAL_SLOTS: { id: MealSlot; label: string }[] = [
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch", label: "Lunch" },
  { id: "snack", label: "Snack" },
  { id: "dinner", label: "Dinner" },
];

const MEAL_ORDER: Record<MealSlot, number> = {
  breakfast: 0,
  lunch: 1,
  snack: 2,
  dinner: 3,
};

export const NUTRIENT_KEYS: (keyof NutritionFacts)[] = [
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

export function emptyNutrition(): NutritionFacts {
  return {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    sugar: 0,
    sodium: 0,
    potassium: 0,
    phosphorus: 0,
    saturatedFat: 0,
    cholesterol: 0,
  };
}

function round(value: number, digits = 2): number {
  const p = 10 ** digits;
  return Math.round((value + Number.EPSILON) * p) / p;
}

/** Multiply every nutrient by a factor (quantity or unit conversion). */
export function scaleNutrition(nutrition: NutritionFacts, factor: number): NutritionFacts {
  const safeFactor = Number.isFinite(factor) && factor > 0 ? factor : 0;
  const out = emptyNutrition();
  for (const key of NUTRIENT_KEYS) {
    out[key] = round((nutrition[key] ?? 0) * safeFactor, 2);
  }
  return out;
}

/**
 * Daily totals that include ONLY eaten items. Mirrors the server calculation
 * so optimistic status toggles update the dashboard instantly.
 */
export function summarizeFoodItems(items: FoodLogItem[]): DailyNutritionSummary {
  const totals = emptyNutrition();
  let eatenCount = 0;
  let notEatenCount = 0;

  for (const item of items) {
    if (item.status !== "eaten") {
      notEatenCount += 1;
      continue;
    }
    eatenCount += 1;
    const scaled = scaleNutrition(item.nutritionPerUnit, item.quantity);
    for (const key of NUTRIENT_KEYS) totals[key] += scaled[key];
  }

  for (const key of NUTRIENT_KEYS) totals[key] = round(totals[key], 1);
  return { totals, eatenCount, notEatenCount };
}

export function sortFoodLogItems(items: FoodLogItem[]): FoodLogItem[] {
  return [...items].sort(
    (a, b) =>
      MEAL_ORDER[a.meal] - MEAL_ORDER[b.meal] ||
      String(a.createdAt).localeCompare(String(b.createdAt))
  );
}

export interface MealGroup {
  meal: MealSlot;
  label: string;
  items: FoodLogItem[];
}

/** Group items into meal sections in breakfast → dinner order. */
export function groupItemsByMeal(items: FoodLogItem[]): MealGroup[] {
  return MEAL_SLOTS.map((slot) => ({
    meal: slot.id,
    label: slot.label,
    items: sortFoodLogItems(items.filter((item) => item.meal === slot.id)),
  })).filter((group) => group.items.length > 0);
}

export function mealLabel(meal: MealSlot): string {
  return MEAL_SLOTS.find((slot) => slot.id === meal)?.label ?? meal;
}

/** Format a number without trailing zeros (e.g. 100, 12.5, 0.4). */
export function formatNumber(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "0";
  const rounded = round(value, digits);
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(digits).replace(/0+$/, "").replace(/\.$/, "");
}

export function formatQuantity(quantity: number): string {
  return formatNumber(quantity, 2);
}

export function quantityLabel(quantity: number, unit: FoodUnit): string {
  return `${formatQuantity(quantity)} ${unit}`;
}

export function formatCalories(calories: number): string {
  return String(Math.round(Number.isFinite(calories) ? calories : 0));
}

/** Format a nutrient for display: g keeps one decimal, mg rounds to a whole. */
export function formatNutrient(value: number, unit: "g" | "mg" | "kcal"): string {
  if (!Number.isFinite(value)) return `0 ${unit}`;
  if (unit === "kcal") return `${formatCalories(value)} kcal`;
  if (unit === "mg") return `${Math.round(value)} mg`;
  return `${formatNumber(value, 1)} g`;
}

// ─── Local calendar helpers (never UTC — a log day is the user's day) ────────

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function todayDateKey(): string {
  return toDateKey(new Date());
}

export function shiftDateKey(key: string, days: number): string {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

export function isTodayDate(key: string): boolean {
  return key === todayDateKey();
}

export function isFutureDate(key: string): boolean {
  return key > todayDateKey();
}

export function formatDateLabel(key: string): string {
  const today = todayDateKey();
  if (key === today) return "Today";
  if (key === shiftDateKey(today, -1)) return "Yesterday";
  return parseDateKey(key).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatLongDate(key: string): string {
  const date = parseDateKey(key);
  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    month: "long",
    day: "numeric",
  };
  if (date.getFullYear() !== new Date().getFullYear()) {
    options.year = "numeric";
  }
  return date.toLocaleDateString("en-US", options);
}

export function defaultMealForNow(): MealSlot {
  const hour = new Date().getHours();
  if (hour < 11) return "breakfast";
  if (hour < 16) return "lunch";
  if (hour < 19) return "snack";
  return "dinner";
}
