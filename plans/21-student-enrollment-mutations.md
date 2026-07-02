# 21: Student Enrollment Mutations

Implement backend mutations to manage student enrollment (single/bulk) and status updates (`on_leave` and `withdrawn`), enforcing active Academic Year limitations, role-based authorization checking, and the constraint of having at most one primary class per Academic Year.

---

## Phase 0: Documentation Discovery ✓

### Database Schema (`convex/schema.ts`)

- **`studentClasses`**:
  - `studentId: Id<'students'>`
  - `classYearId: Id<'classYears'>`
  - `isPrimaryClass: boolean`
  - `enrolledDate: string` (ISO format `YYYY-MM-DD`)
  - `status: 'active' | 'on_leave' | 'withdrawn'`
  - `statusChangedDate?: string`
  - `leftDate?: string`
  - `isDeleted: boolean`
  - Indexes:
    - `by_student_id` -> `['studentId']`
    - `by_class_year_id` -> `['classYearId']`
    - `by_student_id_and_class_year_id` -> `['studentId', 'classYearId']`
    - `by_student_id_and_is_primary_class` -> `['studentId', 'isPrimaryClass']`
- **`academicYears`**:
  - `isActive: boolean`
  - `isDeleted: boolean`
- **`classYears`**:
  - `classId: Id<'classes'>`
  - `academicYearId: Id<'academicYears'>`
  - `isDeleted: boolean`
- **`academicYearAssignments`**:
  - `academicYearId: Id<'academicYears'>`
  - `catechistId: Id<'catechists'>`
  - `assignmentType: 'board_member'`
  - `isDeleted: boolean`
- **`branchAssignments`**:
  - `academicYearId: Id<'academicYears'>`
  - `catechistId: Id<'catechists'>`
  - `branchId: Id<'branches'>`
  - `isDeleted: boolean`
- **`classCatechists`**:
  - `catechistId: Id<'catechists'>`
  - `classYearId: Id<'classYears'>`
  - `role: 'homeroom' | 'co_teacher'`
  - `isDeleted: boolean`

### Copy-From References

- **Existing Enrollment logic**: `convex/students.ts:297-385` contains `enrollStudentInClass` which implements single enrollment, basic reactivation, and primary class conflict checking.
- **Authorization assertions**: `convex/lib/authz.ts:34-145` contains `assertBoardMemberOrAdmin`, `assertBranchHeadOrAbove`, and `assertClassCatechistOrAbove` which check roles across various levels of scope.

### Anti-Patterns to Avoid

- ❌ **Do NOT skip the active Academic Year check**: All new enrollments must be strictly rejected if the target class is not part of the active Academic Year.
- ❌ **Do NOT allow multiple active/on-leave primary enrollments**: Enforce that a student has at most 1 primary class enrollment per academic year with a status of `active` or `on_leave`. If they are `withdrawn` (left the class/school), they may enroll in another primary class.
- ❌ **Do NOT execute authorization queries inside loop iterations**: In bulk mutations, check permissions for the target `classYearId` once at the beginning instead of inside the student loop.
- ❌ **Do NOT hardcode error messages**: Use error codes from `convex/lib/errors.ts`.

---

## Phase 1: Convex Backend Implementation

### 1. Error Codes (`convex/lib/errors.ts`)

Add the following error code object to `convex/lib/errors.ts`:
```typescript
export const ENROLLMENT_ERRORS = {
  CLASS_YEAR_NOT_FOUND: 'ENROLLMENT_CLASS_YEAR_NOT_FOUND',
  ACADEMIC_YEAR_NOT_ACTIVE: 'ENROLLMENT_ACADEMIC_YEAR_NOT_ACTIVE',
  ALREADY_ENROLLED: 'ENROLLMENT_ALREADY_ENROLLED',
  PRIMARY_CLASS_CONFLICT: 'ENROLLMENT_PRIMARY_CLASS_CONFLICT',
  RECORD_NOT_FOUND: 'ENROLLMENT_RECORD_NOT_FOUND',
  UNAUTHORIZED: 'ENROLLMENT_UNAUTHORIZED',
} as const
```

### 2. Authorization Helper (`convex/lib/authz.ts`)

Add the authorization assertion `assertEnrollmentPermission`:
- **Args**: `(ctx, requesterId, classYearId)`
- **Behavior**:
  1. Fetch requester's profile using `getBaseCatechist(ctx, requesterId)`.
  2. If `catechist.role === 'admin'`, return `catechist`.
  3. Fetch `classYear`. If not found/deleted, throw error.
  4. Check `academicYearAssignments`: if requester is a `board_member` for `classYear.academicYearId`, return `catechist`.
  5. Fetch `classes` record for `classYear.classId`. If not found/deleted, throw error.
  6. Check `branchAssignments`: if requester is the branch manager/head for `classDoc.branchId` in `classYear.academicYearId`, return `catechist`.
  7. Check `classCatechists`: if requester is assigned to `classYearId` with `role === 'homeroom'`, return `catechist`.
  8. Otherwise, throw an Unauthorized error.

### 3. Student Mutations (`convex/students.ts`)

#### A. New Mutation: `enrollStudents` (Single & Bulk Support)
- **Args**:
  - `requesterId`: `v.id('catechists')`
  - `studentIds`: `v.array(v.id('students'))`
  - `classYearId`: `v.id('classYears')`
  - `isPrimaryClass`: `v.boolean()`
  - `enrolledDate`: `v.string()` (ISO `YYYY-MM-DD`)
