/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai_explain from "../ai/explain.js";
import type * as ai_explainAnalysis from "../ai/explainAnalysis.js";
import type * as ai_identify from "../ai/identify.js";
import type * as alternatives_find from "../alternatives/find.js";
import type * as alternatives_rank from "../alternatives/rank.js";
import type * as analysis_analyze from "../analysis/analyze.js";
import type * as analysis_delete from "../analysis/delete.js";
import type * as analysis_get from "../analysis/get.js";
import type * as analysis_history from "../analysis/history.js";
import type * as auth_auth from "../auth/auth.js";
import type * as http from "../http.js";
import type * as meals_rank from "../meals/rank.js";
import type * as meals_recommend from "../meals/recommend.js";
import type * as nutrition_get from "../nutrition/get.js";
import type * as nutrition_search from "../nutrition/search.js";
import type * as profile_create from "../profile/create.js";
import type * as profile_get from "../profile/get.js";
import type * as profile_update from "../profile/update.js";
import type * as rules_allergies from "../rules/allergies.js";
import type * as rules_celiac from "../rules/celiac.js";
import type * as rules_ckd from "../rules/ckd.js";
import type * as rules_diabetes from "../rules/diabetes.js";
import type * as rules_evaluate from "../rules/evaluate.js";
import type * as rules_heart from "../rules/heart.js";
import type * as rules_index from "../rules/index.js";
import type * as rules_types from "../rules/types.js";
import type * as validators from "../validators.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "ai/explain": typeof ai_explain;
  "ai/explainAnalysis": typeof ai_explainAnalysis;
  "ai/identify": typeof ai_identify;
  "alternatives/find": typeof alternatives_find;
  "alternatives/rank": typeof alternatives_rank;
  "analysis/analyze": typeof analysis_analyze;
  "analysis/delete": typeof analysis_delete;
  "analysis/get": typeof analysis_get;
  "analysis/history": typeof analysis_history;
  "auth/auth": typeof auth_auth;
  http: typeof http;
  "meals/rank": typeof meals_rank;
  "meals/recommend": typeof meals_recommend;
  "nutrition/get": typeof nutrition_get;
  "nutrition/search": typeof nutrition_search;
  "profile/create": typeof profile_create;
  "profile/get": typeof profile_get;
  "profile/update": typeof profile_update;
  "rules/allergies": typeof rules_allergies;
  "rules/celiac": typeof rules_celiac;
  "rules/ckd": typeof rules_ckd;
  "rules/diabetes": typeof rules_diabetes;
  "rules/evaluate": typeof rules_evaluate;
  "rules/heart": typeof rules_heart;
  "rules/index": typeof rules_index;
  "rules/types": typeof rules_types;
  validators: typeof validators;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
};
