/* NutriSafe — deterministic food-safety engine.
 *
 * This module is the single source of truth for safety verdicts. It is pure
 * (no network, no AI, no database) so the API server and the mobile client can
 * run exactly the same logic.
 *
 * Design rules:
 *   - A verdict is derived only from reference nutrient values, recipe/
 *     allergen/gluten profiles, and documented project rules.
 *   - Missing or conflicting evidence produces "unable_to_verify", never
 *     "safe".
 *   - AI never supplies a status, nutrient value, or explanation here.
 *   - Explanations quote the actual value, unit, serving basis, and rule id.
 *
 * Reference values are representative composition compiled from IFCT 2017 /
 * USDA FoodData Central style sources; they are not a laboratory analysis of a
 * specific brand or home recipe. The engine says so in every explanation.
 */

const nutrition = require("./nutrition");
const { getFoodProfile } = require("./foodProfiles");

const RULE_VERSION = "2026.10.1";

const STATUS = Object.freeze({
  SAFE: "safe",
  MODERATION: "moderation",
  NOT_RECOMMENDED: "not_recommended",
  UNABLE: "unable_to_verify",
});

const STATUS_PRECEDENCE = Object.freeze({
  safe: 0,
  moderation: 1,
  unable_to_verify: 2,
  not_recommended: 3,
});

const STATUS_HEADLINES = Object.freeze({
  safe: "Safe to Consume",
  moderation: "Consume in Moderation",
  not_recommended: "Not Recommended",
  unable_to_verify: "Unable to Verify",
});

const CONDITION_LABELS = Object.freeze({
  diabetes: "Diabetes",
  hypertension: "Heart / BP",
  ckd: "CKD",
  celiac: "Celiac",
  allergy: "Allergy",
});

const VALID_CONDITIONS = Object.freeze(Object.keys(CONDITION_LABELS));

const DEFAULT_CITATION = "IFCT 2017 / USDA FoodData Central reference composition";
const REFERENCE_UNCERTAINTY =
  "Representative reference values, not a laboratory analysis of this specific brand, restaurant, or home recipe.";

const SPECIAL_CITATIONS = Object.freeze({
  "gulab-jamun":
    "IFCT 2017 / USDA FoodData Central reference composition for traditional khoya-maida gulab jamun in sugar syrup",
  jalebi: "IFCT 2017 / USDA FoodData Central reference composition for traditional maida jalebi",
  laddu: "IFCT 2017 / USDA FoodData Central reference composition for traditional besan/rava laddu",
  kheer: "IFCT 2017 / USDA FoodData Central reference composition for rice kheer",
  halwa: "IFCT 2017 / USDA FoodData Central reference composition for semolina halwa",
});

/* ─── Documented project rules ────────────────────────────────────────────────
 * These are project policy thresholds, not universal clinical guidelines.
 * Each rule records its rationale and the clinical review it still needs.
 * Values are per reference serving.
 */
const RULES = Object.freeze({
  diabetes: [
    {
      id: "diabetes.sugar.per_serving",
      nutrient: "sugar",
      label: "Sugar",
      unit: "g",
      moderateAt: 10,
      blockAt: 25,
      rationale:
        "A single serving with 25 g or more total sugar is treated as a high sugar load for diabetes; 10 g or more warrants moderation. The reference data reports total sugar, not added sugar.",
      review: "Confirm per-meal sugar ceilings with a diabetes dietitian.",
    },
    {
      id: "diabetes.carbs.per_serving",
      nutrient: "carbs",
      label: "Carbohydrate",
      unit: "g",
      moderateAt: 30,
      blockAt: 60,
      rationale:
        "A serving with 60 g or more carbohydrate is treated as a high carbohydrate load for diabetes; 30 g or more warrants moderation.",
      review: "Confirm carbohydrate ceilings against the patient's insulin/carb ratio plan.",
    },
  ],
  hypertension: [
    {
      id: "hypertension.sodium.per_serving",
      nutrient: "sodium",
      label: "Sodium",
      unit: "mg",
      moderateAt: 200,
      blockAt: 600,
      rationale:
        "A serving with 600 mg or more sodium is treated as a high sodium load for hypertension/heart disease; 200 mg or more warrants moderation.",
      review: "Confirm against the patient's individual blood-pressure and fluid goals.",
    },
    {
      id: "hypertension.saturated_fat.per_serving",
      nutrient: "saturatedFat",
      label: "Saturated fat",
      unit: "g",
      moderateAt: 5,
      blockAt: 10,
      rationale:
        "A serving with 10 g or more saturated fat is treated as a high saturated-fat load; 5 g or more warrants moderation.",
      review: "Confirm against the patient's lipid targets and overall diet.",
    },
  ],
  ckd: [
    {
      id: "ckd.potassium.per_serving",
      nutrient: "potassium",
      label: "Potassium",
      unit: "mg",
      moderateAt: 350,
      blockAt: 700,
      rationale:
        "A serving with 700 mg or more potassium is treated as a high potassium load in CKD; 350 mg or more warrants moderation.",
      review: "Confirm against the patient's stage, labs, and prescribed potassium limit.",
    },
    {
      id: "ckd.phosphorus.per_serving",
      nutrient: "phosphorus",
      label: "Phosphorus",
      unit: "mg",
      moderateAt: 150,
      blockAt: 300,
      rationale:
        "A serving with 300 mg or more phosphorus is treated as a high phosphorus load in CKD; 150 mg or more warrants moderation.",
      review: "Confirm against the patient's phosphate targets and binder plan.",
    },
    {
      id: "ckd.sodium.per_serving",
      nutrient: "sodium",
      label: "Sodium",
      unit: "mg",
      moderateAt: 200,
      blockAt: 600,
      rationale:
        "A serving with 600 mg or more sodium is treated as a high sodium load in CKD; 200 mg or more warrants moderation.",
      review: "Confirm against the patient's fluid and blood-pressure goals.",
    },
    {
      id: "ckd.protein.per_serving",
      nutrient: "protein",
      label: "Protein",
      unit: "g",
      moderateAt: 20,
      blockAt: 35,
      rationale:
        "A serving with 35 g or more protein is treated as a high single-serving protein load in CKD; 20 g or more warrants moderation. Protein targets vary widely by stage and dialysis status.",
      review:
        "Confirm the patient's prescribed protein target with their nephrologist or renal dietitian before relying on this threshold.",
    },
  ],
});

