# Architecture Audit & Refactoring Tracking

This document outlines the systematic strategy and progress tracking for architecture scans and deep-module refactorings across the codebase (based on `codebase-design` principles).

---

## 🎯 Architecture Goals

1. **Deep Modules:** Hide complex implementations behind simple, powerful interfaces.
2. **Clear Module Boundaries:** Decouple domain logic from UI presentation and database orchestration.
3. **Type-Safe Domain Contracts:** Ensure Convex backend functions and frontend hooks expose clean, resilient contracts.
4. **Reduction of Surface Complexity:** Avoid shallow wrappers and leaky abstractions.

---

## 🗺️ Architectural Scan Strategy

We execute scans module-by-module in 4 structured phases per module:

```
Phase 1: Module Audit (Interface vs Implementation Depth)
Phase 2: Refactoring Design & Seam Identification
Phase 3: Refactoring Execution (Red-Green-Refactor with tests)
Phase 4: Verification & Doc Update
```

---

## 📊 Progress Tracker

| Module / Scope | Status | Audited On | Issues Identified | Refactoring Status | Notes / Links |
| :--- | :---: | :---: | :--- | :---: | :--- |
| **1. Students & Guardians** | ✅ Completed | 2026-08-19 | Shallow UI query waterfalls, fragmented multi-step creation & promotion mutations | Round 1 & 2 Refactored (`getStudentDetail`, `assignStudentToClassYear`, `createStudentWithProfile`, `getEligibleForTransfer`) | Covers `convex/students.ts`, `convex/guardians.ts`, `students_.create.tsx`, and `students` routes |
| **2. Attendance & QR** | ✅ Completed | 2026-08-19, Round 3: 2026-08-20 | Round 3: `saveGridAttendance`/`bulkSaveGridAttendance` bypassed the Round-2 `reconcileAttendanceRecord` seam; N+1 studentClassId resolution; hidden `mode` default | Rounds 1-3 fully Refactored, all candidates shipped | Covers `convex/attendance*.ts` and attendance UI grid |
| **3. Classes & Photobooth** | ✅ Completed | 2026-08-19 | Client-side query waterfalls, recurring session dates & photobooth roster over-fetching | Round 1 & 2 Refactored (`getClassDetails`, `generateClassSessionsForSemester`, `getPhotoboothRoster`, `listMySessionsInRange`) | Covers `convex/classes.ts`, `classSessions.ts`, photobooth route |
| **4. Grading & Assignments** | ✅ Completed | 2026-08-19, Round 3: 2026-08-20 | Round 3: `GradingEngine`'s pass_fail branch was dead in production — real callers store results as `scoreLabel`, never `scoreValue`, so failed pass_fail exams could never register as failures | Rounds 1-3 fully Refactored (see Module Scan Log) | Covers `convex/grading.ts`, `assignments.ts`, evaluation UI |
| **5. Catechists & Auth** | ✅ Completed | 2026-08-19 | Fragmented profile/contact queries, split account creation & 5-mutation profile edit API | Round 1 & 2 Refactored (`getCatechistDetail`, `createCatechistWithAccount`, `updateWithDetails`, `updateClassAssignments`) | Covers `convex/catechists.ts`, `accountAdmin.ts`, `assignments.ts`, auth flow |
| **6. Calendar & Academic Years** | ✅ Completed | 2026-08-20 | Round 2: `getActiveYearContext` deepened but never wired, event visibility predicate 3x-duplicated, Tiptap extractor 3x-duplicated | Rounds 1-2 fully Refactored (see Module Scan Log) | Covers `convex/academicYears.ts`, `calendarEvents.ts`, YearSwitcher |
| **7. Extracurricular Programs** | ✅ Completed | 2026-08-19 | Serial roster hydration & separate program/enrollment query calls | Both Candidate 1 (`getProgramDetail`) & Candidate 2 (`enrollProgram`) Refactored | Covers `convex/extracurricularPrograms.ts` and program UI |
| **8. Reports & Analytics** | ✅ Completed | 2026-08-20 | Round 3: fake extraction + 4x-duplicated composite-key join in `buildClassReport` | Rounds 1-3 fully Refactored (see Module Scan Log) | Covers `convex/reports.ts` and academic year reporting UI |
| **9. Shared UI & Components** | 🟦 Pending | - | TBD | Not Started | Covers `src/components/ui/`, form wrappers, table components |

