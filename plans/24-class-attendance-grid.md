# 24: Class Attendance Grid (Excel-like UI)

Implement an experimental Excel-sheet style grid in the Attendance tab of the Class Details page (`classes_.$id.tsx`). The grid features a sticky leftmost column of student information, sticky headers displaying sorted dates grouped by month-year (most recent on the left), and clickable cells that launch popovers to record/update attendance status and notes using standard design system icons and colors.

---

## Phase 0: Documentation Discovery

### 1. Available UI Primitives & Guides
- **UI Styling Guide ([docs/14-ui-styling-guide.md](file:///Users/thanh/Projects/personal/e-catholic-catechist-school/docs/14-ui-styling-guide.md))**:
  - `unset`: Grey (`text-gray-400` / `bg-gray-100`), icon: `Circle`
  - `present`: Green (`text-green-600` / `bg-green-100`), icon: `CheckCircle2`
  - `late`: Yellow (`text-yellow-500` / `bg-yellow-100`), icon: `Clock`
  - `excused_absence`: Purple (`text-purple-500` / `bg-purple-100`), icon: `AlertCircle`
  - `unexcused_absence`: Red (`text-red-500` / `bg-red-100`), icon: `AlertTriangle`
- **Base UI Popover ([popover.tsx](file:///Users/thanh/Projects/personal/e-catholic-catechist-school/src/components/ui/popover.tsx))**:
  - `Popover`, `PopoverTrigger`, `PopoverContent`, `PopoverHeader`, `PopoverTitle`, `PopoverDescription`.
- **Base UI Button ([button.tsx](file:///Users/thanh/Projects/personal/e-catholic-catechist-school/src/components/ui/button.tsx))**:
  - Multi-variant standard buttons.
- **Lucide Icons**: `Circle`, `CheckCircle2`, `Clock`, `AlertCircle`, `AlertTriangle`, `X`, `Save`.

### 2. Allowed APIs
- **Convex Database APIs**: `ctx.db.query`, `ctx.db.insert`, `ctx.db.patch`, `ctx.db.get`.
- **Convex Auth helpers ([authz.ts](file:///Users/thanh/Projects/personal/e-catholic-catechist-school/convex/lib/authz.ts))**:
  - `assertHomeroomCatechistOrAbove`, `assertValidCatechist` for access control checks.
- **Date-fns Library**: `format`, `parseISO` from `date-fns` for robust date grouping and formatting.

### 3. Anti-Patterns to Avoid
- ❌ **Do NOT include parish-scoped sessions** (`mass`, `extracurricular`) in the class attendance grid.
- ❌ **Do NOT use Radix UI**: This project uses Base UI (`@base-ui/react`).
- ❌ **Do NOT make multiple queries for each cell**: Load all students, sessions, and attendance records in a single query `getAttendanceGrid` and build a lookup map on the client.
- ❌ **Do NOT allow interactions on cancelled sessions**: Cancelled sessions should be visually distinct (e.g. diagonal stripes or dimmed/grey status) and disabled.

---

## Phase 1: Backend Implementation

### What to Implement
Add a new query and mutation in [convex/attendance.ts](file:///Users/thanh/Projects/personal/e-catholic-catechist-school/convex/attendance.ts):

1. **`getAttendanceGrid` query**:
   - **Arguments**:
     - `classId`: `v.id('classes')`
     - `academicYearId`: `v.id('academicYears')`
     - `requesterId`: `v.id('catechists')`
   - **Behavior**:
     - Call `assertValidCatechist(ctx, requesterId)`.
     - Fetch the active `classYear` matching `classId` and `academicYearId`.
     - Query all `studentClasses` enrolled in this `classYearId` that are not deleted.
     - Fetch student details for all enrolled students.
     - Query all `classSessions` with `classYearId` matching the class year (not deleted).
     - Sort sessions by `sessionDate` descending (latest date on the left).
     - Fetch active `attendanceRecords` for the retrieved sessions.
     - Build a lookup map of active attendance records where keys are `${studentClassId}_${sessionId}`.
     - Return:
       - `students`: active students list (containing `studentClassId`, `studentId`, `fullName`, `saintName`, `studentCode`).
       - `sessions`: sorted list of sessions (containing `_id`, `sessionDate`, `sessionType`, `isCancelled`, `notes`).
       - `attendanceMap`: `Record<string, { _id: Id<'attendanceRecords'>, status: string, notes?: string }>` for cells lookup.

2. **`saveGridAttendance` mutation**:
   - **Arguments**:
     - `requesterId`: `v.id('catechists')`
     - `sessionId`: `v.id('classSessions')`
     - `studentId`: `v.id('students')`
     - `status`: `v.union(v.literal('present'), v.literal('excused_absence'), v.literal('unexcused_absence'), v.literal('late'), v.null())`
     - `notes`: `v.optional(v.string())`
   - **Behavior**:
     - Retrieve session from database and check permissions via `authCheck`.
     - Resolve the student's enrollment (`studentClassId`) in the class.
     - Query existing `attendanceRecords` for `(sessionId, studentClassId)`.
     - **If status is null (revert/clear to unset)**:
       - If a record exists, mark it as soft-deleted (`isDeleted: true`) and clear notes.
       - If no record exists, do nothing.
     - **If status is provided (e.g. present, late, excused, unexcused)**:
       - If a record exists, patch it with the new `status`, `notes`, `recordedBy`, and reset `isDeleted: false` (to recover from soft-deletion).
       - If no record exists, insert a new record with `deviceQueuedAt: Date.now()`, `syncedAt: Date.now()`, and `isDeleted: false`.

---

## Phase 2: Frontend Implementation

### What to Implement
1. **Translations**:
   - In [en.json](file:///Users/thanh/Projects/personal/e-catholic-catechist-school/src/locales/en.json) and [vi.json](file:///Users/thanh/Projects/personal/e-catholic-catechist-school/src/locales/vi.json), add keys for:
     - `attendance.status.present`, `attendance.status.late`, `attendance.status.excused_absence`, `attendance.status.unexcused_absence`, `attendance.status.unset`
     - Popover text labels: `attendance.popover.title`, `attendance.popover.notesPlaceholder`, `attendance.popover.clearBtn`, `attendance.popover.saveBtn`
2. **Attendance Grid Component**:
   - Locate `TabsContent value="attendance"` in [classes_.$id.tsx](file:///Users/thanh/Projects/personal/e-catholic-catechist-school/src/routes/_authenticated/classes_.$id.tsx).
   - Fetch the grid data using the `getAttendanceGrid` query.
   - Implement the table wrapper with `w-full overflow-auto max-h-[600px] border rounded-lg`.
   - **Sticky Left Column**:
     - Combine the student's **Saint Name** (line 1, smaller font, muted gray text) and **Full Name** (line 2, regular weight) inside a single cell.
     - Style student cells and headers with `sticky left-0 bg-background z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]`.
   - **Sticky Header**:
     - Group columns by month-year using `date-fns` formatting.
     - Header Row 1: Month-Year (e.g., `Tháng 8/2026`) with `colSpan` matching the number of sessions in that month. Sticky top (`sticky top-0 z-30 bg-background`).
     - Header Row 2: Day of Month (e.g., `30`, `23`) and name of day/month. Sticky top (`sticky top-[32px] z-30 bg-background`).
     - Top-left student header cell spans both rows and is sticky left & top (`z-40`).
   - **Attendance Cells**:
     - Render cell background colors matching the status defined in `docs/14-ui-styling-guide.md`.
     - Disable/visually dim cancelled sessions (`isCancelled === true`).
     - Cells contain full-width buttons launching the status selection popover.
     - Show the corresponding status icon in the center of the cell. If status is unset, show a subtle grey circle outline icon on hover.
3. **Status Popover**:
   - Render the Popover for clicked cells.
   - Show Student name and Session Date in popover header.
   - Show 4 buttons for attendance types (with correct icons/colors) + 1 button for unsetting/clearing the record.
   - Include a textarea/input for optional notes.
   - Form submission calls the `saveGridAttendance` mutation and shows a toast notification on completion.

---

## Phase 3: Verification

### Automated Verification
- Create a test file `convex/attendance.grid.test.ts` to verify the `getAttendanceGrid` query and `saveGridAttendance` mutation under various user roles.
- Run the full vitest suite:
  ```bash
  npm test
  ```
- Verify that overall project coverage remains above **75%**.

### Manual Verification
- Open the application and navigate to Class Details -> Attendance.
- Scroll horizontally and check that student columns and headers remain sticky and scrolling cells pass cleanly behind them.
- Click on an unset cell, type a note, select a status (e.g., Late), and verify it updates the cell color and icon correctly.
- Click on the cell again, clear the attendance, and check if it reverts back to the unset state (grey circle).
- Verify that cancelled sessions are styled differently and cannot be edited.