const GLUTEN_LABELS = Object.freeze({
  contains: "Contains gluten",
  free: "No gluten in the reference recipe",
  uncertain: "Gluten status could not be established",
});

const ALLERGEN_SYNONYMS = Object.freeze({
  dairy: [
    "dairy",
    "milk",
    "lactose",
    "cheese",
    "curd",
    "yogurt",
    "ghee",
    "butter",
    "paneer",
    "cream",
  ],
  wheat: ["wheat", "gluten", "maida", "flour", "atta", "semolina", "rava", "suji"],
  peanut: ["peanut", "peanuts", "groundnut", "moongphali"],
  tree_nut: [
    "tree nut",
    "tree nuts",
    "nut",
    "nuts",
    "almond",
    "almonds",
    "cashew",
    "cashews",
    "walnut",
    "walnuts",
    "pistachio",
    "pistachios",
    "hazelnut",
  ],
  soy: ["soy", "soya", "soybean", "soybeans", "tofu"],
  egg: ["egg", "eggs", "anda"],
  fish: ["fish", "finfish", "salmon", "tuna", "cod"],
  shellfish: ["shellfish", "shrimp", "prawn", "prawns", "crab", "lobster", "clam", "mussel"],
  sesame: ["sesame", "til", "tahini"],
});

// ─── Small helpers ───────────────────────────────────────────────────────────

function round(value, digits = 2) {
  const p = 10 ** digits;
  return Math.round((Number(value) + Number.EPSILON) * p) / p;
}

