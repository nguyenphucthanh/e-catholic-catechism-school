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
import type * as assignments from "../assignments.js";
import type * as attendance from "../attendance.js";
import type * as auth from "../auth.js";
import type * as branches from "../branches.js";
import type * as catechists from "../catechists.js";
import type * as classSessions from "../classSessions.js";
import type * as classes from "../classes.js";
import type * as grading from "../grading.js";
import type * as guardians from "../guardians.js";
import type * as lib_authz from "../lib/authz.js";
import type * as lib_counter from "../lib/counter.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_password from "../lib/password.js";
import type * as migrations_backfillAssignments from "../migrations/backfillAssignments.js";
import type * as seed from "../seed.js";
import type * as storage from "../storage.js";
import type * as students from "../students.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  academicYears: typeof academicYears;
  assignments: typeof assignments;
  attendance: typeof attendance;
  auth: typeof auth;
  branches: typeof branches;
  catechists: typeof catechists;
  classSessions: typeof classSessions;
  classes: typeof classes;
  grading: typeof grading;
  guardians: typeof guardians;
  "lib/authz": typeof lib_authz;
  "lib/counter": typeof lib_counter;
  "lib/errors": typeof lib_errors;
  "lib/password": typeof lib_password;
  "migrations/backfillAssignments": typeof migrations_backfillAssignments;
  seed: typeof seed;
  storage: typeof storage;
  students: typeof students;
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
