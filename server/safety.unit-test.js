/* Deterministic unit tests for the shared food-safety engine.
 *
 * These tests encode the product contract directly:
 *   - no unsupported "safe" verdicts,
 *   - evidence-only explanations,
 *   - hard restrictions outrank favourable nutrients,
 *   - missing/conflicting data is "unable to verify", never zero,
 *   - alternatives are re-resolved and re-evaluated.
 *
 * Run: node server/safety.unit-test.js
 */

const assert = require("node:assert/strict");
const engine = require("./safety-engine");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`✗ ${name}`);
    console.error(`  ${err.message}`);
  }
}

const PATIENT = { allergensList: [] };
const DAIRY_PATIENT = { allergensList: ["Dairy"] };

function analyze(food, conditions, options = {}) {
  return engine.analyzeFood(food, conditions, { patient: PATIENT, ...options });
}

/** Deep copy a reference so a test can delete/corrupt one nutrient. */
function mutableReference(food = "Gulab jamun") {
  return JSON.parse(JSON.stringify(engine.resolveFoodReference(food)));
}

const BANNED_PHRASES = [
  "low glycemic",
  "gi <",
  "glycemic index of",
  "minimal simple sugars",
  "supports vascular elasticity",
  "insulin spike",
  "doctor approved",
  "completely safe",
  "100% safe",
];

function assertNoInventedClaims(analysis) {
  const haystack = [
    analysis.summary,
    analysis.detailedWhy,
    analysis.portionGuidance,
    ...analysis.factors.map((f) => `${f.name} ${f.detail}`),
    ...analysis.alternatives.map((a) => a.reason),
    ...analysis.evidence.map((e) => `${e.label} ${e.note}`),
  ]
    .join("\n")
    .toLowerCase();
  for (const phrase of BANNED_PHRASES) {
    assert.equal(
      haystack.includes(phrase),
      false,
      `explanation contains unsupported phrase "${phrase}"`
    );
  }
}

function assertEvidenceShape(analysis) {
  for (const item of analysis.evidence) {
    assert.ok(item.ruleId && item.ruleId.length > 0, "evidence has ruleId");
    assert.equal(
      item.ruleVersion,
      engine.RULE_VERSION,
      "evidence carries the current rule version"
    );
    assert.ok(engine.STATUS_HEADLINES[item.status], "evidence status is known");
    assert.equal(typeof item.servingLabel, "string", "evidence names the serving basis");
    if (typeof item.value === "number") {
      assert.ok(item.value >= 0 && Number.isFinite(item.value), "numeric evidence is finite");
      assert.ok(item.unit, "numeric evidence has a unit");
    } else {
      assert.equal(typeof item.value, "string", "non-numeric evidence is a string");
    }
  }
}

// ─── 1. Critical regression: Gulab jamun + diabetes ──────────────────────────

test("gulab jamun + diabetes is Not Recommended with sugar evidence", () => {
  const a = analyze("Gulab jamun", ["diabetes"]);
  assert.equal(a.status, "not_recommended");
  assert.equal(a.statusHeadline, "Not Recommended");
  assert.equal(a.foodReference.foodId, "gulab-jamun");
  assert.equal(a.serving.label, "1 serving (100 g)");

  const sugar = a.evidence.find((e) => e.nutrient === "sugar");
  assert.ok(sugar, "sugar evidence exists");
  assert.equal(sugar.value, 45);
  assert.equal(sugar.unit, "g");
  assert.equal(sugar.ruleId, "diabetes.sugar.per_serving");
  assert.match(a.summary, /45 g/);
  assert.match(a.summary, /not recommended for diabetes/i);
  assert.match(a.detailedWhy, /diabetes\.sugar\.per_serving/);
  assert.ok(a.summary.length < 160, "summary stays short enough to scan");
  assert.equal(
    a.factors.some((f) => f.level === "High"),
    true
  );
  assertNoInventedClaims(a);
  assertEvidenceShape(a);
});

// ─── 2. Critical regression: + hypertension keeps both conditions ────────────

test("gulab jamun + diabetes + hypertension is Not Recommended across both", () => {
  const a = analyze("Gulab jamun", ["diabetes", "hypertension"]);
  assert.equal(a.status, "not_recommended");
  assert.deepEqual(a.conditions, ["diabetes", "hypertension"]);
  assert.equal(a.conditionOutcomes.length, 2);
  for (const outcome of a.conditionOutcomes) {
    assert.equal(outcome.evidence.length > 0, true, `${outcome.condition} has evidence`);
    assert.match(outcome.summary, new RegExp(outcome.label));
  }
  const diabetes = a.conditionOutcomes.find((o) => o.condition === "diabetes");
  assert.equal(diabetes.status, "not_recommended");
  assertNoInventedClaims(a);
  assertEvidenceShape(a);
});

