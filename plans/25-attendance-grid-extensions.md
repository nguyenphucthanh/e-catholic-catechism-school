# 25: Attendance Grid Extensions

Extend the `AttendanceGridBoard` to support cancelled date visibility toggle, date order controls, and date header cell actions.

---

## Phase 0: Documentation Discovery

### 1. Available UI Primitives & Guides
- **Base UI Popover ([popover.tsx](file:///Users/thanh/Projects/personal/e-catholic-catechist-school/src/components/ui/popover.tsx))**:
  - `Popover`, `PopoverTrigger`, `PopoverContent`, `PopoverHeader`, `PopoverTitle`, `PopoverDescription`.
- **Shadcn Dialog Confirmation**:
  - The project uses `AlertDialog` components for confirmations (e.g. in `src/routes/_authenticated/classes_.$id.tsx` lines 365-398).
- **Lucide Icons**:
  - `Eye`, `EyeOff`, `ArrowUpDown`, `Settings`, `MoreVertical`, `Calendar`, `Edit`, `Trash2`, `CheckSquare`, `XSquare`, `AlertTriangle`.
- **Convex Auth Helpers ([authz.ts](file:///Users/thanh/Projects/personal/e-catholic-catechist-school/convex/lib/authz.ts))**:
  - `assertHomeroomCatechistOrAbove`, `assertValidCatechist` for permission checks.

### 2. Allowed APIs
- **Convex Backend APIs**:
  - `ctx.db.query`, `ctx.db.patch`, `ctx.db.insert`, `ctx.db.get`.
  - Existing `convex/classSessions.ts` functions: `update` and `softDelete`.
  - Existing `convex/attendance.ts` functions: `saveGridAttendance`.

### 3. Anti-Patterns to Avoid
- ❌ **Do NOT use Radix UI**: This project uses Base UI (`@base-ui/react`).
- ❌ **Do NOT run queries/mutations in a loop in frontend code**: Perform bulk marking or unsetting of attendance on the backend in a single mutation transaction rather than sending multiple network requests in a loop.
- ❌ **Do NOT allow mutating class sessions of inactive academic years**: Check that academic year is active before saving updates.

---

## Phase 1: Backend Implementation

### What to Implement
Add a new mutation in `convex/attendance.ts` for bulk grid operations:

1. **`bulkSaveGridAttendance` mutation**:
   - **Arguments**:
     - `requesterId`: `v.id('catechists')`
     - `sessionId`: `v.id('classSessions')`
     - `studentIds`: `v.array(v.id('students'))`
     - `status`: `v.union(v.literal('present'), v.literal('excused_absence'), v.literal('unexcused_absence'), v.literal('late'), v.null())`
   - **Behavior**:
     - Retrieve session from database and check permissions via `authCheck` and active year check.
     - For each student:
       - Resolve enrollment `studentClassId`.
       - Query existing `attendanceRecords` for `(sessionId, studentClassId)`.
       - If status is `null` (revert/clear to unset):
         - Soft delete the record if it exists and is active (`isDeleted: true`).
       - If status is provided:
         - Patch existing record (set status, reset `isDeleted: false`) or insert a new record.

### Verification Checklist
- [ ] Add tests to `convex/attendance.grid.test.ts` to verify `bulkSaveGridAttendance` functions correctly under different roles.
- [ ] Confirm tests pass by running `npm test`.

---

## Phase 2: Translation Updates

### What to Implement
Update translation files `src/locales/en.json` and `src/locales/vi.json`:

1. **English translations (`en.json`)**:
   ```json
   "attendance.grid.toolbar.showCancelled": "Show Cancelled",
   "attendance.grid.toolbar.hideCancelled": "Hide Cancelled",
   "attendance.grid.toolbar.sortOrder": "Sort Order",
   "attendance.grid.toolbar.newestFirst": "Newest First",
   "attendance.grid.toolbar.oldestFirst": "Oldest First",
   "attendance.session.popover.title": "Session Actions",
   "attendance.session.popover.dateLabel": "Session Date",
   "attendance.session.popover.notesLabel": "Session Notes",
   "attendance.session.actions.cancel": "Cancel Session",
   "attendance.session.actions.restore": "Restore Session",
   "attendance.session.actions.delete": "Delete Session",
   "attendance.session.actions.markAllPresent": "Mark All Present",
   "attendance.session.actions.clearAll": "Clear All Attendance",
   "attendance.session.confirm.cancelTitle": "Cancel Class Session?",
   "attendance.session.confirm.cancelDesc": "Are you sure you want to cancel this session? All student attendance cells will be disabled.",
   "attendance.session.confirm.deleteTitle": "Delete Class Session?",
   "attendance.session.confirm.deleteDesc": "Are you sure you want to delete this session entirely? This action cannot be undone.",
   "attendance.session.confirm.bulkTitle": "Bulk Update Attendance?",
   "attendance.session.confirm.bulkDesc": "Are you sure you want to update attendance status for all students in this session?"
   ```

2. **Vietnamese translations (`vi.json`)**:
   ```json
   "attendance.grid.toolbar.showCancelled": "Hiện buổi nghỉ",
   "attendance.grid.toolbar.hideCancelled": "Ẩn buổi nghỉ",
   "attendance.grid.toolbar.sortOrder": "Thứ tự ngày",
   "attendance.grid.toolbar.newestFirst": "Mới nhất trước",
   "attendance.grid.toolbar.oldestFirst": "Cũ nhất trước",
   "attendance.session.popover.title": "Thao tác buổi học",
   "attendance.session.popover.dateLabel": "Ngày học",
   "attendance.session.popover.notesLabel": "Ghi chú buổi học",
   "attendance.session.actions.cancel": "Hủy buổi học",
   "attendance.session.actions.restore": "Khôi phục buổi học",
   "attendance.session.actions.delete": "Xóa buổi học",
   "attendance.session.actions.markAllPresent": "Điểm danh tất cả Có mặt",
   "attendance.session.actions.clearAll": "Xóa điểm danh tất cả",
   "attendance.session.confirm.cancelTitle": "Hủy buổi học này?",
   "attendance.session.confirm.cancelDesc": "Bạn có chắc chắn muốn hủy buổi học này? Tất cả ô điểm danh học viên sẽ bị vô hiệu hóa.",
   "attendance.session.confirm.deleteTitle": "Xóa buổi học này?",
   "attendance.session.confirm.deleteDesc": "Bạn có chắc chắn muốn xóa hoàn toàn buổi học này? Hành động này không thể hoàn tác.",
   "attendance.session.confirm.bulkTitle": "Cập nhật điểm danh hàng loạt?",
   "attendance.session.confirm.bulkDesc": "Bạn có chắc chắn muốn cập nhật trạng thái điểm danh cho tất cả học viên trong buổi học này?"
   ```

---

## Phase 3: Frontend Implementation

### What to Implement
Update `src/components/custom/attendance-grid-board.tsx`:

1. **Toolbar Panel**:
   - Add state: `showCancelled` (boolean, default `true`), `dateOrder` (`'asc' | 'desc'`, default `'desc'`).
   - Create a toolbar container above the table card, aligned to the right:
     - Use a flex container (`flex justify-end gap-2 mb-4`).
     - Render buttons:
       - **Show/Hide Cancelled** (Button with `Eye`/`EyeOff` icon).
       - **Sort Order Toggle** (Button with `ArrowUpDown` icon displaying current order text).
   - Adjust `sessionsByMonth` computed value based on the states:
     - Filter out sessions where `session.isCancelled === true` if `showCancelled === false`.
     - Sort all active sessions according to `dateOrder`.

2. **Date Header Cell actions Popover**:
   - When clicking on the date number/name cell in the table header, trigger a Popover:
     - Header text showing formatting of the session date.
     - Input fields to update the Date (`sessionDate`) and Notes (`notes`).
     - Button actions list:
       - Mark all present / Clear all attendance (calls the new `bulkSaveGridAttendance` mutation).
       - Cancel/Restore session (calls `api.classSessions.update` mutation).
       - Delete session (calls `api.classSessions.softDelete` mutation).
   - Show loading/saving state spinner inside the popover or buttons.

3. **Confirmation Dialogs**:
   - Setup a shared generic confirmation `AlertDialog` state in `AttendanceGridBoard` to handle cancel, delete, and bulk actions confirmations, showing appropriate titles/descriptions from translation files.

---

## Phase 4: Verification

### 1. Automated Tests
- Update `src/components/custom/attendance-grid-board.test.tsx` to cover:
  - Toggling cancelled sessions visibility (assert correct number of columns).
  - Sorting dates ascending and descending (assert column order).
  - Header actions popover: trigger fields modification, cancels, deletions, and bulk marking operations.
- Ensure test coverage remains >= 75%.

### 2. Manual Verification
- Verify toolbar button functions correctly and doesn't trigger scroll errors.
- Confirm dialog warnings display properly when canceling, deleting, or bulk updating a session.
- Ensure the header popover updates the backend state instantly and triggers successful sonner toast notifications.
