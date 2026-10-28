/* UI contract tests.
 *
 * The Jest/RN test runner is not part of this project, so these checks assert
 * the client integration points that caused the original false-green bug:
 * the badge must render a fourth state, cards must show evidence and every
 * active condition, and the analysis service must reject legacy AI verdicts.
 *
 * Run: node server/safety.ui-test.js
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");

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

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

const badge = read("src/components/SafetyStatusBadge.tsx");
const card = read("src/components/FoodCheckCard.tsx");
const tokens = read("src/theme/tokens.ts");
const darkTokens = read("src/theme/darkTokens.ts");
const foodAnalysis = read("src/services/foodAnalysis.ts");
const foodVision = read("src/services/foodVision.ts");
const foodSafety = read("src/data/foodSafety.ts");

test("status badge renders all four states, including Unable to Verify", () => {
  for (const status of ["safe", "moderation", "not_recommended", "unable_to_verify"]) {
    assert.match(badge, new RegExp(`\\b${status}\\b`), `badge handles ${status}`);
  }
  assert.match(badge, /Unable to Verify/);
  assert.match(badge, /Unverified/);
  assert.match(badge, /help-circle/);
});

test("status colours define a distinct unable state in light and dark themes", () => {
  for (const [name, source] of [
    ["tokens", tokens],
    ["darkTokens", darkTokens],
  ]) {
    assert.match(source, /unableText/, `${name} unableText`);
    assert.match(source, /unableBg/, `${name} unableBg`);
    assert.match(source, /unableBorder/, `${name} unableBorder`);
    assert.match(source, /unableIcon/, `${name} unableIcon`);
  }
  assert.match(tokens, /case "unable_to_verify"/);
});

test("result card shows every active condition, not just the first", () => {
  assert.match(card, /analysis\.conditions/);
  assert.match(card, /conditions\.map/);
  assert.match(card, /getConditionColor/);
});

test("card surfaces evidence, data gaps, serving, source, and rule version", () => {
  assert.match(card, /Evidence used/);
  assert.match(card, /analysis\.evidence/);
  assert.match(card, /What we couldn/);
  assert.match(card, /analysis\.dataGaps/);
  assert.match(card, /analysis\.serving/);
  assert.match(card, /analysis\.foodReference/);
  assert.match(card, /analysis\.ruleVersion/);
  assert.match(card, /uncertainty/);
});

test("history rows show all conditions and the correct fourth-state icon", () => {
  assert.match(card, /STATUS_ICONS\[analysis\.status\]/);
  assert.match(card, /getAnalysisConditions\(analysis\)\.map\(getConditionLabel\)\.join/);
});

test("analysis service only trusts a current, evidence-backed rules-engine payload", () => {
  assert.match(foodAnalysis, /data\.source === "rules-engine"/);
  assert.match(foodAnalysis, /value\.ruleVersion !== RULE_VERSION/);
  assert.match(foodAnalysis, /Array\.isArray\(value\.evidence\)/);
  assert.match(foodAnalysis, /Array\.isArray\(value\.conditionOutcomes\)/);
  assert.match(foodAnalysis, /isSafetyStatus/);
});

test("analysis service never defaults to moderation or safe", () => {
  assert.doesNotMatch(foodAnalysis, /base\.status \?\? "moderation"/);
  assert.doesNotMatch(foodAnalysis, /base\.status \?\? "safe"/);
  assert.doesNotMatch(foodAnalysis, /status \?\? "moderation"/);
  assert.match(foodAnalysis, /isSafetyStatus\(base\.status\) \? base\.status : "unable_to_verify"/);
});

test("analysis service sends only allergen tokens and marks identity confirmed", () => {
  assert.match(foodAnalysis, /allergensList/);
  assert.doesNotMatch(foodAnalysis, /patient: authStore\.getProfile\(\)/);
  assert.match(foodAnalysis, /confirmed: true/);
});

test("vision flow uses the shared ambiguity policy", () => {
  assert.match(foodVision, /assessVisionIdentity/);
  assert.match(foodAnalysis, /assessVisionIdentity/);
});

test("client safety data delegates to the shared deterministic engine", () => {
  assert.match(foodSafety, /from "\.\.\/\.\.\/server\/safety-engine"/);
  assert.match(foodSafety, /analyzeFood/);
  assert.doesNotMatch(foodSafety, /Low Glycemic Food/);
  assert.doesNotMatch(foodSafety, /default:\s*return\s*\{[\s\S]*?status:\s*"safe"/);
  assert.doesNotMatch(foodSafety, /GI\s*<\s*40/);
});

test("client status type includes unable_to_verify", () => {
  assert.match(foodSafety, /"safe" \| "moderation" \| "not_recommended" \| "unable_to_verify"/);
});

test("legacy saved results are re-labelled unverified instead of staying green", () => {
  assert.match(foodSafety, /normalizeStoredAnalysis/);
  assert.match(foodSafety, /analysis\.ruleVersion === RULE_VERSION/);
  assert.match(foodSafety, /status: "unable_to_verify"/);
  assert.match(foodSafety, /history\.map\(normalizeStoredAnalysis\)/);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
