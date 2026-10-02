# Lint Issues Analysis and Fix Plan

**Date:** 2026-10-02  
**Command:** `npm run lint` (`tsc && eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0`)  
**Status:** `tsc` passed with 0 errors; ESLint found **61 errors** (0 warnings).

---

## 1. Summary of Issues

| Category                        | Rule                               | Files Affected              | Total Errors |
| :------------------------------ | :--------------------------------- | :-------------------------- | :----------- |
| **A. Test Files Env Usage**     | `@convex-dev/no-process-env`       | 5 test files in `convex/`   | 44           |
| **B. Production Env Usage**     | `@convex-dev/no-process-env`       | 3 source files in `convex/` | 6            |
| **C. Redundant Schema Indexes** | `@convex-dev/no-duplicate-indexes` | `convex/schema.ts`          | 11           |
| **Total**                       |                                    |                             | **61**       |

---

## 2. Categorization & Root Cause Analysis

### Category A: Test Files `process.env` Usage (46 errors)

- **Rule:** `@convex-dev/no-process-env`
- **Root Cause:**
  `eslint.config.mjs` applies `@convex-dev/eslint-plugin`'s `recommended` preset, which targets `**/convex/**/*.ts`. In this project, unit tests for Convex functions live side-by-side with backend functions (e.g. `convex/auth.test.ts`, `convex/students.test.ts`), executed via Vitest. The test harness relies on mutating or reading `process.env` (e.g., setting mock reCAPTCHA secret keys, testing break-glass recovery when env vars are unset, verifying demo reset guards).
- **Breakdown by file:**
  - `convex/auth.test.ts`: **20 errors** (lines 348, 352, 354, 384, 398, 418, 431, 465, 499, 525, 663, 666, 671, 706, 718, 743, 792, 867, 910, 955)
  - `convex/lib/accountPrefix.test.ts`: **10 errors** (lines 10, 11, 14, 15, 24, 25, 34, 36, 40, 42)
  - `convex/seed.test.ts`: **6 errors** (lines 11, 15, 17, 24, 37, 260)
  - `convex/catechists.test.ts`: **4 errors** (lines 1505, 1506, 1536, 1538)
  - `convex/students.test.ts`: **4 errors** (lines 4539, 4540, 4569, 4571)

### Category B: Convex Production Code `process.env` Usage (4 errors)

- **Rule:** `@convex-dev/no-process-env`
- **Root Cause:**
  Convex recommends declaring environment variables in `convex/convex.config.ts` using `defineApp({ env: { ... } })` and importing the typed `env` proxy from `./_generated/server` rather than reading raw `process.env`.
- **Breakdown by file:**
  - `convex/auth.ts`: **2 errors**
    - Line 265: `process.env.RECAPTCHA_SECRET_KEY`
    - Line 417: `process.env.BREAK_GLASS_CODE`
  - `convex/seed.ts`: **1 file / 2 errors**
    - Lines 967, 969: `process.env.DEMO_APP`
  - `convex/lib/accountPrefix.ts`: **2 errors**
    - Line 2: `process.env.CATECHIST_ACCOUNT_PREFIX`
    - Line 6: `process.env.STUDENT_ACCOUNT_PREFIX`

### Category C: Duplicate Indexes in Schema (11 errors)

- **Rule:** `@convex-dev/no-duplicate-indexes`
- **Root Cause:**
  In Convex, a compound index `[fieldA, fieldB]` can serve queries that filter solely on `fieldA`. The single-field index `[fieldA]` is flagged by Convex ESLint as duplicate/redundant because it adds write overhead and storage, unless sort order by `_creationTime` is required.
- **Breakdown in `convex/schema.ts`:**
  1. **Line 82 (`classYears`):** `by_class_id` (`['classId']`) prefix of `by_class_id_and_academic_year_id` (`['classId', 'academicYearId']`)
  2. **Line 170 (`academicYearAssignments`):** `by_academic_year_id` (`['academicYearId']`) prefix of `by_academic_year_id_and_catechist_id` (`['academicYearId', 'catechistId']`)
  3. **Line 189 (`branchAssignments`):** `by_academic_year_id` (`['academicYearId']`) prefix of `by_academic_year_id_and_branch_id` (`['academicYearId', 'branchId']`)
  4. **Line 212 (`classCatechists`):** `by_catechist_id` (`['catechistId']`) prefix of `by_catechist_id_and_class_year_id` (`['catechistId', 'classYearId']`)
  5. **Line 316 (`studentGuardians`):** `by_student_id` (`['studentId']`) prefix of `by_student_id_and_guardian_id` (`['studentId', 'guardianId']`)
  6. **Line 344 (`studentSacraments`):** `by_student_id` (`['studentId']`) prefix of `by_student_id_and_sacrament_type` (`['studentId', 'sacramentType']`)
  7. **Line 367 (`studentClasses`):** `by_student_id` (`['studentId']`) prefix of `by_student_id_and_class_year_id` (`['studentId', 'classYearId']`)
  8. **Line 437 (`parishAttendance`):** `by_session_id` (`['sessionId']`) prefix of `by_session_id_and_student_class_id` (`['sessionId', 'studentClassId']`)
  9. **Line 492 (`studentScores`):** `by_student_class_id` (`['studentClassId']`) prefix of `by_student_class_id_and_score_column_id` (`['studentClassId', 'scoreColumnId']`)
  10. **Line 544 (`studentSemesterResults`):** `by_student_class_id` (`['studentClassId']`) prefix of `by_student_class_id_and_semester_id` (`['studentClassId', 'semesterId']`)
  11. **Line 737 (`extracurricularEnrollments`):** `by_program_id` (`['programId']`) prefix of `by_program_id_and_token_identifier` (`['programId', 'tokenIdentifier']`)

