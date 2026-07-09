# Permission Matrix

> **See also**: [Auth & Access Control](03-auth-access-control.md) for authentication flow and role definitions.

## Role Hierarchy

| Role | Source | Scope |
|------|--------|-------|
| **admin** | `catechists.role = 'admin'` | System-wide, all operations, all academic years |
| **board_member** | `academicYearAssignments.assignmentType = 'board_member'` | Per academic year; full operations within that AY |
| **branch_head** | `branchAssignments` (catechistId + branchId + academicYearId) | Specific branch(es) within a specific AY |
| **homeroom_catechist** | `classCatechists.role = 'homeroom'` | Specific classYear(s) within a specific AY |
| **co_teacher** | `classCatechists.role = 'co_teacher'` | Same as homeroom for read ops; write differs per object |
| **base_catechist** | Active catechist with `role = 'user'` and no assignments | Read-only on most data; can self-edit profile |
| **student/parent** | `accounts.accountType = 'student'` | Read-only: own profile and enrollment data only |

## Permission Cascade

All authorization helpers in `convex/lib/authz.ts` follow this ladder:

1. `catechist.role === 'admin'` → **GRANT**
2. `academicYearAssignments` (board_member) → **GRANT**
3. `branchAssignments` (branch_head) → **GRANT** (for branch-scoped)
4. `classCatechists` (homeroom/co_teacher) → **GRANT** (for class-scoped)
5. → **DENY**

## Permission Matrix

Symbols: **Y** = Yes, **N** = No, **S** = Self only, **B** = Branch-scoped, **C** = Class-scoped, **O** = Own class only, **F** = Floating records only

### Academic Years (`convex/academicYears.ts`)

| Operation | admin | board_member | branch_head | homeroom | co_teacher | base_catechist | student |
|-----------|-------|-------------|-------------|----------|------------|----------------|---------|
| List | Y | Y | Y | Y | Y | Y | N |
| Get | Y | Y | Y | Y | Y | Y | N |
| Create | **Y** | N | N | N | N | N | N |
| Update | **Y** | N | N | N | N | N | N |
| Delete | **Y** | N | N | N | N | N | N |

### Branches (`convex/branches.ts`)

| Operation | admin | board_member | branch_head | homeroom | co_teacher | base_catechist | student |
|-----------|-------|-------------|-------------|----------|------------|----------------|---------|
| List | Y | Y | Y | Y | Y | Y | N |
| Get | Y | Y | Y | Y | Y | Y | N |
| Create | **Y** | N | N | N | N | N | N |
| Update | **Y** | N | N | N | N | N | N |
| Delete | **Y** | N | N | N | N | N | N |

### Classes (`convex/classes.ts`)

| Operation | admin | board_member | branch_head | homeroom | co_teacher | base_catechist | student |
|-----------|-------|-------------|-------------|----------|------------|----------------|---------|
| List | Y | Y | Y | Y | Y | Y | N |
| Get | Y | Y | Y | Y | Y | Y | N |
| Create | **Y** | N | N | N | N | N | N |
| Update | **Y** | N | N | N | N | N | N |
| Delete | **Y** | N | N | N | N | N | N |

### Catechists (`convex/catechists.ts`)

| Operation | admin | board_member | branch_head | homeroom | co_teacher | base_catechist | student |
|-----------|-------|-------------|-------------|----------|------------|----------------|---------|
| List | Y | Y | Y | Y | Y | Y | N |
| Get | Y | Y | Y | Y | Y | Y | N |
| Get My Profile | Y | Y | Y | Y | Y | Y (S) | N |
| Create | **Y** | N | N | N | N | N | N |
| Update | **Y** | N | N | N | N | N | N |
| Update My Profile | Y (any) | Y (S) | Y (S) | Y (S) | Y (S) | Y (S) | N |
| Delete | **Y** | N | N | N | N | N | N |

### Students (`convex/students.ts`)

| Operation | admin | board_member | branch_head | homeroom | co_teacher | base_catechist | student |
|-----------|-------|-------------|-------------|----------|------------|----------------|---------|
| List | Y | Y | Y | Y | Y | Y | N |
| Get | Y | Y | Y | Y | Y | Y | N |
| Get My Profile | N | N | N | N | N | N | Y (S) |
| Create | Y | Y | Y | Y | Y | Y | N |
| Update | Y | Y (B) | Y (B) | Y (C) | Y (C) | Y (F) | N |
| Enroll | Y | Y | Y | Y | Y | N | N |
| Delete | **Y** | N | N | N | N | N | N |