*Status Legend: 🟦 Pending | 🟡 In Audit | 🟠 In Refactoring | ✅ Completed | ⚠️ Needs Review*

---

## 📑 Module Scan Log

### 1. Students & Guardians Module
- **Date:** 2026-08-19 (Round 1 & Round 2)
- **Status:** ✅ Completed (Round 1 & Round 2 Refactored)
- **Report Generated:** `architecture-review-students-guardians-round-2.html`
- **Key Findings:**
  1. **Shallow UI Query Waterfalls:** Frontend routes (e.g. `students_.$id.tsx`) execute sequential queries to fetch student -> studentGuardians -> guardian profiles -> guardian contacts.
  2. **Fragmented Enrollment/Promotion Logic:** Student placement and primary class conflict validation were spread across multiple low-level functions (`hasPrimaryClassConflict`, `enrollStudent`, `unenrollStudent`) requiring client-side orchestration.
  3. **Fragmented Multi-Mutation Registration:** Student creation required up to 7 separate mutation calls (student profile, address, sacraments, guardians, contacts, initial enrollment).
  4. **Serial Roster Transfer Conflict Auditing:** Roster transfer queries executed serial N+1 async checks on `hasPrimaryClassConflict`.
- **Refactoring Executed (Round 1 & Round 2):**
  - [x] **Candidate 1 (Round 1):** Deepened `getStudentDetail` query in `convex/students.ts` into a consolidated aggregate (Student + Guardians + Enrollments + Sacraments + Siblings) with zero-filter index querying.
  - [x] **Candidate 2 (Round 1):** Unified Student Enrollment & Promotion Mutation (`assignStudentToClassYear`) with atomic primary class replacement and batch student processing.
  - [x] **Candidate 1 (Round 2):** Unified Composite Student Registration (`createStudentWithProfile`) creating student profile, account, address, sacraments, guardians, contacts, and initial enrollment in a single atomic transaction. Integrated into `students_.create.tsx`.
  - [x] **Candidate 2 (Round 2):** Bulk Index-Optimized Transfer Query (`getEligibleForTransfer`) pre-fetching target academic year classYears into an $O(1)$ conflict lookup set.

---

### 2. Attendance & QR Subsystem
- **Date:** 2026-08-19 (Round 1 & Round 2)
- **Status:** ✅ Completed (Round 1 & Round 2 Refactored)
- **Report Generated:** `architecture-review-attendance-round-2.html`
- **Key Findings:**
  1. **Repetitive Check-In Resolution (Round 1):** `resolveSession`, `resolveAcademicYearId`, and `resolveStudentClassId` were invoked repeatedly across mutations.
  2. **Serial Grid Hydration (Round 1):** `getAttendanceGrid` performed serial lookups over `studentClasses`, `students`, and `classSessions`.
  3. **Scattered Conflict & Sync Rules (Round 2 Candidate 1):** Offline QR First-Write-Wins (LWW) conflict logic was hardcoded in `recordBatch` loop while single check-in used conflicting error checks.
  4. **N+1 Queries in Bulk Grid Saves (Round 2 Candidate 2):** `bulkSaveGridAttendance` iterated over student IDs executing individual index queries per student.
- **Refactoring Executed:**
  - [x] **Candidate 1 (Round 1):** Unified Session Check-In & Resolution Subsystem (`resolveCheckInContext` & `upsertAttendanceRecord`)
  - [x] **Candidate 2 (Round 1):** Optimized Attendance Grid Hydration Seam (`getAttendanceGrid` parallel batching & alphabetical sorting)
  - [x] **Candidate 1 (Round 2):** Unified Conflict Reconciliation Engine (`reconcileAttendanceRecord` in `convex/lib/attendance.ts` encapsulating LWW timestamp reconciliation & soft-delete reactivation)
  - [x] **Candidate 2 (Round 2):** Bulk Attendance Grid Engine (`bulkSaveGridAttendance` single indexed read by session + in-memory lookup map)
