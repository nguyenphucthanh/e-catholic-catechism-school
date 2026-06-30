/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as academicYears from "../academicYears.js";
import type * as auth from "../auth.js";
import type * as catechists from "../catechists.js";
import type * as lib_authz from "../lib/authz.js";
import type * as lib_counter from "../lib/counter.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_password from "../lib/password.js";
import type * as seed from "../seed.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  academicYears: typeof academicYears;
  auth: typeof auth;
  catechists: typeof catechists;
  "lib/authz": typeof lib_authz;
  "lib/counter": typeof lib_counter;
  "lib/errors": typeof lib_errors;
  "lib/password": typeof lib_password;
  seed: typeof seed;
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

export declare const components: {};