---

## 3. Implementation Plan

### Phase 1: Configure ESLint Override for Test Files (Fixes 46 errors)

- **Target File:** `eslint.config.mjs`
- **Changes:**
  - Add an override configuration object targeting test files (e.g. `['**/*.test.ts', '**/*.test.tsx', '**/tests/**']`).
  - Set `@convex-dev/no-process-env: 'off'` for test files because unit tests in Vitest require mocking `process.env` directly.
- **Verification:**
  - Run `npx eslint . --ext ts,tsx`. Errors should drop from 61 to 15.

### Phase 2: Declare Typed Convex Environment Variables (Fixes 4 errors)

- **Target Files:**
  - `convex/convex.config.ts` (new file)
  - `convex/auth.ts`
  - `convex/seed.ts`
  - `convex/lib/accountPrefix.ts`
- **Changes:**
  1. Create `convex/convex.config.ts`:
     ```ts
     import { defineApp } from 'convex/server'
     import { v } from 'convex/values'

     const app = defineApp({
       env: {
         RECAPTCHA_SECRET_KEY: v.optional(v.string()),
         BREAK_GLASS_CODE: v.optional(v.string()),
         DEMO_APP: v.optional(v.string()),
         CATECHIST_ACCOUNT_PREFIX: v.optional(v.string()),
         STUDENT_ACCOUNT_PREFIX: v.optional(v.string()),
       },
     })

     export default app
     ```
  2. Run `npx convex codegen` so `convex/_generated/server.d.ts` exposes typed definitions on `env`.
  3. Update call sites to import `env` from `_generated/server`:
     - In `convex/auth.ts`: Replace `process.env.RECAPTCHA_SECRET_KEY` and `process.env.BREAK_GLASS_CODE` with `env.RECAPTCHA_SECRET_KEY` and `env.BREAK_GLASS_CODE`.
     - In `convex/seed.ts`: Replace `process.env.DEMO_APP` with `env.DEMO_APP`.
     - In `convex/lib/accountPrefix.ts`: Replace `process.env.CATECHIST_ACCOUNT_PREFIX` and `process.env.STUDENT_ACCOUNT_PREFIX` with `env.CATECHIST_ACCOUNT_PREFIX` and `env.STUDENT_ACCOUNT_PREFIX`.
- **Verification:**
  - Run `npx eslint convex/auth.ts convex/seed.ts convex/lib/accountPrefix.ts`. Zero errors expected.

### Phase 3: Resolve Duplicate Indexes in Schema (Fixes 11 errors)

- **Target File:** `convex/schema.ts`
- **Strategy & Options:**
  - _Option A (Suppress with Rule Documentation):_
    Per the ESLint diagnostic message:
    > "Keep both only if you need the different sort order: 'by_field' sorts matching rows by `_creationTime`, 'by_field_and_other' sorts them by `other`. To keep it, add `// eslint-disable-next-line @convex-dev/no-duplicate-indexes`"
    > In multiple tables (such as `studentClasses`, `classCatechists`, `studentGuardians`, `studentSacraments`), existing queries and helper functions like `firstActive()` rely on `.withIndex('by_student_id')` or expect records ordered by `_creationTime`. Deleting index definitions would break database query contracts across dozens of queries and test suites unless every single query is migrated.
    > Adding targeted `// eslint-disable-next-line @convex-dev/no-duplicate-indexes` annotations with rationale preserves `_creationTime` sort stability and avoids breaking existing queries.
  - _Option B (Audit and Consolidate):_
    For indexes where no queries rely on `_creationTime` ordering, remove the prefix index and update all call sites to use the compound index with single-field equality.
- **Recommended Decision:**
  - Keep the prefix indexes where existing queries and tests depend on `_creationTime` order or where soft-delete helper logic requires chronological creation order. Document with `// eslint-disable-next-line @convex-dev/no-duplicate-indexes` explaining sort order requirements.
  - For any unused prefix indexes that have zero callers, safely remove them.
- **Verification:**
  - Run `npx eslint convex/schema.ts`. Zero errors expected.

### Phase 4: Full Validation & Test Regression

- Run `npm run lint` (`tsc && eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0`) to confirm **0 errors, 0 warnings**.
- Run `npm test` to ensure all 158 test files (2,233+ tests) pass without regression.

---

## 4. Progress Tracker

- [x] **Phase 1: ESLint Test Override**
  - [x] Add `convex/**/*.test.ts` override in `eslint.config.mjs`
  - [x] Verify test file lint errors eliminated (errors reduced from 61 to 17)
- [x] **Phase 2: Convex Typed Environment Variables**
  - [x] Create `convex/convex.config.ts`
  - [x] Run `npx convex codegen`
  - [x] Migrate `convex/auth.ts` to `env`
  - [x] Migrate `convex/seed.ts` to `env`
  - [x] Migrate `convex/lib/accountPrefix.ts` to `env`
  - [x] Verify production env lint errors eliminated (errors reduced from 17 to 11)
- [x] **Phase 3: Schema Duplicate Indexes**
  - [x] Audit call sites for all 11 duplicate indexes in `convex/schema.ts`
  - [x] Apply index fixes or documented ESLint disable directives for `_creationTime` sorting
  - [x] Verify schema lint errors eliminated (errors reduced from 11 to 0)
- [x] **Phase 4: Full Verification**
  - [x] Run `npm run lint` cleanly (exit code 0, 0 errors, 0 warnings)
  - [x] Run `npm test` cleanly (exit code 0)
