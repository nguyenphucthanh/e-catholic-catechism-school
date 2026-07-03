# 28: Class Score Grid and Evaluations

Implement a grading and evaluations dashboard under the "Score & Exams" tab of the Class Details page (`classes_.$id.tsx`). The section will be split into two sub-tabs: "Exams & Scores" (Excel-like grid of student scores with audit trail history) and "Evaluations" (form-like table to enter morality grades and qualitative teacher remarks for semester and annual evaluations). Also, build an exam creation page where catechists can enter scores for all students in one go.

---

## Phase 0: Documentation Discovery

### 1. Available UI & Grading Schema Primitives
- **Grading Schema ([docs/schema/05-grading.md](file:///Users/thanh/Projects/personal/e-catholic-catechist-school/docs/schema/05-grading.md))**:
  - `scoreColumns`: `classYearId`, `semesterId`, `columnName`, `columnType` (`short_quiz` / `midterm_test` / `semester_exam`), `scaleType` (`scale_10` / `pass_fail` / `letter_af`), `sortOrder`.
  - `scoreEntries`: `studentClassId`, `scoreColumnId`, `scoreValue` (for `scale_10`), `scoreLabel` (for `pass_fail` or `letter_af`).
  - `scoreEntryHistories`: `scoreEntryId`, `oldScoreValue`, `newScoreValue`, `oldScoreLabel`, `newScoreLabel`, `changedBy`, `changedAt`, `reason`.
  - `semesterResults`: `studentClassId`, `semesterId`, `morality` (`excellent` / `good` / `average` / `below_average` / `poor`), `teacherNote`, `isCompleted`.
  - `annualResults`: `studentClassId`, `conductGrade` (`excellent` / `good` / `average` / `below_average` / `poor`), `remark`, `isCompleted`.
- **UI Styling Guide ([docs/14-ui-styling-guide.md](file:///Users/thanh/Projects/personal/e-catholic-catechist-school/docs/14-ui-styling-guide.md))**:
  - Popovers, Dialogs, Selects, textareas, and alerts from `src/components/ui/`.
- **Lucide Icons**: `GraduationCap`, `Search`, `Plus`, `Trash2`, `Settings`, `History`, `User`, `Clock`.

### 2. Allowed APIs
- **Convex Database APIs**: `ctx.db.query`, `ctx.db.insert`, `ctx.db.patch`, `ctx.db.get`, and query index bindings.
- **Convex Auth helpers ([authz.ts](file:///Users/thanh/Projects/personal/e-catholic-catechist-school/convex/lib/authz.ts))**:
  - `assertHomeroomCatechistOrAbove`, `assertValidCatechist` for access control checks.

### 3. Anti-Patterns to Avoid
- ❌ **Do NOT hand-edit base UI components**: Always customize logic and layout at call sites, not in `src/components/ui/`.
- ❌ **Do NOT use Radix UI**: This project uses Base UI (`@base-ui/react`).
- ❌ **Do NOT perform individual query calls per student cell**: Fetch all students, columns, and entries in one grid query to ensure clean, fast, batch-state rendering.

---

## Phase 1: Backend Implementation

### What to Implement
Update and add mutations and queries in [convex/grading.ts](file:///Users/thanh/Projects/personal/e-catholic-catechist-school/convex/grading.ts):

1. **`assertHomeroomCatechistOrAbove` Permission Migration**:
   - Refactor `createScoreColumn`, `updateScoreColumn`, and `softDeleteScoreColumn` to assert homeroom catechist permission (`assertHomeroomCatechistOrAbove`) rather than strict administrator role.
   - Resolve `academicYearId` dynamically from `classYearId` in these functions.

2. **`upsertScoreEntry` Audit Trait Updates**:
   - Accept optional `reason: v.optional(v.string())` argument.
   - When inserting `scoreEntryHistories` on updates, write the provided `reason`.

3. **`listScoreEntryHistory` Populater**:
   - Populate `changedByName` by fetching `saintName` and `fullName` of the catechist (`changedBy`) and returning it with the history items.

4. **`getScoresGrid` query**:
   - **Arguments**:
     - `classId`: `v.id('classes')`
     - `academicYearId`: `v.id('academicYears')`
     - `requesterId`: `v.id('catechists')`
   - **Behavior**:
     - Fetch the active `classYear` matching `classId` and `academicYearId`.
     - Fetch active `studentClasses` (not deleted) enrolled in this class.
     - Fetch student details for all enrolled students.
     - Fetch active `scoreColumns` for this class year.
     - Fetch active `scoreEntries` for these columns and build a lookup map where keys are `${studentClassId}_${scoreColumnId}`.
     - Return:
       - `students`: array of `{ studentClassId, studentId, fullName, saintName, studentCode }`
       - `scoreColumns`: array of active columns `{ _id, semesterId, columnName, columnType, scaleType, sortOrder }`
       - `scoreEntriesMap`: map of `${studentClassId}_${scoreColumnId}` to `{ _id, scoreValue, scoreLabel, enteredBy, enteredAt, updatedAt }`.

5. **`createColumnWithScores` mutation**:
   - **Arguments**:
     - `requesterId`: `v.id('catechists')`,
     - `classYearId`: `v.id('classYears')`,
     - `semesterId`: `v.id('semesters')`,
     - `columnName`: `v.string()`,
     - `columnType`: `v.union(v.literal('short_quiz'), v.literal('midterm_test'), v.literal('semester_exam'))`,
     - `scaleType`: `v.optional(v.union(v.literal('scale_10'), v.literal('pass_fail'), v.literal('letter_af')))`,
     - `sortOrder`: `v.optional(v.number())`,
     - `scores`: array of `{ studentId: v.id('students'), scoreValue?: v.number(), scoreLabel?: v.string() }`
   - **Behavior**:
     - Validate academic year isActive and assert homeroom permission.
     - Insert `scoreColumns` document.
     - Resolve `studentClassId` for each student in class year, and insert `scoreEntries` records.

---

## Phase 2: Seeding Logic

### What to Implement
Add a seed mutation in [convex/seed.ts](file:///Users/thanh/Projects/personal/e-catholic-catechist-school/convex/seed.ts):

1. **`seedExamForTest` mutation**:
   - Get class ID `mx7566ze3ysmnavbm1er9dqzcd89r26x`. If the class year or student classes do not exist in the active academic year:
     - Find active academic year and active semester.
     - Ensure a ClassYear exists.
     - Enroll at least 2 mock students if no students are present.
   - Seed one `ScoreColumn` (e.g. "Chúa nhật 15 - Điểm đầu năm", type: `short_quiz`, scale: `scale_10`).
   - Seed score entries (`ScoreEntry`) with random mock numbers (e.g. `8.0`, `9.5`) for all enrolled students.

---

## Phase 3: Frontend Score Board and Creation Page

### What to Implement

1. **Sub-Tabs inside `classes_.$id.tsx` -> Exams tab**:
   - Render a sub-tabs layout containing:
     - "Exams & Scores" sub-tab.
     - "Evaluations" sub-tab.

2. **`ScoreGridBoard` component (`src/components/custom/score-grid-board.tsx`)**:
   - Implement semester selector and student search inputs.
   - Display student names sticky on the left, and list of exams sticky on the top.
   - **Header exam actions Popover**:
     - Edit Exam details (name, type, scale, sort order).
     - Delete exam column (soft delete `ScoreColumn`) with an `AlertDialog` confirmation.
   - **Score cell update Popover**:
     - Score entry mode depending on column's `scaleType`:
       - `scale_10`: number input 0.0 - 10.0.
       - `pass_fail`: button toggles ("Đạt" / "Không đạt").
       - `letter_af`: free text input (e.g. A+, B-).
     - Require a text field for update "Reason".
     - Display a timeline/history section inside the popover fetching history logs using the `listScoreEntryHistory` query (showing changed at, changed by, changes, and reasons).
   - "Create Exam" button routing to `/classes/$id/exams/create`.

3. **`classes_.$id_.exams_.create.tsx` page**:
   - Form parameters: exam name, exam type, scale type, semester, sort order.
   - Render student list with score entry fields matching the selected `scaleType`.
   - Implement a sticky bottom layout containing search input (to filter/find students), a Cancel button, and a Save button.
   - Form submission calls `createColumnWithScores` mutation.

4. **`EvaluationsBoard` component (`src/components/custom/evaluations-board.tsx`)**:
   - Tab showing evaluations (`SemesterResult` and `AnnualResult`).
   - Table of students. Columns:
     - Semester 1: Morality select box, Teacher note input, completed checkbox.
     - Semester 2: Morality select box, Teacher note input, completed checkbox.
     - Annual: Conduct grade select box, Remark input, completed checkbox.
   - A single "Save Evaluations" button at the top/bottom that batches modifications to DB.

---

## Phase 4: Verification

### Automated Verification
- Write unit tests in `convex/grading.test.ts` for the new `getScoresGrid` query, `createColumnWithScores` mutation, permission assertions, and history logging.
- Run `npm test` to verify everything builds and passes.

### Manual Verification
- Run `npx convex dev` and execute the seeding mutation `seedExamForTest` via dashboard or terminal.
- Load local app and navigate to Class -> tab Exams -> check score grid and evaluations.
- Test updating scores with reasons and verify history logs display.
- Create a new exam with student scores and check if it successfully appends to the grid board.