- **Key Findings (Round 3):**
  1. **Fake Extraction — Seam Bypassed:** `saveGridAttendance` and `bulkSaveGridAttendance` never called `reconcileAttendanceRecord`; each reimplemented insert/patch/soft-delete with drifted fields (bulk silently dropped `notes`), leaving 3 divergent attendance-write code paths instead of 1.
  2. N+1 one level down: `resolveStudentClassId` ran per-student inside `bulkSaveGridAttendance`'s loop.
  3. `reconcileAttendanceRecord`'s optional `mode` (default `'overwrite'`) hid a 3-way branch; now that Candidate 1 gives all 3 modes real distinct callers, the hidden default itself is the remaining risk.
- **Refactoring Executed (Round 3):**
  - [x] **Candidate 1 (Round 3):** Extended `reconcileAttendanceRecord` with a `status: AttendanceStatus | null` soft-delete branch and an optional `existing` pre-fetch param (so batch callers keep their single indexed read instead of re-querying per record); routed `saveGridAttendance` and `bulkSaveGridAttendance` through it in `overwrite` mode, deleting their hand-rolled insert/patch/soft-delete logic. All 3 attendance writers now share one seam.
  - [x] **Candidate 2 (Round 3):** Added `resolveStudentClassIdsBatch` — one indexed query over `studentClasses.by_class_year_id` for the common grid case (session tied to a `classYearId`), replacing N per-student indexed queries; falls back to the existing per-student `resolveStudentClassId` for parish-wide sessions with no `classYearId`. Wired into `bulkSaveGridAttendance`.
  - [x] **Candidate 3 (Round 3):** Made `reconcileAttendanceRecord`'s `mode` a required parameter (removed the `'overwrite'` default) — all 4 call sites already passed it explicitly, so the branch is no longer hidden behind a default.
- **Report Generated:** `architecture-review-attendance-round-3.html`



---

### 3. Classes, Sessions & Photobooth
- **Date:** 2026-08-19 (Round 1 & Round 2)
- **Status:** ✅ Completed (Round 1 & Round 2 Refactored)
- **Report Generated:** `architecture-review-classes-round-2.html`
- **Key Findings:**
  1. **Class Detail Query Waterfalls (Round 1):** UI routes (`classes_.$id.tsx`) perform separate queries for class metadata, classYear, assigned catechists, and student counts.
  2. **Client-Side Schedule Generation (Round 1):** Recurring session dates were computed on the client side, sending large arrays over the network.
  3. **Photobooth Roster Over-Fetching (Round 2 Candidate 1):** Photobooth UI (`classes.$id.photobooth.tsx`) loaded heavy sacrament tables & catechist assignments via `getClassDetails` when capturing profile photos.
  4. **N+1 Query Fan-Out in Session Overview (Round 2 Candidate 2):** `listMySessionsInRange` executed up to 4N serial database queries per session in date range and scattered session completion math across UI components.
- **Refactoring Executed:**
  - [x] **Candidate 1 (Round 1):** Consolidated Class Detail Aggregate (`getClassDetails` parallel batching & alphabetical student sorting)
  - [x] **Candidate 2 (Round 1):** Session Schedule Generator & Bulk Creation Subsystem (`generateClassSessionsForSemester` backend schedule generator with idempotent date skipping)
  - [x] **Candidate 1 (Round 2):** Dedicated Photobooth Roster Query (`getPhotoboothRoster` with backend missing-photo pre-sorting and zero sacrament lookups)
  - [x] **Candidate 2 (Round 2):** Batch-Hydrated Session Overview Engine (`listMySessionsInRange` O(1) batch lookup hydration & pure `calculateSessionProgress` domain seam in `convex/lib/classSessionHelpers.ts`)



---

### 4. Grading & Assignments Subsystem
- **Date:** 2026-08-19 (Round 1 & Round 2)
- **Status:** ✅ Completed (Round 1 & Round 2 Refactored)
- **Report Generated:** `architecture-review-grading-round-2.html`
- **Key Findings:**
  1. **Scattered Grade Weighting Math (Round 1):** Column weight calculations, scale conversions, and semester average formulas were duplicated across UI boards.
  2. **Full Table Scans in Assignments Matrix (Round 1):** `listYearAssignments` executed unindexed full table scans for catechists, branches, and classYears.
  3. **Divergent Calculation Engines (Round 2 Candidate 1):** Frontend (`src/lib/grading.ts`) and backend (`gradingHelpers.ts`) used mismatched policies for missing scores and non-numeric scales.
  4. **Sequential RPC Waterfalls in Evaluation Saves (Round 2 Candidate 2):** `EvaluationsBoard` executed client-side loops saving semester and annual results via up to 90 separate RPC calls.
