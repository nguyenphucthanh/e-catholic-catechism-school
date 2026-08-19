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
| **2. Attendance & QR** | ✅ Completed | 2026-08-19 | Repetitive session/enrollment resolution across mutations & serial grid hydration | Both Candidate 1 (`resolveCheckInContext`) & Candidate 2 (`getAttendanceGrid`) Refactored | Covers `convex/attendance*.ts` and attendance UI grid |
| **3. Classes & Photobooth** | ✅ Completed | 2026-08-19 | Client-side query waterfalls, recurring session dates & photobooth roster over-fetching | Round 1 & 2 Refactored (`getClassDetails`, `generateClassSessionsForSemester`, `getPhotoboothRoster`, `listMySessionsInRange`) | Covers `convex/classes.ts`, `classSessions.ts`, photobooth route |
| **4. Grading & Assignments** | ✅ Completed | 2026-08-19 | Scattered grade weighting math & full table scans in assignments matrix | Both Candidate 1 (`calculateWeightedSemesterGrade`) & Candidate 2 (`listYearAssignments`) Refactored | Covers `convex/grading.ts`, `assignments.ts`, evaluation UI |
| **5. Catechists & Auth** | ✅ Completed | 2026-08-19 | Fragmented profile/contact queries, split account creation & 5-mutation profile edit API | Round 1 & 2 Refactored (`getCatechistDetail`, `createCatechistWithAccount`, `updateWithDetails`, `updateClassAssignments`) | Covers `convex/catechists.ts`, `accountAdmin.ts`, `assignments.ts`, auth flow |
| **6. Calendar & Academic Years** | ✅ Completed | 2026-08-19 | Multiple academic year / semester queries & unbatched event enrichment | Both Candidate 1 (`getActiveYearContext`) & Candidate 2 (`getEnriched`) Refactored | Covers `convex/academicYears.ts`, `calendarEvents.ts`, YearSwitcher |
| **7. Extracurricular Programs** | ✅ Completed | 2026-08-19 | Serial roster hydration & separate program/enrollment query calls | Both Candidate 1 (`getProgramDetail`) & Candidate 2 (`enrollProgram`) Refactored | Covers `convex/extracurricularPrograms.ts` and program UI |
| **8. Reports & Analytics** | ✅ Completed | 2026-08-19 | Fragmented dashboard queries & repetitive multi-year fetches | Both Candidate 1 (`getAcademicYearOverview`) & Candidate 2 (`percentage` Pure Seam) Refactored | Covers `convex/reports.ts` and academic year reporting UI |
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
- **Date:** 2026-08-19
- **Status:** 🟡 In Audit
- **Report Generated:** `architecture-review-attendance.html`
- **Key Findings:**
  1. **Repetitive Check-In Resolution:** `resolveSession`, `resolveAcademicYearId`, and `resolveStudentClassId` are invoked repeatedly across single check-in, bulk check-in, and QR mutations.
  2. **Serial Grid Hydration:** `getAttendanceGrid` performs serial lookups over `studentClasses`, `students`, and `classSessions` before assembling attendance maps.
- **Refactoring Executed:**
  - [x] **Candidate 1:** Unified Session Check-In & Resolution Subsystem (`resolveCheckInContext` & `upsertAttendanceRecord`)
  - [x] **Candidate 2:** Optimized Attendance Grid Hydration Seam (`getAttendanceGrid` parallel batching & alphabetical sorting)

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
- **Date:** 2026-08-19
- **Status:** 🟡 In Audit
- **Report Generated:** `architecture-review-grading.html`
- **Key Findings:**
  1. **Scattered Grade Weighting Math:** Column weight calculations, scale conversions (`scale_10`, `pass_fail`, `letter_af`), and semester average formulas are duplicated across UI score boards and report exports.
  2. **Full Table Scans in Assignments Matrix:** `listYearAssignments` collects unindexed full table scans for catechists, branches, and classYears before grouping.
- **Refactoring Executed:**
  - [x] **Candidate 1:** Pure Grade Calculation Subsystem (`calculateWeightedSemesterGrade` in `convex/lib/gradingHelpers.ts`)
  - [x] **Candidate 2:** Year Assignments Matrix Optimization (`listYearAssignments` indexed lookups & parallel assigned catechist resolution)

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
- **Date:** 2026-08-19
- **Status:** 🟡 In Audit
- **Report Generated:** `architecture-review-calendar.html`
- **Key Findings:**
  1. **Multiple Active Year Queries:** UI components (e.g. `year-switcher.tsx`) perform separate query calls (`getActive`, `listSemesters`, `listRecent`) to build navigation context.
  2. **Unbatched Calendar Event Enrichment:** `enrichEvents` in `calendarEvents.ts` sequentially resolves branch and class names for calendar display.
- **Refactoring Executed:**
  - [x] **Candidate 1:** Consolidated Academic Year Context Aggregate (`getActiveYearContext` active year, ordered semesters, and recent selectable years query)
  - [x] **Candidate 2:** Scoped Calendar Event Enriched Query (`getEnriched` single event detail query with full scope permission checks)

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
- **Date:** 2026-08-19
- **Status:** 🟡 In Audit
- **Report Generated:** `architecture-review-reports.html`
- **Key Findings:**
  1. **Fragmented Dashboard Queries:** Board analytics dashboards execute 4 separate backend queries (`getEnrollmentStats`, `getAttendanceStats`, `getGradesStats`, `getStaffingStats`) across multiple historical academic years.
  2. **Zero-Denominator Handling:** Zero-session or empty score scenarios require safe `null` percentage math to render clean "No Data" states in UI charts.
- **Refactoring Executed:**
  - [x] **Candidate 1:** Consolidated Executive Dashboard Aggregate (`getAcademicYearOverview` parallel multi-year enrollment, attendance, grades, and staffing query)
  - [x] **Candidate 2:** Zero-Denominator Safe Math Seam (`percentage` pure math helper in `convex/lib/statsHelpers.ts` with non-finite and zero-denominator guards)

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