function slug(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function titleCase(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

function maxStatus(statuses) {
  return statuses.reduce(
    (worst, s) => (STATUS_PRECEDENCE[s] > STATUS_PRECEDENCE[worst] ? s : worst),
    STATUS.SAFE
  );
}

function isFiniteNonNegative(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function formatNumber(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return String(value ?? "");
  return Number.isInteger(value) ? String(value) : String(round(value, 1));
}

// ─── Catalog matching ────────────────────────────────────────────────────────

const ALIAS_INDEX = [];
for (const entry of nutrition.CATALOG) {
  for (const alias of entry.aliases) {
    ALIAS_INDEX.push({
      alias: nutrition.normalizeName(alias),
      display: alias,
      entry,
    });
  }
}
ALIAS_INDEX.sort((a, b) => b.alias.length - a.alias.length);

function findFoodMatch(foodName) {
  const query = nutrition.normalizeName(foodName);
  if (!query) return null;

  for (const item of ALIAS_INDEX) {
    if (query === item.alias) return { ...item, matchType: "exact" };
  }
  for (const item of ALIAS_INDEX) {
    if (item.alias.length >= 4 && query.includes(item.alias)) {
      return { ...item, matchType: "contains" };
    }
  }
  for (const item of ALIAS_INDEX) {
    if (item.alias.length < 4) {
      const escaped = item.alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(query)) {
        return { ...item, matchType: "word" };
      }
    }
  }
  return null;
}

function foodIdFor(entry) {
  return entry.id || slug(entry.aliases[0]);
}

// ─── Reference construction ──────────────────────────────────────────────────

function pickServingUnit(entry) {
  const units = entry.units || {};
  if (isFiniteNonNegative(units.serving)) return { unit: "serving", grams: units.serving };
  if (isFiniteNonNegative(units.piece)) return { unit: "piece", grams: units.piece };
  if (isFiniteNonNegative(units.bowl)) return { unit: "bowl", grams: units.bowl };
  if (isFiniteNonNegative(units.cup)) return { unit: "cup", grams: units.cup };
  return { unit: "g", grams: 100 };
}

function buildReference(match) {
  const { entry, display, matchType } = match;
  const foodId = foodIdFor(entry);
  const serving = pickServingUnit(entry);
  const servingLabel =
    serving.unit === "g" ? `${serving.grams} g` : `1 ${serving.unit} (${serving.grams} g)`;
  const profile = getFoodProfile(foodId);
  const source = {
    dataset: SPECIAL_CITATIONS[foodId] || DEFAULT_CITATION,
    type: "reference",
    verified: false,
    uncertainty: REFERENCE_UNCERTAINTY,
  };

  return {
    foodId,
    canonicalName: titleCase(display),
    category: entry.category || "General Food",
    matchedAlias: display,
    matchType,
    serving: { unit: serving.unit, grams: round(serving.grams, 2), label: servingLabel },
    per100g: entry.per100g,
    units: entry.units || {},
    profile,
    ingredients: profile.ingredients,
    source,
  };
}

function resolveFoodReference(foodName) {
  const match = findFoodMatch(foodName);
  return match ? buildReference(match) : null;
}

/** Per-serving value, or null when the reference value is missing/invalid. */
function valuePerServing(reference, nutrient) {
  const per100 = reference.per100g?.[nutrient];
  if (!isFiniteNonNegative(per100)) return null;
  return round((per100 * reference.serving.grams) / 100, 2);
}

// ─── Evidence helpers ────────────────────────────────────────────────────────

function makeEvidence({
  condition,
  nutrient,
  label,
  value,
  unit,
  reference,
  ruleId,
  ruleVersion = RULE_VERSION,
  threshold,
  status,
  source,
  note,
}) {
  return {
    condition,
    nutrient,
    label,
    value,
    unit,
    servingLabel: reference?.serving?.label ?? "",
    ruleId,
    ruleVersion,
    threshold: threshold ?? "",
    status,
    source: source ?? reference?.source?.dataset ?? "",
    note: note ?? "",
  };
}

function applyNutrientRule(reference, condition, rule) {
  const value = valuePerServing(reference, rule.nutrient);
  if (value === null) {
    return {
      status: STATUS.UNABLE,
      evidence: null,
      missing: `${rule.label} could not be verified for the reference serving.`,
    };
  }
  const status =
    value >= rule.blockAt
      ? STATUS.NOT_RECOMMENDED
      : value >= rule.moderateAt
        ? STATUS.MODERATION
        : STATUS.SAFE;
  return {
    status,
    evidence: makeEvidence({
      condition,
      nutrient: rule.nutrient,
      label: rule.label,
      value,
      unit: rule.unit,
      reference,
      ruleId: rule.id,
      threshold: `moderation ≥ ${rule.moderateAt} ${rule.unit}; not recommended ≥ ${rule.blockAt} ${rule.unit}`,
      status,
    }),
    missing: null,
  };
}

/**
 * Combine nutrient checks for one condition. A missing value cannot be read as
 * zero: unless another present value already blocks the food, the condition is
 * "unable to verify".
 */
function combineChecks(condition, checks) {
  const present = checks.filter((c) => c.evidence);
  const missing = checks.filter((c) => c.missing).map((c) => c.missing);
  const evidence = present.map((c) => c.evidence);

  if (present.length === 0) {
    return { condition, status: STATUS.UNABLE, evidence, missing, summary: "" };
  }

  const worstPresent = maxStatus(present.map((c) => c.status));
  if (missing.length > 0 && worstPresent !== STATUS.NOT_RECOMMENDED) {
    return { condition, status: STATUS.UNABLE, evidence, missing, summary: "" };
  }
  return { condition, status: worstPresent, evidence, missing, summary: "" };
}

// ─── Patient allergen handling ───────────────────────────────────────────────

function canonicalAllergenTokens(allergensList) {
  const tokens = new Set();
  const unknown = new Set();
  const list = Array.isArray(allergensList) ? allergensList : [];

  for (const raw of list) {
    if (typeof raw !== "string") continue;
    const normalized = nutrition.normalizeName(raw);
    if (!normalized) continue;
    let matched = false;
    for (const [token, synonyms] of Object.entries(ALLERGEN_SYNONYMS)) {
      if (
        synonyms.some(
          (syn) =>
            normalized === nutrition.normalizeName(syn) ||
            normalized.includes(nutrition.normalizeName(syn))
        )
      ) {
        tokens.add(token);
        matched = true;
      }
    }
    if (!matched) unknown.add(normalized);
  }

  return { known: [...tokens], unknown: [...unknown] };
}

// ─── Condition evaluation ────────────────────────────────────────────────────

function evaluateDiabetes(reference, conflicts) {
  const checks = RULES.diabetes.map((rule) => {
    if (conflicts.has(rule.nutrient)) {
      return {
        status: STATUS.UNABLE,
        evidence: null,
        missing: `Conflicting reference records for ${rule.label.toLowerCase()}.`,
      };
    }
    return applyNutrientRule(reference, "diabetes", rule);
  });
  return combineChecks("diabetes", checks);
}

function evaluateHypertension(reference, conflicts) {
  const checks = RULES.hypertension.map((rule) => {
    if (conflicts.has(rule.nutrient)) {
      return {
        status: STATUS.UNABLE,
        evidence: null,
        missing: `Conflicting reference records for ${rule.label.toLowerCase()}.`,
      };
    }
    return applyNutrientRule(reference, "hypertension", rule);
  });
  return combineChecks("hypertension", checks);
}

function evaluateCkd(reference, conflicts) {
  const checks = RULES.ckd.map((rule) => {
    if (conflicts.has(rule.nutrient)) {
      return {
        status: STATUS.UNABLE,
        evidence: null,
        missing: `Conflicting reference records for ${rule.label.toLowerCase()}.`,
      };
    }
    return applyNutrientRule(reference, "ckd", rule);
  });
  return combineChecks("ckd", checks);
}

function evaluateCeliac(reference) {
  const gluten = reference.profile?.gluten;
  if (gluten === "contains") {
    const evidence = makeEvidence({
      condition: "celiac",
      nutrient: "gluten",
      label: "Gluten",
      value: "Contains",
      unit: "",
      reference,
      ruleId: "celiac.gluten.contains",
      threshold: "Any confirmed gluten-containing ingredient is a hard restriction.",
      status: STATUS.NOT_RECOMMENDED,
      note: (reference.profile?.ingredients || []).join(", "),
    });
    return {
      condition: "celiac",
      status: STATUS.NOT_RECOMMENDED,
      evidence: [evidence],
      missing: [],
    };
  }
  if (gluten === "free") {
    const evidence = makeEvidence({
      condition: "celiac",
      nutrient: "gluten",
      label: "Gluten",
      value: "None in reference recipe",
      unit: "",
      reference,
      ruleId: "celiac.gluten.free",
      threshold: "No gluten-containing ingredient in the reference recipe.",
      status: STATUS.SAFE,
      note: (reference.profile?.ingredients || []).join(", "),
    });
    return { condition: "celiac", status: STATUS.SAFE, evidence: [evidence], missing: [] };
  }
  return {
    condition: "celiac",
    status: STATUS.UNABLE,
    evidence: [],
    missing: [
      "Gluten status could not be established from the reference recipe; cross-contact or recipe variation cannot be excluded.",
    ],
  };
}

function evaluateAllergy(reference, patient) {
  const profile = reference.profile || {};
  if (profile.allergensKnown === false) {
    return {
      condition: "allergy",
      status: STATUS.UNABLE,
      evidence: [],
      missing: ["No ingredient or allergen profile is available for this food."],
    };
  }

  const { known: patientAllergens, unknown: unknownAllergens } = canonicalAllergenTokens(
    patient?.allergensList
  );
  if (patientAllergens.length === 0 && unknownAllergens.length === 0) {
    return {
      condition: "allergy",
      status: STATUS.UNABLE,
      evidence: [],
      missing: [
        "No allergens are listed on the profile, so an allergen screen cannot be completed.",
      ],
    };
  }

  const confirmed = new Set(profile.allergens || []);
  const possible = new Set(profile.possibleAllergens || []);

  const hardMatches = patientAllergens.filter((a) => confirmed.has(a));
  if (hardMatches.length > 0) {
    const evidence = hardMatches.map((allergen) =>
      makeEvidence({
        condition: "allergy",
        nutrient: "allergen",
        label: `Allergen: ${allergen.replace("_", " ")}`,
        value: "Contains",
        unit: "",
        reference,
        ruleId: "allergy.confirmed_allergen",
        threshold: "Confirmed allergen in the reference recipe is a hard restriction.",
        status: STATUS.NOT_RECOMMENDED,
        note: (reference.profile?.ingredients || []).join(", "),
      })
    );
    return { condition: "allergy", status: STATUS.NOT_RECOMMENDED, evidence, missing: [] };
  }

  const uncertainMatches = [
    ...patientAllergens.filter((a) => possible.has(a)),
    ...unknownAllergens,
  ];
  if (uncertainMatches.length > 0) {
    return {
      condition: "allergy",
      status: STATUS.UNABLE,
      evidence: [],
      missing: [
        `The recipe may contain ${uncertainMatches.join(", ")}, or there is no allergen data for this food, so it cannot be confirmed allergen-safe.`,
      ],
    };
  }

  if (profile.crossContact) {
    const evidence = makeEvidence({
      condition: "allergy",
      nutrient: "allergen",
      label: "Allergen cross-contact",
      value: "Possible",
      unit: "",
      reference,
      ruleId: "allergy.cross_contact",
      threshold: "No confirmed allergen match, but shared preparation is a material risk.",
      status: STATUS.MODERATION,
    });
    return { condition: "allergy", status: STATUS.MODERATION, evidence: [evidence], missing: [] };
  }

  const evidence = makeEvidence({
    condition: "allergy",
    nutrient: "allergen",
    label: "Allergen match",
    value: "No confirmed match",
    unit: "",
    reference,
    ruleId: "allergy.no_confirmed_match",
    threshold: "No profile allergen matches the patient's listed allergens.",
    status: STATUS.SAFE,
  });
  return { condition: "allergy", status: STATUS.SAFE, evidence: [evidence], missing: [] };
}

// ─── Evidence-aware wording ──────────────────────────────────────────────────

function evidenceSentence(item) {
  if (!item) return "";
  if (item.nutrient === "gluten") {
    return `${item.label}: ${item.value}.`;
  }
  if (item.nutrient === "allergen") {
    return `${item.label}: ${item.value}.`;
  }
  return `${item.label}: ${formatNumber(item.value)} ${item.unit} per ${item.servingLabel}.`;
}

function buildConditionSummary(outcome) {
  const label = CONDITION_LABELS[outcome.condition] || outcome.condition;
  const prefix = `${label}: `;

  if (outcome.status === STATUS.NOT_RECOMMENDED) {
    const blocking = outcome.evidence.filter((e) => e.status === STATUS.NOT_RECOMMENDED);
    const detail = blocking.map(evidenceSentence).join(" ");
    return `${prefix}${detail} This exceeds the project's documented limit (${blocking[0]?.ruleId || "hard restriction"}).`;
  }
  if (outcome.status === STATUS.MODERATION) {
    const concerning = outcome.evidence.filter((e) => e.status !== STATUS.SAFE);
    return `${prefix}${concerning.map(evidenceSentence).join(" ")} This warrants moderation under the documented rule.`;
  }
  if (outcome.status === STATUS.UNABLE) {
    const reason = outcome.missing[0] || "Required evidence is unavailable.";
    return `${prefix}${reason}`;
  }
  const detail = outcome.evidence.map(evidenceSentence).join(" ");
  return `${prefix}${detail} No applicable rule was triggered.`;
}

/**
 * Join labels for a short sentence: "CKD", "CKD and Diabetes",
 * "CKD, Diabetes and Celiac".
 */
function joinLabels(labels) {
  const list = labels.filter(Boolean);
  if (list.length === 0) return "your conditions";
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
}

/** One short evidence phrase, e.g. "45 g sugar per 1 serving (100 g)". */
function shortEvidencePhrase(item) {
  if (!item) return "";
  if (item.nutrient === "gluten") {
    return item.value === "Contains"
      ? "it contains gluten"
      : "gluten was not found in the reference recipe";
  }
  if (item.nutrient === "allergen") {
    if (item.value === "Contains") {
      return `it contains ${String(item.label).replace(/^Allergen:\s*/i, "")}`;
    }
    if (String(item.value).toLowerCase() === "possible") return "cross-contact is possible";
    return "no listed allergen matched";
  }
  return `${formatNumber(item.value)} ${item.unit} ${String(item.label).toLowerCase()} per ${item.servingLabel}`;
}

/**
 * Build the 1–2 line verdict shown on the result card. Full reasoning,
 * per-nutrient evidence and caveats stay in detailedWhy/evidence/condition
 * outcomes — the summary must stay short enough to read at a glance.
 */
function buildShortSummary({ name, status, outcomes, servingLabel }) {
  const food = titleCase(name);
  const labels = outcomes.map((o) => CONDITION_LABELS[o.condition]);

  if (status === STATUS.NOT_RECOMMENDED) {
    const blocking = outcomes.filter((o) => o.status === STATUS.NOT_RECOMMENDED);
    const item = blocking
      .flatMap((o) => o.evidence)
      .find((e) => e.status === STATUS.NOT_RECOMMENDED);
    const detail = shortEvidencePhrase(item);
    const blockedFor = joinLabels(blocking.map((o) => CONDITION_LABELS[o.condition]));
    return `${food} is not recommended for ${blockedFor}${detail ? `: ${detail}` : ""}.`;
  }

  if (status === STATUS.MODERATION) {
    const caution = outcomes.find((o) => o.status === STATUS.MODERATION);
    const item = caution?.evidence.find((e) => e.status === STATUS.MODERATION);
    const detail = shortEvidencePhrase(item);
    return `${food} is best limited for ${joinLabels(labels)}${detail ? `: ${detail}` : ""}.`;
  }

  if (status === STATUS.UNABLE) {
    return `We can't verify ${food} for ${joinLabels(labels)} from the available evidence.`;
  }

  return `${food} did not trigger a safety rule for ${joinLabels(labels)}${
    servingLabel ? ` at ${servingLabel}` : ""
  }.`;
}

function buildRuleWhy(outcome) {
  const lines = [];
  for (const item of outcome.evidence) {
    if (item.status === STATUS.SAFE) continue;
    lines.push(
      `${item.label} ${formatNumber(item.value)} ${item.unit} per ${item.servingLabel} — rule ${item.ruleId} (${item.threshold}).`
    );
  }
  for (const gap of outcome.missing) lines.push(gap);
  return lines.join(" ");
}

function factorLevelFor(item) {
  if (item.nutrient === "gluten" || item.nutrient === "allergen") {
    if (item.status === STATUS.NOT_RECOMMENDED) return "Contains";
    if (item.status === STATUS.UNABLE) return "Unknown";
    if (item.status === STATUS.SAFE) return "None";
    return "Moderate";
  }
  if (item.status === STATUS.NOT_RECOMMENDED) return "High";
  if (item.status === STATUS.MODERATION) return "Moderate";
  if (item.status === STATUS.UNABLE) return "Unknown";
  return "Low";
}

function factorImpactFor(status) {
  if (status === STATUS.NOT_RECOMMENDED) return "danger";
  if (status === STATUS.MODERATION) return "warning";
  if (status === STATUS.SAFE) return "positive";
  return "neutral";
}

function buildFactors(outcomes) {
  const factors = [];
  for (const outcome of outcomes) {
    for (const item of outcome.evidence) {
      factors.push({
        name: `${item.label} (${CONDITION_LABELS[outcome.condition]})`,
        level: factorLevelFor(item),
        impact: factorImpactFor(item.status),
        detail: `${evidenceSentence(item)} ${item.ruleId}.`,
      });
    }
    if (outcome.evidence.length === 0) {
      for (const gap of outcome.missing.slice(0, 1)) {
        factors.push({
          name: `${CONDITION_LABELS[outcome.condition]} evidence`,
          level: "Unknown",
          impact: "neutral",
          detail: gap,
        });
      }
    }
  }
  return factors.slice(0, 8);
}

// ─── Alternatives ────────────────────────────────────────────────────────────

const ALTERNATIVE_CANDIDATES = Object.freeze({
  diabetes: ["Guava", "Apple", "Dal", "Curd", "Khichdi", "Roti"],
  hypertension: ["Oats", "Banana", "Spinach", "Dal", "Curd", "Apple"],
  ckd: ["Apple", "Cabbage", "Cauliflower", "White Rice", "Green Beans", "Pear"],
  celiac: ["White Rice", "Idli", "Dosa", "Quinoa", "Dal", "Banana"],
  allergy: ["White Rice", "Apple", "Banana", "Carrot", "Chicken", "Pear"],
});

function iconForCategory(category) {
  if (category === "Fruit") return "nutrition-outline";
  if (category === "Vegetables") return "leaf-outline";
  if (category === "Protein") return "fitness-outline";
  if (category === "Dairy") return "water-outline";
  if (category === "Grains") return "restaurant-outline";
  return "leaf-outline";
}

function buildAlternatives(reference, conditions, patient, records) {
  const seen = new Set([reference.foodId]);
  const names = [];
  for (const condition of conditions) {
    for (const name of ALTERNATIVE_CANDIDATES[condition] || []) {
      const id = slug(name);
      if (seen.has(id)) continue;
      seen.add(id);
      names.push(name);
    }
  }

  const scored = [];
  for (const name of names) {
    const candidate = resolveFoodReference(name);
    if (!candidate || candidate.foodId === reference.foodId) continue;
    const evaluation = evaluateReference(candidate, conditions, { patient, records });
    if (
      evaluation.status === STATUS.NOT_RECOMMENDED ||
      evaluation.status === STATUS.UNABLE ||
      evaluation.status === STATUS.MODERATION
    ) {
      // Only recommend foods that pass every active condition.
      continue;
    }
    const firstEvidence = evaluation.outcomes.flatMap((o) => o.evidence)[0];
    scored.push({
      name: candidate.canonicalName,
      reason: firstEvidence
        ? `No rule triggered at ${candidate.serving.label}: ${evidenceSentence(firstEvidence)}`
        : `No applicable rule triggered at ${candidate.serving.label}.`,
      icon: iconForCategory(candidate.category),
      status: evaluation.status,
    });
  }

  return scored.slice(0, 3).map(({ status: _status, ...alt }) => alt);
}

// ─── Conflict detection (for test fixtures / future multiple sources) ────────

function detectConflicts(records) {
  const conflicts = new Set();
  if (!Array.isArray(records) || records.length < 2) return conflicts;
  const keys = ["sugar", "carbs", "sodium", "saturatedFat", "potassium", "phosphorus"];
  for (const key of keys) {
    const values = records
      .map((r) => r?.[key])
      .filter((v) => typeof v === "number" && Number.isFinite(v));
    if (values.length < 2) continue;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const tolerance = key === "sodium" || key === "potassium" || key === "phosphorus" ? 20 : 1;
    if (max - min > tolerance) conflicts.add(key);
  }
  return conflicts;
}

// ─── Core evaluation of a resolved reference ─────────────────────────────────

function evaluateReference(reference, conditions, options = {}) {
  const unique = [...new Set(conditions)].filter((c) => VALID_CONDITIONS.includes(c));
  const conflicts = detectConflicts(options.records);
  const patient = options.patient;
  const outcomes = [];

  for (const condition of unique) {
    if (condition === "diabetes") outcomes.push(evaluateDiabetes(reference, conflicts));
    else if (condition === "hypertension")
      outcomes.push(evaluateHypertension(reference, conflicts));
    else if (condition === "ckd") outcomes.push(evaluateCkd(reference, conflicts));
    else if (condition === "celiac") outcomes.push(evaluateCeliac(reference, conflicts));
    else if (condition === "allergy") outcomes.push(evaluateAllergy(reference, patient));
  }

  for (const outcome of outcomes) outcome.summary = buildConditionSummary(outcome);

  const finalStatus =
    outcomes.length === 0 ? STATUS.UNABLE : maxStatus(outcomes.map((o) => o.status));

  return {
    status: finalStatus,
    statusHeadline: STATUS_HEADLINES[finalStatus],
    outcomes,
    finalStatus,
  };
}

// ─── Public analysis builder ─────────────────────────────────────────────────

function createBaseAnalysis(foodName, conditions, reference) {
  const unique = [...new Set(conditions)].filter((c) => VALID_CONDITIONS.includes(c));
  const now = new Date();
  return {
    id: `check-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    foodName: reference ? reference.canonicalName : titleCase(foodName),
    category: reference?.category ?? "Unknown food",
    condition: unique[0] ?? "ckd",
    conditions: unique,
    status: STATUS.UNABLE,
    statusHeadline: STATUS_HEADLINES[STATUS.UNABLE],
    summary: "",
    detailedWhy: "",
    factors: [],
    alternatives: [],
    evidence: [],
    dataGaps: [],
    conditionOutcomes: [],
    ruleVersion: RULE_VERSION,
    serving: reference?.serving ?? null,
    foodReference: reference
      ? {
          foodId: reference.foodId,
          canonicalName: reference.canonicalName,
          category: reference.category,
          source: reference.source.dataset,
          sourceType: reference.source.type,
          verified: reference.source.verified,
          uncertainty: reference.source.uncertainty,
          servingLabel: reference.serving.label,
          grams: reference.serving.grams,
          matchedAlias: reference.matchedAlias,
          matchType: reference.matchType,
          ingredients: reference.ingredients,
        }
      : null,
    confidence: reference ? (reference.matchType === "exact" ? "high" : "medium") : "low",
    portionGuidance: "",
    timestamp: `Today, ${now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`,
  };
}

function unableAnalysis(foodName, conditions, gaps, options = {}) {
  const analysis = createBaseAnalysis(foodName, conditions, options.reference ?? null);
  analysis.status = STATUS.UNABLE;
  analysis.statusHeadline = STATUS_HEADLINES[STATUS.UNABLE];
  analysis.dataGaps = gaps;
  analysis.summary =
    gaps.length > 0
      ? `We can't verify "${titleCase(foodName)}". ${gaps[0]}`
      : `We can't verify "${titleCase(foodName)}".`;
  analysis.detailedWhy = [
    "The safety engine did not produce a verdict because required evidence is missing or uncertain.",
    ...gaps,
    "Missing information is never treated as zero. Check the nutrition label, recipe, or a verified composition source before deciding.",
  ].join(" ");
  analysis.factors = gaps.slice(0, 3).map((gap) => ({
    name: "Missing evidence",
    level: "Unknown",
    impact: "neutral",
    detail: gap,
  }));
  analysis.portionGuidance =
    "Check the nutrition label, recipe, or a verified composition source before deciding.";
  return analysis;
}

/**
 * Analyze one food for one or more conditions.
 *
 * @param {string} foodName
 * @param {string[]} conditions
 * @param {{ patient?: object, identity?: object, records?: object[], referenceOverride?: object }} [options]
 * @returns {object} FoodSafetyAnalysis-compatible plain object
 */
function analyzeFood(foodName, conditions, options = {}) {
  const name = String(foodName ?? "").trim();
  const unique = [...new Set(Array.isArray(conditions) ? conditions : [])].filter((c) =>
    VALID_CONDITIONS.includes(c)
  );

  if (!name) {
    return unableAnalysis("Unknown food", unique, ["No food name was provided."]);
  }
  if (unique.length === 0) {
    return unableAnalysis(name, unique, [
      "No active medical condition was selected, so no condition-specific safety rule could be applied.",
    ]);
  }
  if (options.identity && options.identity.confirmed === false) {
    return unableAnalysis(name, unique, [
      "The food identity has not been confirmed, so a safety verdict cannot be attached to it.",
    ]);
  }

  const reference = options.referenceOverride || resolveFoodReference(name);
  if (!reference) {
    return unableAnalysis(name, unique, [
      `No reliable reference composition was found for "${titleCase(name)}".`,
    ]);
  }

  const evaluation = evaluateReference(reference, unique, options);
  const analysis = createBaseAnalysis(name, unique, reference);
  analysis.status = evaluation.status;
  analysis.statusHeadline = STATUS_HEADLINES[evaluation.status];
  analysis.evidence = evaluation.outcomes.flatMap((o) => o.evidence);
  analysis.dataGaps = [...new Set(evaluation.outcomes.flatMap((o) => o.missing))];
  analysis.conditionOutcomes = evaluation.outcomes.map((o) => ({
    condition: o.condition,
    label: CONDITION_LABELS[o.condition],
    status: o.status,
    statusHeadline: STATUS_HEADLINES[o.status],
    summary: o.summary,
    evidence: o.evidence,
    missing: o.missing,
  }));
  analysis.factors = buildFactors(evaluation.outcomes);

  analysis.summary = buildShortSummary({
    name: analysis.foodName,
    status: evaluation.status,
    outcomes: evaluation.outcomes,
    servingLabel: reference.serving?.label,
  });

  const whyParts = [];
  for (const outcome of evaluation.outcomes) {
    const label = CONDITION_LABELS[outcome.condition];
    const ruleWhy = buildRuleWhy(outcome);
    whyParts.push(`[${label}] ${outcome.summary}${ruleWhy ? ` ${ruleWhy}` : ""}`);
  }
  whyParts.push(
    `Reference basis: ${reference.canonicalName}, ${reference.serving.label}, ${reference.source.dataset}. ${reference.source.uncertainty}`
  );
  analysis.detailedWhy = whyParts.join("\n\n");

  if (evaluation.status === STATUS.NOT_RECOMMENDED) {
    const hard = evaluation.outcomes.some(
      (o) =>
        o.status === STATUS.NOT_RECOMMENDED &&
        o.evidence.some((e) => e.nutrient === "gluten" || e.nutrient === "allergen")
    );
    analysis.portionGuidance = hard
      ? "Avoid this food for your active conditions. Confirm ingredients and cross-contact with the preparer."
      : "This reference serving exceeds a documented limit. Avoid it or discuss a smaller portion with your clinician.";
  } else if (evaluation.status === STATUS.UNABLE) {
    analysis.portionGuidance =
      "Check the nutrition label, recipe, or a verified composition source before deciding.";
  } else if (evaluation.status === STATUS.MODERATION) {
    analysis.portionGuidance =
      "Keep to a small portion and pair it with protein or fibre; confirm the portion with your clinician.";
  } else {
    analysis.portionGuidance =
      "No rule was triggered for the reference serving. Confirm the actual recipe and portion; this is not a guarantee.";
  }

  analysis.alternatives = buildAlternatives(reference, unique, options.patient, options.records);
  return analysis;
}

// ─── Vision identity policy (pure, shared with the client) ───────────────────

const DEFAULT_VISION_THRESHOLD = 0.72;
const AMBIGUITY_GAP = 0.12;

/**
 * Decide whether a vision result is strong enough to attach a safety verdict.
 * Ambiguous top candidates must be confirmed by the user first.
 *
 * @returns {{ decision: "success"|"uncertain"|"failed", reason: string }}
 */
function assessVisionIdentity(result, threshold = DEFAULT_VISION_THRESHOLD) {
  const foodName = typeof result?.foodName === "string" ? result.foodName.trim() : "";
  const confidence = Number(result?.confidence);
  if (!foodName) return { decision: "failed", reason: "No food was identified." };
  if (!Number.isFinite(confidence) || confidence < threshold) {
    return {
      decision: "uncertain",
      reason: "Identification confidence is below the safe-analysis threshold.",
    };
  }

  const candidates = Array.isArray(result?.candidates)
    ? result.candidates
        .filter((c) => c && typeof c.name === "string")
        .map((c) => ({ name: c.name, confidence: Number(c.confidence) || 0 }))
        .sort((a, b) => b.confidence - a.confidence)
    : [];

  if (candidates.length > 1) {
    const [top, second] = candidates;
    if (
      top.confidence - second.confidence < AMBIGUITY_GAP &&
      second.confidence >= threshold * 0.85
    ) {
      return {
        decision: "uncertain",
        reason: `The image also matches "${second.name}" closely; the food must be confirmed before evaluating safety.`,
      };
    }
  }

  return { decision: "success", reason: `Identified as ${foodName}.` };
}

module.exports = {
  RULE_VERSION,
  STATUS,
  STATUS_PRECEDENCE,
  STATUS_HEADLINES,
  CONDITION_LABELS,
  VALID_CONDITIONS,
  RULES,
  analyzeFood,
  evaluateReference,
  resolveFoodReference,
  assessVisionIdentity,
  canonicalAllergenTokens,
  DEFAULT_VISION_THRESHOLD,
  AMBIGUITY_GAP,
  // exported for tests
  detectConflicts,
  valuePerServing,
  findFoodMatch,
};
