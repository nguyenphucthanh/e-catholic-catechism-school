# 27: Create Class Session and Attendance Log Page

Build an all-in-one "Create Class Session and Log Attendance" page that allows catechists/teachers to create a new class-scoped session and log attendance for all active students in a single flow. Additionally, add a Sunday notification Alert and a redirect button to the class details attendance board.

---

## Phase 0: Documentation Discovery

### 1. Available UI Primitives & Guides
- **Base UI & Radix UI Rules**:
  - ❌ **Do NOT use Radix UI**: This project uses Base UI (`@base-ui/react`).
  - **Button, Card, Input, Textarea, Alert, Badge**: Available standard components in `src/components/ui/`.
- **Lucide Icons**:
  - `CheckCircle2` (Có mặt), `Clock` (Trễ), `AlertCircle` (Vắng), `AlertTriangle` (Vắng có phép), `Search`, `Plus`, `ChevronLeft`.
- **Convex Auth Helpers ([authz.ts](file:///Users/thanh/Projects/personal/e-catholic-germany-catechist-school/convex/lib/authz.ts))**:
  - `assertHomeroomCatechistOrAbove` to authorize class session management.

### 2. Allowed APIs
- **Convex Database APIs**:
  - `ctx.db.insert`, `ctx.db.get`, `ctx.db.patch`, `ctx.db.query`.
- **listSemesters query ([academicYears.ts](file:///Users/thanh/Projects/personal/e-catholic-catechist-school/convex/academicYears.ts))**:
  - Used to fetch available semesters for the active academic year.
- **getClassDetails query ([classes.ts](file:///Users/thanh/Projects/personal/e-catholic-catechist-school/convex/classes.ts))**:
  - Retrieves active students and class details.

### 3. Anti-Patterns to Avoid
- ❌ **Do NOT make multiple database mutations in a loop**: Save the new session and all attendance records in a single atomic Convex mutation (`createWithAttendance`).
- ❌ **Do NOT write manual CSS**: Use Tailwind classes for positioning, transitions, and layout. Avoid Tailwind overrides in CSS files.
- ❌ **Do NOT hand-edit files in `src/components/ui/`**: Make all adjustments at call sites.

---

## Phase 1: Backend Updates

### What to Implement
1. **Add `createWithAttendance` mutation** in [convex/classSessions.ts](file:///Users/thanh/Projects/personal/e-catholic-catechist-school/convex/classSessions.ts):
   - **Arguments**:
     - `requesterId`: `v.id('catechists')` [required]
     - `classYearId`: `v.id('classYears')` [required]
     - `semesterId`: `v.id('semesters')` [required]
     - `sessionDate`: `v.string()` (ISO format YYYY-MM-DD) [required]
     - `sessionType`: `v.union(v.literal('catechism'), v.literal('supplemental'))` [required]
     - `notes`: `v.optional(v.string())`
     - `attendance`: `v.array(v.object({ studentId: v.id('students'), status: v.union(v.literal('present'), v.literal('excused_absence'), v.literal('unexcused_absence'), v.literal('late')), notes: v.optional(v.string()) }))` [required]
   - **Behavior**:
     - Verify active academic year and active semester.
     - Call `assertHomeroomCatechistOrAbove(ctx, requesterId, academicYearId, classYearId)`.
     - Insert session into `classSessions` table.
     - Loop through `attendance` items:
       - Resolve `studentClassId` using `studentId` and `classYearId`.
       - Verify student is active and enrolled in the class.
       - Insert attendance record in `attendanceRecords` table.
     - Return the created session ID.

2. **Add unit tests** in [convex/classSessions.test.ts](file:///Users/thanh/Projects/personal/e-catholic-catechist-school/convex/classSessions.test.ts):
   - Test successful creation of session + bulk attendance.
   - Test permission guards (e.g. failure when a co-teacher or non-homeroom catechist tries to manage without proper rights, if applicable).
   - Test invalid academic year or semester constraints.

### Verification Checklist
- [ ] Run backend tests: `npx convex dev` + `npm test` to ensure vitest suite succeeds.

---

## Phase 2: Translation Updates

### What to Implement
Update translation files `src/locales/en.json` and `src/locales/vi.json`:

1. **English translations (`en.json`)**:
   ```json
   "attendance.createSession.title": "Create Class Session & Log Attendance",
   "attendance.createSession.success": "Class session and attendance recorded successfully",
   "attendance.createSession.date": "Session Date",
   "attendance.createSession.type": "Session Type",
   "attendance.createSession.semester": "Semester",
   "attendance.createSession.notes": "Session Notes / Topic",
   "attendance.createSession.searchPlaceholder": "Find student by name or code...",
   "attendance.createSession.submit": "Save & Record Attendance",
   "attendance.createSession.confirmLeaveTitle": "Discard changes?",
   "attendance.createSession.confirmLeaveDesc": "You have unsaved attendance inputs. Are you sure you want to discard them?",
   "attendance.createSession.summary": "Summary: {{total}} total, {{present}} present, {{late}} late, {{absent}} absent, {{excused}} excused",
   "attendance.grid.toolbar.createSession": "New Session",
   "attendance.grid.sundayAlert": "Today is Sunday and no class sessions are logged for today.",
   "attendance.grid.sundayAlertAction": "Create Session Now"
   ```

2. **Vietnamese translations (`vi.json`)**:
   ```json
   "attendance.createSession.title": "Tạo Buổi Học & Điểm Danh",
   "attendance.createSession.success": "Đã tạo buổi học và ghi nhận điểm danh thành công",
   "attendance.createSession.date": "Ngày học",
   "attendance.createSession.type": "Loại buổi học",
   "attendance.createSession.semester": "Học kỳ",
   "attendance.createSession.notes": "Nội dung / Ghi chú buổi học",
   "attendance.createSession.searchPlaceholder": "Tìm học viên theo tên hoặc mã...",
   "attendance.createSession.submit": "Lưu buổi học & Điểm danh",
   "attendance.createSession.confirmLeaveTitle": "Hủy bỏ thay đổi?",
   "attendance.createSession.confirmLeaveDesc": "Bạn có thông tin điểm danh chưa được lưu. Bạn có chắc muốn rời đi?",
   "attendance.createSession.summary": "Tổng số: {{total}} | Có mặt: {{present}} | Đi trễ: {{late}} | Vắng: {{absent}} | Phép: {{excused}}",
   "attendance.grid.toolbar.createSession": "Thêm buổi học",
   "attendance.grid.sundayAlert": "Hôm nay là Chủ Nhật và chưa có buổi học nào được tạo cho ngày hôm nay.",
   "attendance.grid.sundayAlertAction": "Tạo buổi học ngay"
   ```

---

## Phase 3: Frontend Implementation

### What to Implement

1. **Create Router Page** at [classes_.$id_.sessions_.create.tsx](file:///Users/thanh/Projects/personal/e-catholic-catechist-school/src/routes/_authenticated/classes_.$id_.sessions_.create.tsx):
   - **Path**: `/classes/$id/sessions/create`
   - **Crumbs**:
     - `classes.title` (`/classes`)
     - `classes.detail.title` (`/classes/$id`)
     - `attendance.createSession.title` (Current Page)
   - **Data Fetching**:
     - Call `api.classes.getClassDetails` with `classId = id` and active academic year.
     - Call `api.academicYears.listSemesters` using `academicYearId`.
   - **State Management**:
     - Form fields: `sessionDate` (string, defaults to today's date), `semesterId` (string, defaults to first semester), `sessionType` (defaults to `catechism`), `notes` (string, optional).
     - Attendance record state: Map of `studentId` to `{ status: 'present' | 'late' | 'unexcused_absence' | 'excused_absence', notes: string }`.
     - Initial state: Pre-select status to `'present'` for all students to speed up registration.
   - **Confirmation Dialog**:
     - Track a `isDirty` flag (set to true when date/notes change or a student status deviates from `'present'`).
     - Render an `AlertDialog` warning when the user clicks the "Back" button or triggers router navigation while `isDirty` is true.

2. **Build Smart Attendance Switch Component**:
   - For each student row:
     - Left part: Saint Name (*italicized*, smaller) + Full Name (bold/medium).
     - Right part: Display a color-coded status icon (e.g. green box with checkmark for present).
     - Hover/Click transition:
       - On clicking the right box, it expands horizontally (using Tailwind transition e.g., `transition-all duration-300 ease-in-out` or absolute position overlay) to slide over and reveal 4 distinct action options:
         1. **Có mặt** (Green background `#bbf7d0`, text `#15803d`, icon `CheckCircle2`)
         2. **Trễ** (Yellow background `#fef08a`, text `#a16207`, icon `Clock`)
         3. **Vắng** (Red background `#fca5a5`, text `#b91c1c`, icon `AlertCircle`)
         4. **Vắng có phép** (Purple background `#e9d5ff`, text `#6b21a8`, icon `AlertTriangle`)
       - Clicking one of the options sets the student's status, collapses the panel back, and recalculates the top summary counts.

3. **Sticky Search Footer**:
   - Render a footer bar with class `fixed bottom-0 left-0 right-0 z-50 p-4 border-t bg-background/80 backdrop-blur-md shadow-lg flex items-center gap-4`.
   - Left: An input field with search icon and placeholder "Tìm học viên theo tên hoặc mã...".
   - Right: "Lưu buổi học & Điểm danh" button.
   - Filtering logic: Dynamically filter student items by comparing the search text query with:
     - Student Full Name (`fullName.toLowerCase()`)
     - Student Saint Name (`saintName.toLowerCase()`)
     - Student Code (`studentCode.toLowerCase()`)
   - Ensure the outer scrollable container has `pb-24` style to prevent student cards from being hidden under the footer.

4. **Integrate Alerts in Grid Board** at [attendance-grid-board.tsx](file:///Users/thanh/Projects/personal/e-catholic-catechist-school/src/components/custom/attendance-grid-board.tsx):
   - **Sunday Check**:
     - Check if today is Sunday: `const isSunday = new Date().getDay() === 0`.
     - Check if today has no session:
       ```typescript
       const todayStr = format(new Date(), 'yyyy-MM-dd')
       const hasTodaySession = gridData.sessions.some(s => s.sessionDate === todayStr && !s.isDeleted)
       ```
     - If `isSunday` is true AND `hasTodaySession` is false AND `canManage` is true:
       - Show a warning `Alert` at the top of the grid with description: `attendance.grid.sundayAlert` and a button link `attendance.grid.sundayAlertAction` pointing to the `/classes/$id/sessions/create` route.
   - **Generic Toolbar Button**:
     - If `canManage` is true, render a "Thêm buổi học" button in the top-right toolbar next to filter buttons.

---

## Phase 4: Verification

### 1. Automated Tests
- Create unit tests for `/classes/$id/sessions/create` route to verify:
  - Form submission payload correctness.
  - Quick filter filtering correctly as queries change.
  - Status switch transitions and state changes.
  - Leave confirmation blocker behaviors.

### 2. Manual Verification
- Navigate to Class Details > Attendance Tab.
- Verify the permanent "Thêm buổi học" button in the grid toolbar.
- Simulate/Check on Sunday: verify the alert displays and the CTA button redirects correctly.
- Fill out the date, select semester, type, and add notes.
- Use the fixed search bar to filter. Modify student attendance statuses.
- Submit the form, verify redirection back to the class details page, and ensure the grid reflects the newly logged session.