**Note**: Edit student permission ("floating" = student has no enrollments → any catechist can edit).

### Guardians (`convex/guardians.ts`)

| Operation | admin | board_member | branch_head | homeroom | co_teacher | base_catechist | student |
|-----------|-------|-------------|-------------|----------|------------|----------------|---------|
| Get | Y | Y | Y | Y | Y | Y | N |
| Create | Y | Y | Y | Y | Y | Y | N |
| Update | Y | Y | Y | Y | Y | Y (F) | N |
| Delete | **Y** | N | N | N | N | N | N |
| Link to Student | Y | Y | Y | Y | Y | Y (F) | N |

### Assignments (`convex/assignments.ts`)

| Operation | admin | board_member | branch_head | homeroom | co_teacher | base_catechist | student |
|-----------|-------|-------------|-------------|----------|------------|----------------|---------|
| List | Y | Y | Y | Y | Y | Y | N |
| Manage Board Members | **Y** | Y | N | N | N | N | N |
| Manage Branch Heads | **Y** | Y | N | N | N | N | N |
| Manage Class Assignments | **Y** | Y | N | N | N | N | N |

### Class Sessions (`convex/classSessions.ts`)

| Operation | admin | board_member | branch_head | homeroom | co_teacher | base_catechist | student |
|-----------|-------|-------------|-------------|----------|------------|----------------|---------|
| List | Y | Y | Y | Y | Y | Y | N |
| Get | Y | Y | Y | Y | Y | Y | N |
| Create | Y | Y | Y (B) | Y (O) | Y (O) | N | N |
| Update | Y | Y | Y (B) | Y (O) | Y (O) | N | N |
| Delete | Y | Y | Y (B) | Y (O) | Y (O) | N | N |

### Attendance (`convex/attendance.ts`)

| Operation | admin | board_member | branch_head | homeroom | co_teacher | base_catechist | student |
|-----------|-------|-------------|-------------|----------|------------|----------------|---------|
| View Records | Y | Y | Y | Y | Y | Y | N |
| My Attendance | N | N | N | N | N | N | Y (S) |
| Record (class) | Y | Y | Y (B) | Y (O) | **N** | N | N |
| Record (parish/mass) | Y | Y | Y | Y | Y | Y | N |
| Reports | Y | Y | Y | Y | Y | Y | N |

**Note**: Co_teachers **cannot** record attendance for class-scoped sessions (`assertHomeroomCatechistOrAbove` requires homeroom role). Any active catechist can record parish/mass/extracurricular attendance.

### Grading / Score Columns (`convex/grading.ts`)

| Operation | admin | board_member | branch_head | homeroom | co_teacher | base_catechist | student |
|-----------|-------|-------------|-------------|----------|------------|----------------|---------|
| View Scores | Y | Y | Y | Y | Y | Y | N |
| Create Score Column | Y | Y | Y | Y | **N** | N | N |
| Update Score Column | Y | Y | Y | Y | **N** | N | N |
| Delete Score Column | Y | Y | Y | Y | **N** | N | N |
| Enter Scores | Y | Y | Y | Y | **N** | N | N |
| Semester/Annual Results | Y | Y | Y | Y | **N** | N | N |

**Note**: Co_teachers **cannot** write grades or score columns (requires `assertHomeroomCatechistOrAbove`).

### Calendar Events (`convex/calendarEvents.ts`)

| Operation | admin | board_member | branch_head | homeroom | co_teacher | base_catechist | student |
|-----------|-------|-------------|-------------|----------|------------|----------------|---------|
| List | Y | Y | Y (B) | Y (C) | Y (C) | Y (none) | N |
| Get | Y | Y | Y (B) | Y (C) | Y (C) | Y (none) | N |
| Create | Y (any scope) | Y (board scope) | Y (B scope) | Y (C scope) | Y (C scope) | N | N |
| Update | Y | Y (creator/scope) | Y (creator/scope) | Y (creator/scope) | Y (creator) | N | N |
| Delete | Y | Y (creator/scope) | Y (creator/scope) | Y (creator/scope) | Y (creator) | N | N |

### Student Follow-Up (`convex/studentFollowUp.ts`)

| Operation | admin | board_member | branch_head | homeroom | co_teacher | base_catechist | student |
|-----------|-------|-------------|-------------|----------|------------|----------------|---------|
| View Needing Follow-Up | Y (all) | Y (empty\*) | Y (B) | Y (C) | Y (C) | N | N |