- **Handler**:
  1. Validate permission: `await assertEnrollmentPermission(ctx, requesterId, classYearId)`.
  2. Fetch `classYear`. Ensure it exists and is not deleted.
  3. Fetch `academicYear`. Ensure it exists, is not deleted, and `isActive === true`. If not active, throw `ENROLLMENT_ERRORS.ACADEMIC_YEAR_NOT_ACTIVE`.
  4. For each `studentId` in `studentIds`:
     - Fetch student and ensure they exist and are not deleted.
     - Check for an existing enrollment for this `studentId` and `classYearId` (including deleted/withdrawn).
     - **Reactivation Flow** (exists but `isDeleted === true` or `status !== 'active'`):
       - If `isPrimaryClass === true`, check for conflict: find all active/on_leave primary class enrollments for this student in the same `academicYearId`. If any exists (excluding the reactivation target itself), throw `ENROLLMENT_ERRORS.PRIMARY_CLASS_CONFLICT`.
       - Patch the existing record: set `status: 'active'`, `enrolledDate`, `isPrimaryClass`, `isDeleted: false`, `leftDate: undefined`, `statusChangedDate: undefined`.
     - **Already Enrolled Flow** (exists and is active/not-deleted):
       - If `isPrimaryClass` matches the input, throw `ENROLLMENT_ERRORS.ALREADY_ENROLLED`.
       - If different, update `isPrimaryClass`. If changing to `true`, check for conflict in the same academic year and throw `ENROLLMENT_ERRORS.PRIMARY_CLASS_CONFLICT`.
     - **New Enrollment Flow** (does not exist):
       - If `isPrimaryClass === true`, check for conflict: find all active/on_leave primary class enrollments for this student in the same `academicYearId`. If any exists, throw `ENROLLMENT_ERRORS.PRIMARY_CLASS_CONFLICT`.
       - Insert new `studentClasses` record.
  5. Return an array of the `studentClasses` IDs.

#### B. New Mutation: `updateEnrollmentsStatus` (Single & Bulk Status Update)
- **Args**:
  - `requesterId`: `v.id('catechists')`
  - `studentClassIds`: `v.array(v.id('studentClasses'))`
  - `status`: `v.union(v.literal('active'), v.literal('on_leave'), v.literal('withdrawn'))`
  - `statusChangedDate`: `v.string()` (ISO `YYYY-MM-DD`)
- **Handler**:
  1. Loop through `studentClassIds`:
     - Fetch `studentClass` record. If not found or deleted, throw error.
     - Validate permission: `await assertEnrollmentPermission(ctx, requesterId, studentClass.classYearId)`.
     - (Note: Status changes are allowed for past academic years, so we do not check if the academic year is active).
     - Prepare patches:
       - If `status === 'withdrawn'`: set `leftDate: statusChangedDate`.
       - If `status === 'active' || status === 'on_leave'`:
         - Clear `leftDate`.
         - If `isPrimaryClass === true`: check for any *other* active/on_leave primary enrollment in the same academic year for this student, throw if there is a conflict.
       - Patch `status`, `statusChangedDate`, and `leftDate`.

#### C. Refactor Existing: `enrollStudentInClass`
Refactor this existing mutation to call `enrollStudents` logic internally:
```typescript
export const enrollStudentInClass = mutation({
  args: {
    requesterId: v.id('catechists'),
    studentId: v.id('students'),
    classYearId: v.id('classYears'),
    enrolledDate: v.string(),
  },
  handler: async (ctx, args) => {
    const results = await enrollStudentsInternal(ctx, {
      requesterId: args.requesterId,
      studentIds: [args.studentId],
      classYearId: args.classYearId,
      isPrimaryClass: true,
      enrolledDate: args.enrolledDate,
    })
    return results[0]
  },
})
```

---

## Phase 2: Unit Testing

Add test cases in `convex/students.test.ts` to test the new functionality:

1. **Permission Assertions**:
   - Verify `admin` is allowed.
   - Verify `board_member` is allowed.
   - Verify `branch_head` of class branch is allowed.
   - Verify `homeroom` teacher of class year is allowed.
   - Verify `co_teacher` of class year is REJECTED.
   - Verify other catechists are REJECTED.
2. **Active Academic Year**:
   - Verify enrollment is successful when academic year is active.
   - Verify enrollment throws an error when academic year is inactive.
3. **Primary Class Constraints**:
   - Enroll student into a primary class. Verify success.
   - Enroll student into a supplemental class. Verify success.
   - Try to enroll student in a second primary class in the same AY. Verify it throws a conflict error.
   - Withdraw student from the primary class, then enroll in another primary class. Verify success.
   - Put student `on_leave` in the primary class, then try to enroll in another primary class. Verify it throws a conflict error.
4. **Bulk Enrollment**:
   - Bulk enroll multiple students in primary / supplemental classes.
   - Verify transaction rollback (all-or-nothing) if one student has a conflict.
5. **Status Updates**:
   - Mark enrollment as `on_leave` / `withdrawn`. Verify status and dates.

---

## Verification Checklist

### Automated Verification
- Run vitest suite:
  ```bash
  npx vitest run convex/students.test.ts
  ```
- Run full test coverage:
  ```bash
  npm test -- --coverage
  ```
  Ensure statement/branch/function/line coverage remains above 75%.