// ─── 3. Critical regression: missing evidence never becomes zero/safe ────────

test("missing sugar makes diabetes Unable to Verify instead of safe", () => {
  const reference = mutableReference();
  delete reference.per100g.sugar;
  const a = analyze("Gulab jamun", ["diabetes"], { referenceOverride: reference });
  assert.equal(a.status, "unable_to_verify");
  assert.equal(a.statusHeadline, "Unable to Verify");
  assert.ok(a.dataGaps.some((g) => /sugar could not be verified/i.test(g)));
  assert.equal(
    a.evidence.some((e) => e.nutrient === "sugar"),
    false,
    "no sugar evidence is manufactured for a missing nutrient"
  );
  assert.equal(
    a.evidence.some((e) => e.nutrient === "carbs"),
    true,
    "other verified nutrients are still reported"
  );
  assertNoInventedClaims(a);
});

test("invalid and negative nutrient values fail closed", () => {
  for (const bad of [NaN, -1, "45", null, undefined]) {
    const reference = mutableReference();
    reference.per100g.sugar = bad;
    const a = analyze("Gulab jamun", ["diabetes"], { referenceOverride: reference });
    assert.equal(a.status, "unable_to_verify", `sugar=${String(bad)} fails closed`);
  }
});

test("conflicting reference records make the affected condition unverifiable", () => {
  const records = [
    { sugar: 45, carbs: 55, sodium: 100, saturatedFat: 6, potassium: 130, phosphorus: 80 },
    { sugar: 5, carbs: 55, sodium: 100, saturatedFat: 6, potassium: 130, phosphorus: 80 },
  ];
  const conflicts = engine.detectConflicts(records);
  assert.equal(conflicts.has("sugar"), true);

  const a = analyze("Gulab jamun", ["diabetes"], { records });
  assert.equal(a.status, "unable_to_verify");
  assert.ok(a.dataGaps.some((g) => /conflicting reference records for sugar/i.test(g)));
});

// ─── 4. Critical regression: hard restrictions outrank favourable results ────

test("celiac gluten restriction outranks favourable CKD values", () => {
  const a = analyze("Gulab jamun", ["ckd", "celiac"]);
  assert.equal(a.status, "not_recommended");
  const ckd = a.conditionOutcomes.find((o) => o.condition === "ckd");
  const celiac = a.conditionOutcomes.find((o) => o.condition === "celiac");
  assert.equal(ckd.status, "safe", "precondition: CKD values are favourable");
  assert.equal(celiac.status, "not_recommended");
  assert.equal(a.status, "not_recommended", "hard restriction cannot be overridden");
  assert.ok(celiac.evidence.some((e) => e.nutrient === "gluten"));
  assertNoInventedClaims(a);
});

test("a confirmed allergen is a hard restriction even when records conflict", () => {
  const records = [
    { sugar: 45, carbs: 55, sodium: 100, saturatedFat: 6, potassium: 130, phosphorus: 80 },
    { sugar: 5, carbs: 50, sodium: 90, saturatedFat: 5, potassium: 120, phosphorus: 70 },
  ];
  const a = engine.analyzeFood("Gulab jamun", ["diabetes", "allergy"], {
    patient: DAIRY_PATIENT,
    records,
  });
  assert.equal(a.status, "not_recommended");
  const allergy = a.conditionOutcomes.find((o) => o.condition === "allergy");
  assert.equal(allergy.status, "not_recommended");
  assert.ok(allergy.evidence.some((e) => /dairy/i.test(e.label)));
});

test("allergy screen with no listed allergens is Unable to Verify", () => {
  const a = analyze("White rice", ["allergy"], { patient: { allergensList: [] } });
  assert.equal(a.status, "unable_to_verify");
  assert.ok(a.dataGaps.some((g) => /no allergens are listed/i.test(g)));
});

test("a possible allergen (not confirmed) is Unable to Verify, not safe", () => {
  const a = engine.analyzeFood("Jalebi", ["allergy"], {
    patient: { allergensList: ["Dairy"] },
  });
  assert.equal(a.status, "unable_to_verify");
});

