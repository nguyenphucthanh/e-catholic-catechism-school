# 22: Student Enrollment Dialog

Implement a keyboard-driven dialog component to enroll students into a class, supporting both single and bulk enrollment modes. The dialog will default to Bulk mode, support client-side search by name/code, display active enrollment badges, and be integrated directly into the Class Details page.

---

## Phase 0: Documentation Discovery

### 1. Database Schema Reference (`convex/schema.ts`)
- **`students`**:
  - `studentCode: v.string()`
  - `fullName: v.string()`
  - `saintName: v.optional(v.string())`
  - `isActive: v.boolean()`
  - `isDeleted: v.boolean()`
- **`studentClasses`** (Enrollment record):
  - `studentId: Id<'students'>`
  - `classYearId: Id<'classYears'>`
  - `isPrimaryClass: boolean`
  - `enrolledDate: string` (`YYYY-MM-DD`)
  - `status: 'active' | 'on_leave' | 'withdrawn'`
  - `isDeleted: boolean`

### 2. Available Components & Patterns
- **Base UI Dialog**: Wrap form using pattern in [dialog.tsx](file:///Users/thanhnguyen/Projects/Personal/e-catholic-catechism-school/src/components/ui/dialog.tsx).
- **Base UI Combobox**: Use multi-select (chips) and single-select Combobox components in [combobox.tsx](file:///Users/thanhnguyen/Projects/Personal/e-catholic-catechism-school/src/components/ui/combobox.tsx).
- **React Form Library**: Use `@tanstack/react-form` following fields style in [class-form.tsx:151-200](file:///Users/thanhnguyen/Projects/Personal/e-catholic-catechism-school/src/components/forms/class-form.tsx#L151-L200).
- **Convex Mutations**: Existing `api.students.enrollStudents` and `api.students.enrollStudentInClass` in [students.ts:331-456](file:///Users/thanhnguyen/Projects/Personal/e-catholic-catechism-school/convex/students.ts#L331-L456).

### 3. Allowed APIs
- Query: `ctx.db.query('students')` with index `by_is_deleted` and filter/sort in memory.
- Query: `ctx.db.query('studentClasses')` with index `by_class_year_id` or `by_student_id`.
- Mutate: `ctx.db.insert('studentClasses', ...)` and `ctx.db.patch('studentClasses', ...)` via existing functions.

### 4. Anti-Patterns to Avoid
- ❌ **Do NOT use Radix UI imports (`@radix-ui/*`)**: Use wrappers in `~/components/ui/` built on `@base-ui/react`.
- ❌ **Do NOT skip the `items` prop in `<Combobox>` or `<Select>`**: Base UI requires passing `items` to the root primitive for values to display in the trigger/value label.
- ❌ **Do NOT use `data-state` attributes in Tailwind**: Use `data-open` and `data-closed` for transitions.
- ❌ **Do NOT write native HTML tags**: Use wraps like `<Field>`, `<FieldLabel>`, and `<FieldError>` from `~/components/ui/field`.

---

## Phase 1: Convex Backend Implementation

### What to Implement
Add a query `getEligibleForEnrollment` to [students.ts](file:///Users/thanhnguyen/Projects/Personal/e-catholic-catechism-school/convex/students.ts):
- **Arguments**:
  - `requesterId`: `v.id('catechists')`
  - `academicYearId`: `v.id('academicYears')`
- **Behavior**:
  1. Authorize: `await assertValidCatechist(ctx, args.requesterId)`.
  2. Fetch all active, non-deleted students from `students` table.
  3. Fetch all active (non-deleted) `studentClasses` (enrollments) for classes in the current `academicYearId`.
     - *Hint*: Fetch `classYears` for the `academicYearId` first, then find all non-deleted `studentClasses` for those `classYearId`s.
  4. For each student, find their active enrollment (if any) in the current academic year.
  5. Return list of students. For each student, include:
     - Student doc (`_id`, `studentCode`, `fullName`, `saintName`, etc.)
     - Enrollment info: `enrolledClassYearId`, `className` (e.g. "Khai Tâm 1"), `isPrimaryClass`, `status`.

### Verification Checklist
- Run typechecking: `npx tsc --noEmit`
- Verify backend builds successfully.

---

## Phase 2: Frontend Enrollment Dialog Component

### What to Implement
Create a new file [enrollment-dialog.tsx](file:///Users/thanhnguyen/Projects/Personal/e-catholic-catechism-school/src/components/forms/enrollment-dialog.tsx).
1. **Dialog Scaffold**:
   - Wrap in `<Dialog>` and `<DialogContent>`.
   - Take `classYearId` and `className` (of the current class page being viewed) as props.
2. **Tabs Component**:
   - Provide "Bulk" (hàng loạt) and "Single" (cá nhân) tabs, defaulting to **Bulk**.
3. **TanStack Form Setup**:
   - Default Values:
     - `studentIds`: `[]` (array in Bulk mode, single element/string in Single mode).
     - `enrolledDate`: Today's local date (`new Date().toLocaleDateString('sv-SE')` which returns `YYYY-MM-DD`).
     - `isPrimaryClass`: `true`.
4. **Student Selection (Combobox)**:
   - Load students using `useQuery(api.students.getEligibleForEnrollment, { requesterId, academicYearId })`.
   - Client-side search: Filter list items matching student's `fullName` or `studentCode` (case-insensitive substring).
   - Dropdown item rendering:
     - Show `fullName` (or format names using `formatPersonName(saintName, fullName)`).
     - Show `studentCode`.
     - If student already has an active primary enrollment in another class, render a badge: `Enrolled in [Class X]` (Đang học [Class X]) and **disable** selection.
   - **Bulk Mode Selection Flow**:
     - Wrap in `Combobox` with `multiple` prop, using `ComboboxChips` and `ComboboxChip`.
     - When an item is selected, the input value should be cleared and focus must remain on the search input for consecutive entry.
5. **Form Controls**:
   - Date picker `<Input type="date">` for `enrolledDate`.
   - Checkbox for `isPrimaryClass` (Ghi danh lớp chính).
6. **Keyboard Navigation & Accessibility**:
   - Focus the combobox input on dialog mount.
   - Support `Ctrl+Enter` or `Cmd+Enter` anywhere in the form to trigger submit.
7. **Submit Handling**:
   - Call `api.students.enrollStudents` mutation.
   - Show Sonner success or error toast. Close dialog on success.

### References
- Dialog anatomy: [catechist-contact-dialog-form.tsx:50-130](file:///Users/thanhnguyen/Projects/Personal/e-catholic-catechism-school/src/components/forms/catechist-contact-dialog-form.tsx#L50-L130)
- Combobox items pattern: [combobox.tsx](file:///Users/thanhnguyen/Projects/Personal/e-catholic-catechism-school/src/components/ui/combobox.tsx)

---

## Phase 3: Page Integration

### What to Implement
Modify [classes_.$id.tsx](file:///Users/thanhnguyen/Projects/Personal/e-catholic-catechism-school/src/routes/_authenticated/classes_.$id.tsx):
1. **Render Button**:
   - In the "Students" tab content, next to the search input or above the DataTable, add an "Enroll Student" (Ghi danh học sinh) button.
2. **State Management**:
   - Keep a boolean state `enrollDialogOpen` to control visibility.
3. **Render Dialog**:
   - Insert `<EnrollmentDialog isOpen={enrollDialogOpen} onOpenChange={setEnrollDialogOpen} classYearId={classDetails.classYear._id} className={classDetails.class.name} />` inside the page template.

---

## Phase 4: Unit Testing

### What to Implement
1. **Backend Tests**:
   - Add tests for `getEligibleForEnrollment` in [students.test.ts](file:///Users/thanhnguyen/Projects/Personal/e-catholic-catechism-school/convex/students.test.ts).
   - Test retrieving list of active students.
   - Test retrieving correct enrollment info for students already in a class.
2. **Frontend Tests**:
   - Create [enrollment-dialog.test.tsx](file:///Users/thanhnguyen/Projects/Personal/e-catholic-catechism-school/src/components/forms/enrollment-dialog.test.tsx).
   - Render the dialog and mock Convex queries/mutations.
   - Test changing tabs (Single/Bulk).
   - Test keyboard interaction: entering characters in search, pressing enter to select a student, and typing a date.
   - Test submitting form calls mutation with correct parameters.

---

## Phase 5: Verification

### Automated Verification
- Run backend tests:
  ```bash
  npx vitest run convex/students.test.ts
  ```
- Run frontend tests:
  ```bash
  npx vitest run src/components/forms/enrollment-dialog.test.tsx
  ```
- Verify TypeScript is clear of compile errors.

### Manual Verification
1. Navigate to a class details page.
2. Click the "Enroll Student" button.
3. Verify that the Bulk input is focused automatically.
4. Type a student name or code, navigate options with keyboard, and select via Enter.
5. Verify chip is added, input clears, and focus remains in search.
6. Toggle "Primary class" checkbox, verify date is editable.
7. Submit via `Ctrl+Enter` and verify that the table data refreshes.