- **Refactoring Executed:**
  - [x] **Candidate 1 (Round 1):** Pure Grade Calculation Subsystem (`calculateWeightedSemesterGrade` in `convex/lib/gradingHelpers.ts`)
  - [x] **Candidate 2 (Round 1):** Year Assignments Matrix Optimization (`listYearAssignments` indexed lookups & parallel assigned catechist resolution)
  - [x] **Candidate 1 (Round 2):** Unified Server & Client Grade Calculation Engine (`GradingEngine` in `convex/lib/gradingEngine.ts` consolidating scale conversions, pass/fail thresholds, and missing score policy)
  - [x] **Candidate 2 (Round 2):** Atomic Batch Evaluation Pipeline (`batchSaveEvaluations` single RPC request with pre-fetched enrollment validation & atomic transaction patches)
- **Key Findings (Round 3):**
  1. **Dead Pass/Fail Branch (Live Bug):** `GradingEngine.computeSemesterGrade`'s `hasPassedAllPassFail` computed from `scoreValue >= 1`, but every real caller (`score-grid-board.tsx`, `batchSaveEvaluations`) stores pass_fail results only in `scoreLabel: 'pass' | 'fail'`, never `scoreValue` — so the branch always short-circuited true. Only the engine's own tests (which hand-constructed `scoreValue` for pass_fail items) exercised the intended behavior; production could never fail a student on a failed pass_fail exam.
  2. **Unused Interface Surface (Candidate 2):** `isPassed`/`hasPassedAllPassFail`/`letterGrade` on `SemesterGradeResult` had zero production callers outside `gradingHelpers.ts`'s `calculateWeightedSemesterGrade`, which itself has zero production callers — only tests. Score-grid-board rendered pass/fail badges independently of the engine, with no semester-level verdict shown.
  3. **Speculative — third average path:** ruled out risk not investigated further; not pursued.
- **Refactoring Executed (Round 3):**
  - [x] **Candidate 1 (Round 3):** Added `scoreLabel?: 'pass' | 'fail' | string` to `ScoreItemInput`; changed `hasPassedAllPassFail` to check `scoreLabel !== 'fail'` instead of `scoreValue >= 1`, matching how real callers actually record pass_fail results. Rewrote `gradingEngine.test.ts`'s pass_fail cases to construct data via `scoreLabel` (the real interface shape) instead of `scoreValue`, plus added pass/ungraded coverage.
  - [x] **Candidate 2 (Round 3):** Added `computeSemesterGrade` to `src/lib/grading.ts` (thin wrapper returning the full `SemesterGradeResult`, alongside the existing average-only `computeSemesterAvg`). Wired into `score-grid-board.tsx`: replaced the number-only `semesterAvgByStudent` memo with a `semesterGradeByStudent` memo carrying the full result (also now passing `scoreLabel` into the exam records, which the avg-only path never needed); the avg map is now derived from it. Semester-average cells get a red ring + tooltip (`exams.grid.semesterFailedPassFail`, added to both locale files) when `hasPassedAllPassFail` is false, closing the gap where a failed pass_fail exam was invisible at the semester-summary level. Added `computeSemesterGrade` test coverage in `src/lib/grading.test.ts`.
- **Report Generated:** `architecture-review-grading-round-3.html`



---

### 5. Catechists & Access Control Subsystem
- **Date:** 2026-08-19 (Round 1 & Round 2)
- **Status:** ✅ Completed (Round 1 & Round 2 Refactored)
- **Report Generated:** `architecture-review-catechists-round-2.html`
- **Key Findings:**
  1. **Fragmented Profile Queries (Round 1):** Frontend components queried profile, address, contacts, and class assignments through separate calls.
  2. **Split Account Provisioning (Round 1):** Catechist profile creation and login account registration were split into uncoordinated mutation steps.
  3. **Fragmented Catechist Edit API (Round 2 Candidate 1):** Edit operations were split into 5 separate mutations (`update`, `upsertMyAddress`, `addContact`, `updateContact`, `deleteContact`) forcing complex client-side array diffing.
  4. **Missing Assignment Invariants (Round 2 Candidate 2):** `updateClassAssignments` lacked homeroom exclusivity validation per academic year, risking dual homeroom assignments across classes.
