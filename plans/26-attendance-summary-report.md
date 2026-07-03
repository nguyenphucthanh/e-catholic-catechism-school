# 26: Class Attendance Summary Report

Build a class attendance summary report showing per-student attendance rate and status breakdown. It will stay in the Class Details page -> Attendance tab, as a sub-tab/toggle next to the Excel-like Grid View.

---

## Phase 0: Documentation Discovery

### 1. Available UI Primitives & Guides
- **Base UI Tabs ([tabs.tsx](file:///Users/thanh/Projects/personal/e-catholic-catechist-school/src/components/ui/tabs.tsx))**:
  - `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` for sub-navigation.
- **Card, Table, Progress, Badge, Dropdown Select**:
  - Available standard components in `src/components/ui/`.
- **Lucide Icons**:
  - `CheckCircle2`, `Clock`, `AlertCircle`, `AlertTriangle`, `Circle`, `ListFilter`, `Search`.
- **Convex Auth Helpers ([authz.ts](file:///Users/thanh/Projects/personal/e-catholic-germany-catechist-school/convex/lib/authz.ts))**:
  - `assertValidCatechist` for query validation.

### 2. Allowed APIs
- **Convex Database APIs**:
  - `ctx.db.query`, `ctx.db.get` for reading semesters.
- **getAttendanceGrid query ([attendance.ts](file:///Users/thanh/Projects/personal/e-catholic-catechist-school/convex/attendance.ts))**:
  - Returns `students`, `sessions`, and `attendanceMap` for the class.

### 3. Anti-Patterns to Avoid
- ❌ **Do NOT use Radix UI**: This project uses Base UI (`@base-ui/react`).
- ❌ **Do NOT store computed values**: Calculate attendance rate and counts on the fly using `getAttendanceGrid` data.
- ❌ **Do NOT run queries in loops**: Fetch all semesters for the academic year in a single query.

---

## Phase 1: Backend Updates

### What to Implement
1. **Modify `getAttendanceGrid` query** in [convex/attendance.ts](file:///Users/thanh/Projects/personal/e-catholic-catechist-school/convex/attendance.ts):
   - Include `semesterId` in the returned session objects:
     ```typescript
     sessions: activeSessions.map((s) => ({
       _id: s._id,
       sessionDate: s.sessionDate,
       sessionType: s.sessionType,
       isCancelled: s.isCancelled,
       notes: s.notes,
       semesterId: s.semesterId, // Add this field
     }))
     ```

2. **Add `listSemesters` query** in [convex/academicYears.ts](file:///Users/thanh/Projects/personal/e-catholic-catechist-school/convex/academicYears.ts):
   - **Arguments**:
     - `requesterId`: `v.id('catechists')`
     - `academicYearId`: `v.id('academicYears')`
   - **Behavior**:
     - Call `assertValidCatechist(ctx, requesterId)`.
     - Query semesters using `by_academic_year_id_and_semester_number` index and filter out deleted ones.

### Verification Checklist
- [ ] Verify query returns semesters correctly in a new test case.
- [ ] Run `npm test` to ensure vitest suite passes.

---

## Phase 2: Translation Updates

### What to Implement
Update translation files `src/locales/en.json` and `src/locales/vi.json`:

1. **English translations (`en.json`)**:
   ```json
   "attendance.tabs.grid": "Grid View",
   "attendance.tabs.summary": "Summary Report",
   "attendance.summary.searchPlaceholder": "Search student name or code...",
   "attendance.summary.allSemesters": "All Semesters",
   "attendance.summary.rate": "Attendance Rate",
   "attendance.summary.present": "Present",
   "attendance.summary.late": "Late",
   "attendance.summary.excused": "Excused",
   "attendance.summary.unexcused": "Unexcused",
   "attendance.summary.unset": "Unset",
   "attendance.summary.totalSessions": "Total Sessions",
   "attendance.summary.averageRate": "Class Avg Rate",
   "attendance.summary.perfectAttendance": "Perfect Attendance"
   ```

2. **Vietnamese translations (`vi.json`)**:
   ```json
   "attendance.tabs.grid": "Bảng điểm danh",
   "attendance.tabs.summary": "Báo cáo tổng hợp",
   "attendance.summary.searchPlaceholder": "Tìm tên hoặc mã học viên...",
   "attendance.summary.allSemesters": "Tất cả học kỳ",
   "attendance.summary.rate": "Tỷ lệ chuyên cần",
   "attendance.summary.present": "Có mặt",
   "attendance.summary.late": "Đi trễ",
   "attendance.summary.excused": "Vắng có phép",
   "attendance.summary.unexcused": "Vắng không phép",
   "attendance.summary.unset": "Chưa điểm danh",
   "attendance.summary.totalSessions": "Tổng số buổi học",
   "attendance.summary.averageRate": "Tỷ lệ TB lớp",
   "attendance.summary.perfectAttendance": "Đi học đầy đủ"
   ```

---

## Phase 3: Frontend Implementation

### What to Implement
1. **Create `AttendanceSummaryReport` Component** at [attendance-summary-report.tsx](file:///Users/thanh/Projects/personal/e-catholic-catechist-school/src/components/custom/attendance-summary-report.tsx):
   - Accept props: `classId`, `academicYearId`, `requesterId`.
   - Query `api.attendance.getAttendanceGrid` and `api.academicYears.listSemesters`.
   - Implement filters:
     - **Semester Filter**: Dropdown select. Defaults to "All Semesters". When selected, filters sessions.
     - **Search Filter**: Input text to search by student code or name.
   - **Calculations (scoped to selected semester, excluding cancelled sessions)**:
     - Count active/non-cancelled sessions $S$.
     - For each student:
       - Count statuses: Present ($P$), Late ($L$), Excused ($E$), Unexcused ($U$), Unset ($N$).
       - Attendance Rate: $\text{Rate} = \frac{P + L}{S} \times 100\%$ (display as `—` if $S = 0$).
   - **Top Cards Panel** (Wow aesthetics):
     - **Total Sessions**: $S$
     - **Average Class Attendance Rate**: Average rate of all students.
     - **Perfect Attendance**: Number & % of students with rate = 100%.
   - **Main Report Table**:
     - Columns: Student Name & Code, Attendance Rate (with colored badges), Present, Late, Excused Absence, Unexcused Absence, Unset.
     - Rate colors:
       - $\ge 90\%$: Green (`bg-emerald-500/10 text-emerald-500 border-emerald-500/20`)
       - $80\% - 89\%$: Yellow (`bg-amber-500/10 text-amber-500 border-amber-500/20`)
       - $< 80\%$: Red (`bg-destructive/10 text-destructive border-destructive/20`)

2. **Integrate Sub-tabs in Class Details Page** at [classes_.$id.tsx](file:///Users/thanh/Projects/personal/e-catholic-catechist-school/src/routes/_authenticated/classes_.$id.tsx):
   - Modify the `attendance` tab content.
   - Add a `<Tabs defaultValue="grid">` container.
   - Add sub-triggers:
     - `<TabsTrigger value="grid">{t('attendance.tabs.grid')}</TabsTrigger>`
     - `<TabsTrigger value="summary">{t('attendance.tabs.summary')}</TabsTrigger>`
   - Render `<AttendanceGridBoard>` inside `<TabsContent value="grid">`.
   - Render `<AttendanceSummaryReport>` inside `<TabsContent value="summary">`.

---

## Phase 4: Verification

### 1. Automated Tests
- Create `src/components/custom/attendance-summary-report.test.tsx`:
  - Verify calculations (Rate, Present, Late, Excused, Unexcused, Unset counts).
  - Verify search query filters the students list correctly.
  - Verify semester filter correctly updates counts & rates.
- Target test coverage: **>= 75%**.

### 2. Manual Verification
- Navigate to the Attendance tab on a class detail page.
- Switch between **Grid View** and **Summary Report**.
- Change student attendance statuses in Grid View, switch to Summary Report, and verify counts and rates update instantly.
- Select different semesters from the dropdown and verify the sessions counts and rates adjust correctly.
