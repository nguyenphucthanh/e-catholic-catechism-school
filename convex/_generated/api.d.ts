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
import type * as attendanceHealth from "../attendanceHealth.js";
import type * as attendanceQueries from "../attendanceQueries.js";
import type * as auth from "../auth.js";
import type * as branchStats from "../branchStats.js";
import type * as branches from "../branches.js";
import type * as calendarEvents from "../calendarEvents.js";
import type * as catechistPermissions from "../catechistPermissions.js";
import type * as catechists from "../catechists.js";
import type * as classSessions from "../classSessions.js";
import type * as classes from "../classes.js";
import type * as crons from "../crons.js";
import type * as csvImport from "../csvImport.js";
import type * as demoData from "../demoData.js";
import type * as extracurricularPrograms from "../extracurricularPrograms.js";
import type * as grading from "../grading.js";
import type * as guardians from "../guardians.js";
import type * as lib_accountPrefix from "../lib/accountPrefix.js";
import type * as lib_attendance from "../lib/attendance.js";
import type * as lib_authz from "../lib/authz.js";
import type * as lib_classConflictCheck from "../lib/classConflictCheck.js";
import type * as lib_classSessionHelpers from "../lib/classSessionHelpers.js";
import type * as lib_classTypes from "../lib/classTypes.js";
import type * as lib_counter from "../lib/counter.js";
import type * as lib_eligibility from "../lib/eligibility.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_gradingEngine from "../lib/gradingEngine.js";
import type * as lib_gradingHelpers from "../lib/gradingHelpers.js";
import type * as lib_name from "../lib/name.js";
import type * as lib_password from "../lib/password.js";
import type * as lib_phone from "../lib/phone.js";
import type * as lib_programStatus from "../lib/programStatus.js";
import type * as lib_sacramentHelpers from "../lib/sacramentHelpers.js";
import type * as lib_statsHelpers from "../lib/statsHelpers.js";
import type * as lib_studentClassLookup from "../lib/studentClassLookup.js";
import type * as orgStats from "../orgStats.js";
import type * as parishAttendance from "../parishAttendance.js";
import type * as programs_admin from "../programs/admin.js";
import type * as programs_enrollment from "../programs/enrollment.js";
import type * as reports from "../reports.js";
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
  attendanceHealth: typeof attendanceHealth;
  attendanceQueries: typeof attendanceQueries;
  auth: typeof auth;
  branchStats: typeof branchStats;
  branches: typeof branches;
  calendarEvents: typeof calendarEvents;
  catechistPermissions: typeof catechistPermissions;
  catechists: typeof catechists;
  classSessions: typeof classSessions;
  classes: typeof classes;
  crons: typeof crons;
  csvImport: typeof csvImport;
  demoData: typeof demoData;
  extracurricularPrograms: typeof extracurricularPrograms;
  grading: typeof grading;
  guardians: typeof guardians;
  "lib/accountPrefix": typeof lib_accountPrefix;
  "lib/attendance": typeof lib_attendance;
  "lib/authz": typeof lib_authz;
  "lib/classConflictCheck": typeof lib_classConflictCheck;
  "lib/classSessionHelpers": typeof lib_classSessionHelpers;
  "lib/classTypes": typeof lib_classTypes;
  "lib/counter": typeof lib_counter;
  "lib/eligibility": typeof lib_eligibility;
  "lib/errors": typeof lib_errors;
  "lib/gradingEngine": typeof lib_gradingEngine;
  "lib/gradingHelpers": typeof lib_gradingHelpers;
  "lib/name": typeof lib_name;
  "lib/password": typeof lib_password;
  "lib/phone": typeof lib_phone;
  "lib/programStatus": typeof lib_programStatus;
  "lib/sacramentHelpers": typeof lib_sacramentHelpers;
  "lib/statsHelpers": typeof lib_statsHelpers;
  "lib/studentClassLookup": typeof lib_studentClassLookup;
  orgStats: typeof orgStats;
  parishAttendance: typeof parishAttendance;
  "programs/admin": typeof programs_admin;
  "programs/enrollment": typeof programs_enrollment;
  reports: typeof reports;
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
