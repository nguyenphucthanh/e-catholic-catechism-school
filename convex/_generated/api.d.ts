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
import type * as accountAdmin from "../accountAdmin.js";
import type * as appConfig from "../appConfig.js";
import type * as assignments from "../assignments.js";
import type * as attendance from "../attendance.js";
import type * as auth from "../auth.js";
import type * as branchStats from "../branchStats.js";
import type * as branches from "../branches.js";
import type * as catechistPermissions from "../catechistPermissions.js";
import type * as catechists from "../catechists.js";
import type * as classSessions from "../classSessions.js";
import type * as classes from "../classes.js";
import type * as csvImport from "../csvImport.js";
import type * as grading from "../grading.js";
import type * as guardians from "../guardians.js";
import type * as lib_authz from "../lib/authz.js";
import type * as lib_counter from "../lib/counter.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_password from "../lib/password.js";
import type * as lib_statsHelpers from "../lib/statsHelpers.js";
import type * as migrations_backfillAssignments from "../migrations/backfillAssignments.js";
import type * as orgStats from "../orgStats.js";
import type * as search from "../search.js";
import type * as seed from "../seed.js";
import type * as setup from "../setup.js";
import type * as storage from "../storage.js";
import type * as studentFollowUp from "../studentFollowUp.js";
import type * as students from "../students.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  academicYears: typeof academicYears;
  accountAdmin: typeof accountAdmin;
  appConfig: typeof appConfig;
  assignments: typeof assignments;
  attendance: typeof attendance;
  auth: typeof auth;
  branchStats: typeof branchStats;
  branches: typeof branches;
  catechistPermissions: typeof catechistPermissions;
  catechists: typeof catechists;
  classSessions: typeof classSessions;
  classes: typeof classes;
  csvImport: typeof csvImport;
  grading: typeof grading;
  guardians: typeof guardians;
  "lib/authz": typeof lib_authz;
  "lib/counter": typeof lib_counter;
  "lib/errors": typeof lib_errors;
  "lib/password": typeof lib_password;
  "lib/statsHelpers": typeof lib_statsHelpers;
  "migrations/backfillAssignments": typeof migrations_backfillAssignments;
  orgStats: typeof orgStats;
  search: typeof search;
  seed: typeof seed;
  setup: typeof setup;
  storage: typeof storage;
  studentFollowUp: typeof studentFollowUp;
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