\*Board members get empty results unless they also have branch_head or class assignments — the query only checks `branchHeadOf[]` and `classCatechistOf[]`.

### Organization Stats (`convex/orgStats.ts`)

| Operation | admin | board_member | branch_head | homeroom | co_teacher | base_catechist | student |
|-----------|-------|-------------|-------------|----------|------------|----------------|---------|
| View | Y | Y | N | N | N | N | N |

### Branch Stats (`convex/branchStats.ts`)

| Operation | admin | board_member | branch_head | homeroom | co_teacher | base_catechist | student |
|-----------|-------|-------------|-------------|----------|------------|----------------|---------|
| View | Y (all) | Y (all) | Y (own) | N | N | N | N |

### Account Admin (`convex/accountAdmin.ts`)

| Operation | admin | board_member | branch_head | homeroom | co_teacher | base_catechist | student |
|-----------|-------|-------------|-------------|----------|------------|----------------|---------|
| List Accounts | **Y** | N | N | N | N | N | N |
| Grant Accounts | **Y** | N | N | N | N | N | N |
| Reset Passwords | **Y** | N | N | N | N | N | N |
| Toggle Account Status | **Y** | N | N | N | N | N | N |

### CSV Import (`convex/csvImport.ts`)

| Operation | admin | board_member | branch_head | homeroom | co_teacher | base_catechist | student |
|-----------|-------|-------------|-------------|----------|------------|----------------|---------|
| Check Duplicates | **Y** | N | N | N | N | N | N |
| Bulk Import Students | **Y** | N | N | N | N | N | N |
| Bulk Import Catechists | **Y** | N | N | N | N | N | N |

### App Config (`convex/appConfig.ts`)

| Operation | admin | board_member | branch_head | homeroom | co_teacher | base_catechist | student |
|-----------|-------|-------------|-------------|----------|------------|----------------|---------|
| Get | **Public** (no auth) | | | | | | |
| Update | **Y** | N | N | N | N | N | N |

### Search (`convex/search.ts`)

| Operation | admin | board_member | branch_head | homeroom | co_teacher | base_catechist | student |
|-----------|-------|-------------|-------------|----------|------------|----------------|---------|
| Global Search | Y | Y | Y | Y | Y | Y | N |

## Authorization Helpers (`convex/lib/authz.ts`)

| Helper | Check | Used By |
|--------|-------|---------|
| `assertValidCatechist` | Catechist exists, not deleted, is active | All catechist queries |
| `assertValidStudent` | Student exists, not deleted, is active | Student-facing queries |
| `assertAdminRole` | `catechist.role === 'admin'` | System-level mutations |
| `assertBoardMemberOrAdmin` | admin OR board assignment for AY | Year-level management |
| `assertBranchHeadOrAbove` | admin OR board OR branch_head for branch+AY | Branch-scoped ops |
| `assertHomeroomCatechistOrAbove` | admin OR board OR branch_head OR homeroom for classYear | Class-scoped writes |
| `assertClassCatechistOrAbove` | admin OR board OR branch_head OR any class catechist | Class-scoped reads |
| `assertEnrollmentPermission` | admin OR board OR branch_head OR any class catechist | Enrollment management |
| `assertEditStudentPermission` | admin OR board OR branch_head OR class catechist OR floating | Student updates |
| `assertEditGuardianPermission` | admin OR edit permission for linked student OR floating | Guardian updates |
| `assertCalendarEventScopePermission` | Strict same-scope match | Calendar event create |
| `assertCalendarEventEditPermission` | admin OR creator OR same-scope peer | Calendar event edit/delete |
| `getEffectivePermissions` | Returns `{isAdmin, isBoardMember, branchHeadOf[], classCatechistOf[]}` | Data scoping queries |

## Key Notes

- **Co_teacher write limitations**: Co_teachers can read class data but cannot write grades, score columns, or class-scoped attendance. They can write calendar events for their class.
- **Soft-delete pattern**: All mutations use `isDeleted: true`. Queries filter `!isDeleted` everywhere.
- **Board_member vs branch_head**: Board members operate at AY level (can manage assignments, see org stats). Branch heads operate within their assigned branch(es).
- **No student write paths**: Students only have self-scoped read queries (profile, enrollment, attendance).
- **Public endpoints**: `appConfig.get`, `storage.generateUploadUrl`, `auth.login`, `auth.changePassword`, `setup.hasAdmin`, `setup.runSetup`, `students.getProfilePhotoUrl`.