- **Refactoring Executed:**
  - [x] **Candidate 1 (Round 1):** Consolidated Catechist Profile Aggregate (`getCatechistDetail` parallel profile, address, contacts, and account status query)
  - [x] **Candidate 2 (Round 1):** Atomic Catechist Provisioning & Account Creation Mutation (`createCatechistWithAccount` / `createWithDetails` with E.164 phone normalization)
  - [x] **Candidate 1 (Round 2):** Atomic Catechist Edit Mutation (`updateWithDetails` with contact array diffing, address upserting, & E.164 phone normalization)
  - [x] **Candidate 2 (Round 2):** Homeroom Exclusivity & Assignment Invariant Engine (`updateClassAssignments` enforcing single active homeroom assignment per catechist per academic year)



---

### 6. Calendar & Academic Years Subsystem
- **Date:** 2026-08-19 (Round 1), 2026-08-20 (Round 2)
- **Status:** ✅ Completed (Round 1 & Round 2 fully Refactored)
- **Report Generated:** `architecture-review-calendar.html`, `architecture-review-calendar-round-2.html`
- **Key Findings (Round 1):**
  1. **Multiple Active Year Queries:** UI components (e.g. `year-switcher.tsx`) perform separate query calls (`getActive`, `listSemesters`, `listRecent`) to build navigation context.
  2. **Unbatched Calendar Event Enrichment:** `enrichEvents` in `calendarEvents.ts` sequentially resolves branch and class names for calendar display.
- **Key Findings (Round 2):**
  1. **Deepened Interface Never Wired:** `getActiveYearContext` (round 1) had no production callers — only the unit test used it; `AcademicYearProvider`, `useInactiveYear`, and `YearSwitcher` still fired 4 separate live queries.
  2. **Event Visibility Predicate Duplicated 3x:** the same catechist-scope boolean reimplemented across `list`, `get`, and `getEnriched` in `calendarEvents.ts`.
  3. **Tiptap Plain-Text Extractor Copy-Pasted 3x:** byte-identical recursive walker defined independently across `calendar.tsx`, `calendar-events.tsx`, and `upcoming-events-widget.tsx`.
- **Refactoring Executed:**
  - [x] **Candidate 1 (Round 1):** Consolidated Academic Year Context Aggregate (`getActiveYearContext` active year, ordered semesters, and recent selectable years query)
  - [x] **Candidate 2 (Round 1):** Scoped Calendar Event Enriched Query (`getEnriched` single event detail query with full scope permission checks)
  - [x] **Candidate 1 (Round 2):** Wired `getActiveYearContext` into `AcademicYearProvider` and `YearSwitcher` (replacing `getActive`+`list` and `listRecent` respectively); `useInactiveYear` left on its own `get` query since it resolves an arbitrary selected year, not the active one. `limit` made optional-uncapped (omitted → all years) so the provider's stale-selection check no longer needs a second query.
  - [x] **Candidate 2 (Round 2):** Extracted `isCalendarEventVisible` predicate into `convex/lib/authz.ts` (alongside the pre-existing, semantically-distinct `matchesCalendarEventScope` write-permission check), wired into `list`, `get`, and `getEnriched`; admin/board early-outs preserved so unnecessary `perms` fetches are still skipped.
  - [x] **Candidate 3 (Round 2):** Moved `extractPlainText` to `src/lib/richtext.ts` (matching `src/lib/romcal.ts` convention), imported into `calendar.tsx`, `calendar-events.tsx`, and `upcoming-events-widget.tsx`; added `src/lib/richtext.test.ts` (new standalone unit-testable module, 100% line coverage).

---

### 7. Extracurricular Programs Subsystem
- **Date:** 2026-08-19
- **Status:** 🟡 In Audit
- **Report Generated:** `architecture-review-programs.html`
- **Key Findings:**
  1. **Serial Roster Hydration:** Participant enrollment lookups for program detail views execute serial queries for student/catechist records.
  2. **Fragmented Program & Enrollment Queries:** Admin program pages require separate query calls to fetch program metadata and enrollment lists.