test("an unknown listed allergen cannot be called safe", () => {
  const a = engine.analyzeFood("White rice", ["allergy"], {
    patient: { allergensList: ["kiwi"] },
  });
  assert.equal(a.status, "unable_to_verify");
});

// ─── 5. Critical regression: vision identity policy ──────────────────────────

test("low-confidence vision identification requires confirmation", () => {
  const result = engine.assessVisionIdentity({ foodName: "Gulab jamun", confidence: 0.5 });
  assert.equal(result.decision, "uncertain");
});

test("ambiguous vision candidates require confirmation", () => {
  const result = engine.assessVisionIdentity({
    foodName: "Gulab jamun",
    confidence: 0.82,
    candidates: [
      { name: "Gulab jamun", confidence: 0.82 },
      { name: "Jalebi", confidence: 0.79 },
    ],
  });
  assert.equal(result.decision, "uncertain");
  assert.match(result.reason, /jalebi/i);
});

test("strong unambiguous vision identification can be analysed", () => {
  const result = engine.assessVisionIdentity({
    foodName: "Gulab jamun",
    confidence: 0.93,
    candidates: [
      { name: "Gulab jamun", confidence: 0.93 },
      { name: "Jalebi", confidence: 0.4 },
    ],
  });
  assert.equal(result.decision, "success");
});

test("an unconfirmed food identity never receives a verdict", () => {
  const a = analyze("Gulab jamun", ["diabetes"], { identity: { confirmed: false } });
  assert.equal(a.status, "unable_to_verify");
  assert.ok(a.dataGaps.some((g) => /identity has not been confirmed/i.test(g)));
});

// ─── Condition matrix ────────────────────────────────────────────────────────

test("condition matrix: each condition blocks its documented hazard", () => {
  const matrix = [
    ["diabetes", "Gulab jamun", "not_recommended"],
    ["hypertension", "Pizza", "not_recommended"],
    ["ckd", "Pizza", "not_recommended"],
    ["celiac", "Roti", "not_recommended"],
    ["allergy", "Paneer", "not_recommended"],
  ];
  for (const [condition, food, expected] of matrix) {
    const a = engine.analyzeFood(food, [condition], {
      patient: condition === "allergy" ? DAIRY_PATIENT : PATIENT,
    });
    assert.equal(a.status, expected, `${food} + ${condition}`);
    assert.equal(a.statusHeadline, engine.STATUS_HEADLINES[expected]);
    assertNoInventedClaims(a);
    assertEvidenceShape(a);
  }
});

test("condition matrix: ordinary reference foods stay low-risk where rules pass", () => {
  const matrix = [
    ["diabetes", "Roti", "safe"],
    ["hypertension", "Curd", "safe"],
    ["ckd", "Apple", "safe"],
    ["celiac", "White rice", "safe"],
    ["allergy", "White rice", "safe"],
  ];
  for (const [condition, food, expected] of matrix) {
    const a = engine.analyzeFood(food, [condition], {
      patient: condition === "allergy" ? DAIRY_PATIENT : PATIENT,
    });
    assert.equal(a.status, expected, `${food} + ${condition}`);
  }
});

test("all-condition aggregate equals the most restrictive outcome", () => {
  const all = ["diabetes", "hypertension", "ckd", "celiac", "allergy"];
  const a = engine.analyzeFood("Gulab jamun", all, { patient: DAIRY_PATIENT });
  assert.equal(a.status, "not_recommended");
  const worst = Math.max(...a.conditionOutcomes.map((o) => engine.STATUS_PRECEDENCE[o.status]));
  assert.equal(engine.STATUS_PRECEDENCE[a.status], worst);
  assert.equal(a.conditionOutcomes.length, all.length);
});

test("invariant: a safe verdict requires every active condition to be safe", () => {
  const foods = [
    "Gulab jamun",
    "Jalebi",
    "Laddu",
    "Kheer",
    "Halwa",
    "Apple",
    "White rice",
    "Roti",
    "Dal",
    "Curd",
    "Chicken",
  ];
  const conditionSets = [
    ["diabetes"],
    ["hypertension"],
    ["ckd"],
    ["celiac"],
    ["allergy"],
    ["diabetes", "hypertension"],
    ["ckd", "celiac"],
    ["diabetes", "allergy"],
    ["diabetes", "hypertension", "ckd", "celiac", "allergy"],
  ];

  for (const food of foods) {
    for (const conditions of conditionSets) {
      const a = engine.analyzeFood(food, conditions, { patient: DAIRY_PATIENT });
      assert.ok(engine.STATUS_HEADLINES[a.status], `known status for ${food}`);
      if (a.status === "safe") {
        assert.equal(
          a.conditionOutcomes.every((o) => o.status === "safe"),
          true,
          `${food} / ${conditions.join("+")}: safe requires all conditions safe`
        );
      }
      if (a.status === "unable_to_verify") {
        assert.ok(a.dataGaps.length > 0, `${food}: unable verdict carries a data gap`);
      }
      assert.equal(
        a.status,
        a.conditionOutcomes.reduce(
          (worst, o) =>
            engine.STATUS_PRECEDENCE[o.status] > engine.STATUS_PRECEDENCE[worst] ? o.status : worst,
          "safe"
        ),
        `${food} / ${conditions.join("+")}: aggregate precedence`
      );
      assertEvidenceShape(a);
    }
  }
});