- **Refactoring Executed:**
  - [x] **Candidate 1:** Consolidated Program Details & Roster Aggregate (`getProgramDetail` with parallel student/catechist participant roster hydration)
  - [x] **Candidate 2:** Atomic Program Enrollment with Capacity Guard (`enrollProgram` index check optimization & idempotent soft-delete reactivation)

---

### 8. Reports & Analytics Subsystem
- **Date:** 2026-08-19 (Round 1), 2026-08-20 (Round 2 & Round 3)
- **Status:** ✅ Completed (Round 1, Round 2, Round 3 Candidate 1 Refactored)
- **Report Generated:** `architecture-review-reports.html`, `architecture-review-reports-round-2.html`, `architecture-review-reports-round-3.html`
- **Key Findings (Round 1):**
  1. **Fragmented Dashboard Queries:** Board analytics dashboards execute 4 separate backend queries (`getEnrollmentStats`, `getAttendanceStats`, `getGradesStats`, `getStaffingStats`) across multiple historical academic years.
  2. **Zero-Denominator Handling:** Zero-session or empty score scenarios require safe `null` percentage math to render clean "No Data" states in UI charts.
- **Key Findings (Round 2):**
  1. **`percentage()` Seam Bypassed:** `academicYearReport`'s `overallRate` and `attendanceHistory` rate hand-rolled `Math.round((x/y)*100)` instead of calling the round-1 `percentage()` seam — two divergent implementations of the same rule.
  2. **Shallow 274-Line Handler:** `academicYearReport` does roster, session, attendance, streak, and branch-grouping logic inline with no named function boundaries, unlike sibling `academicYearComparison`.
  3. **N+1 Student Lookup:** Serial `ctx.db.get` per student inside a `for` loop survived round 1's `Promise.all` fan-out conversion.
  4. **Hidden Two-Mode Contract:** `computeAttendanceRate` silently branches its statistical definition on presence/absence of an optional map parameter.
- **Refactoring Executed:**
  - [x] **Candidate 1 (Round 1):** Consolidated Executive Dashboard Aggregate (`getAcademicYearOverview` parallel multi-year enrollment, attendance, grades, and staffing query)
  - [x] **Candidate 2 (Round 1):** Zero-Denominator Safe Math Seam (`percentage` pure math helper in `convex/lib/statsHelpers.ts` with non-finite and zero-denominator guards)
  - [x] **Candidate 1 (Round 2):** Routed `academicYearReport`'s `overallRate` and `attendanceHistory` rate through the existing `percentage()` seam, removing the two hand-rolled duplicates.
  - [x] **Candidate 2 (Round 2):** Extracted `buildClassReport(ctx, cy)` from the 274-line handler; folded in Candidate 3's fix (serial student `ctx.db.get` loop replaced with `Promise.all`) since it lived inside the same extracted block.
  - [x] **Candidate 3 (Round 2):** Parallelized serial student lookup — done as part of Candidate 2's extraction.
  - [x] **Candidate 4 (Round 2):** Split `computeAttendanceRate` into `computeParishAttendanceRate` (no fixed enrollment) and `computeClassAttendanceRate` (required `enrollmentCountBySessionId`), sharing a private `fetchPresentOrLateCounts` helper.
- **Key Findings (Round 3):**
  1. **Fake Extraction:** `buildClassReport` (post round-2 extraction) still juggles 6 concerns behind one interface — deletion test fails, since inlining it back changes nothing structurally.
  2. **Composite-Key Join Duplicated 4x:** the same `${studentClassId}_${sessionId}` map lookup + status comparison re-implemented across overall-rate, sparkline, and streak loops inside `buildClassReport`.
  - Checked and ruled out: no isolated unit tests for round-2 extracted helpers, but they're exercised thoroughly through the real query handlers (`academicYearComparison`, `academicYearReport`) — matches project's real-path-over-mocking testing preference, not a gap.
  - [x] **Candidate 1 (Round 3):** Extracted local `statusFor(enrollment, session)` lookup closure and `isPresentOrLate(status)` predicate inside `buildClassReport`, reused across all 4 sites (overall rate, sparkline, streak check).

---

### [Module Name] *(Template)*
- **Date:** YYYY-MM-DD
- **Key Findings:**
  - Finding 1...
  - Finding 2...
- **Action Items / Refactorings:**
  - [ ] Action item 1
  - [ ] Action item 2
- **Completed PRs / Commits:** N/A

---

*Last Updated: 2026-08-19*