// ─── Data / plumbing ─────────────────────────────────────────────────────────

test("unknown food, empty query, and no conditions all fail closed", () => {
  assert.equal(analyze("Martian rock stew", ["diabetes"]).status, "unable_to_verify");
  assert.equal(analyze("   ", ["diabetes"]).status, "unable_to_verify");
  assert.equal(analyze("Gulab jamun", []).status, "unable_to_verify");
  assert.equal(analyze("Gulab jamun", ["not-a-condition"]).status, "unable_to_verify");
});

test("serving normalization scales per-100g values correctly", () => {
  const serving = engine.resolveFoodReference("Gulab jamun");
  const piece = { ...serving, serving: { unit: "piece", grams: 45, label: "1 piece (45 g)" } };
  assert.equal(engine.valuePerServing(serving, "sugar"), 45);
  assert.equal(engine.valuePerServing(piece, "sugar"), 20.25);
  assert.equal(engine.valuePerServing(serving, "not-a-nutrient"), null);
});

test("status vocabulary is closed: no legacy AI statuses survive", () => {
  const allowed = new Set(["safe", "moderation", "not_recommended", "unable_to_verify"]);
  const a = analyze("Gulab jamun", ["diabetes", "hypertension", "celiac"]);
  for (const value of [
    a.status,
    ...a.conditionOutcomes.map((o) => o.status),
    ...a.evidence.map((e) => e.status),
  ]) {
    assert.equal(allowed.has(value), true, `unexpected status ${value}`);
    assert.equal(engine.STATUS_HEADLINES[value] !== undefined, true);
  }
});

test("rule version and documented thresholds are exposed", () => {
  assert.equal(typeof engine.RULE_VERSION, "string");
  assert.match(engine.RULE_VERSION, /^\d{4}\.\d{1,2}\.\d+$/);
  for (const rule of engine.RULES.diabetes) {
    assert.ok(rule.moderateAt < rule.blockAt, `${rule.id} has ordered thresholds`);
    assert.ok(rule.rationale.length > 20, `${rule.id} documents its rationale`);
    assert.ok(rule.review.length > 10, `${rule.id} documents the clinical review it needs`);
  }
  const a = analyze("Gulab jamun", ["diabetes"]);
  assert.equal(a.ruleVersion, engine.RULE_VERSION);
  assert.equal(
    a.evidence.every((e) => e.ruleVersion === engine.RULE_VERSION),
    true
  );
});

test("alternatives are resolved, distinct, and pass every active condition", () => {
  const conditions = ["diabetes", "hypertension"];
  const a = engine.analyzeFood("Gulab jamun", conditions, { patient: PATIENT });
  assert.ok(a.alternatives.length > 0, "at least one alternative");
  assert.ok(a.alternatives.length <= 3, "at most three alternatives");

  const names = new Set();
  for (const alt of a.alternatives) {
    assert.equal(names.has(alt.name), false, `duplicate alternative ${alt.name}`);
    names.add(alt.name);
    assert.notEqual(alt.name.toLowerCase(), "gulab jamun");

    const candidate = engine.resolveFoodReference(alt.name);
    assert.ok(candidate, `alternative ${alt.name} resolves to reference data`);
    const evaluated = engine.evaluateReference(candidate, conditions, { patient: PATIENT });
    assert.equal(evaluated.status, "safe", `${alt.name} is safe for every active condition`);
  }
});

test("Gulab jamun never presents a green verdict for high sugar evidence", () => {
  const a = analyze("Gulab jamun", ["diabetes"]);
  assert.notEqual(a.status, "safe");
  assert.notEqual(a.statusHeadline.toLowerCase(), "safe to consume");
  assert.notEqual(a.portionGuidance.toLowerCase().includes("safe"), true);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
