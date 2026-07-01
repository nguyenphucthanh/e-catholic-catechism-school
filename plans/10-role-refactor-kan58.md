# Plan 10: Role Refactor — KAN-58

Separate `Catechist.role` (app-level permission) from real-life organizational
assignments (board, branch head, class teaching). Follows widen → migrate → narrow
zero-downtime strategy.

**Ticket:** KAN-58  
**Branch:** `refactor-user-role` (already checked out)  
**Docs:** `docs/02-key-entities.md`, `docs/03-auth-access-control.md`,
`docs/13-role-refactor-migration.md`

---

## Phase 0: Documentation Discovery (DONE)

Subagents read all relevant files. Key findings:

### Allowed APIs / Patterns

- `convex/_generated/ai/guidelines.md`: Index naming rule — include ALL fields:
  `by_academic_year_id_and_catechist_id`, not `by_ay_catechist`.
- Validator pattern: `v.union(v.literal('a'), v.literal('b'))` — no raw strings.
- Auth: `ctx.auth.getUserIdentity()` for external JWT; this project uses custom
  accounts table + `requesterId` arg pattern (internal auth, no JWT).
- `convexTest(schema, modules)` pattern for unit tests.

### Current State (verified by code)

| Artifact              | Location                 | Current value                                          |
| --------------------- | ------------------------ | ------------------------------------------------------ |
| `Catechist.role` enum | `convex/schema.ts:103`   | `catechist \| branch_deputy \| branch_leader \| board` |
| Board auth check      | `convex/lib/authz.ts:18` | `catechist.role !== 'board'`                           |
| Login role return     | `convex/auth.ts:47`      | `role: catechist.role`                                 |
| Seed admin role       | `convex/seed.ts:40`      | `role: 'board'`                                        |
| Frontend role type    | `src/lib/auth.tsx:9`     | `role: string \| null`                                 |
| Frontend guards       | 4 files                  | `user?.role === 'board'`                               |

### Tables That DON'T Exist Yet (must create)

- `academicYearAssignments`
- `branchAssignments`
- `classCatechists` (upgrade of `catechistClasses` with explicit AY field)

### Anti-Patterns to Avoid

- Do NOT use `.filter()` on indexed fields — use `.withIndex()` (Convex guideline)
- Do NOT skip `isDeleted` soft-delete on new tables
- Do NOT use raw string for role — always `v.literal()`
- Do NOT accept userId as function arg for auth — derive from `requesterId` via db

---

## Phase 1: Schema — Add New Tables (Widen, Zero-Downtime)

**Goal:** Add 3 new tables without touching existing `Catechist.role` yet. No data
loss, no breaking changes. New tables are empty until Phase 2 backfill.

### Tasks

1. **`convex/schema.ts`** — Add after `catechistClasses` table:

```typescript
/**
 * AcademicYearAssignment — board_member per academic year.
 * Unique: (academicYearId, catechistId).
 */
academicYearAssignments: defineTable({
  academicYearId: v.id('academicYears'),
  catechistId: v.id('catechists'),
  assignmentType: v.literal('board_member'),
  isDeleted: v.boolean(),
})
  .index('by_academic_year_id', ['academicYearId'])
  .index('by_catechist_id', ['catechistId'])
  .index('by_academic_year_id_and_catechist_id', ['academicYearId', 'catechistId'])
  .index('by_is_deleted', ['isDeleted']),

/**
 * BranchAssignment — branch_head per branch per academic year.
 * One catechist may head multiple branches in same AY.
 * Unique: (academicYearId, catechistId, branchId).
 */
branchAssignments: defineTable({
  academicYearId: v.id('academicYears'),
  catechistId: v.id('catechists'),
  branchId: v.id('branches'),
  isDeleted: v.boolean(),
})
  .index('by_academic_year_id', ['academicYearId'])
  .index('by_catechist_id', ['catechistId'])
  .index('by_branch_id', ['branchId'])
  .index('by_academic_year_id_and_branch_id', ['academicYearId', 'branchId'])
  .index('by_academic_year_id_and_catechist_id_and_branch_id', ['academicYearId', 'catechistId', 'branchId'])
  .index('by_is_deleted', ['isDeleted']),

/**
 * ClassCatechist — teaching assignment per class per AY.
 * Replaces catechistClasses with explicit academicYearId.
 * Unique: (catechistId, classYearId).
 */
classCatechists: defineTable({
  catechistId: v.id('catechists'),
  classYearId: v.id('classYears'),
  academicYearId: v.id('academicYears'),
  role: v.union(v.literal('homeroom'), v.literal('co_teacher')),
  isDeleted: v.boolean(),
})
  .index('by_catechist_id', ['catechistId'])
  .index('by_class_year_id', ['classYearId'])
  .index('by_academic_year_id', ['academicYearId'])
  .index('by_catechist_id_and_class_year_id', ['catechistId', 'classYearId'])
  .index('by_is_deleted', ['isDeleted']),
```

2. **`docs/schema/`** — Add new schema doc file `07-assignments.md` documenting all
   three new tables (field descriptions, unique constraints, indexes).

### Verification

```bash
npx convex dev   # must start without schema errors
npx tsc --noEmit # no TypeScript errors
npm test         # existing tests still pass (no data changed)
```

---

## Phase 2: Data Backfill

**Goal:** Populate the 3 new tables from existing data. Write Convex internal
mutations. Run once manually via Convex dashboard or `npx convex run`.

### Tasks

1. **`convex/migrations/backfillAssignments.ts`** — Internal mutation `backfillAssignments`:

   **Board members → `academicYearAssignments`:**
   - Query all catechists where `role === 'board'` and `isDeleted === false`
   - Find the active academic year (`isActive === true`)
   - For each board catechist: insert into `academicYearAssignments` if not already exists
   - Use `withIndex('by_academic_year_id_and_catechist_id')` to check for duplicates

   **Branch leaders → `branchAssignments`:**
   - Query all catechists where `role === 'branch_leader'` and `isDeleted === false`
   - For each: find their `catechistClasses` entries → join to `classYears` → join to
     `classes` to get `branchId` and `academicYearId`
   - Insert into `branchAssignments` for each (AY, catechist, branch) combination

   **CatechistClass → `classCatechists`:**
   - Query all `catechistClasses` where `isDeleted === false`
   - For each: join to `classYears` to get `academicYearId`
   - Insert into `classCatechists` with same `catechistId`, `classYearId`, `role`, `academicYearId`

2. **`convex/seed.ts`** — Update seed guard to also check `academicYearAssignments`:
   Keep existing board check but also seed first AY assignment after academic year
   is created. _(Full seed rework is Phase 5 — minimal touch here.)_

### Verification

```bash
npx convex run migrations/backfillAssignments:backfillAssignments
# Then in Convex dashboard, check row counts:
# academicYearAssignments: ≥ 1 (at least the initial admin)
# branchAssignments: ≥ 0 (may be 0 if no branch leaders yet)
# classCatechists: same count as catechistClasses
```

---

## Phase 3: Backend — Rewrite Auth & Permission Layer

**Goal:** Change `Catechist.role` to `admin | user`. Update all Convex functions to
use new assignment tables. This is the breaking schema change (narrow).

### 3a. Schema Narrow

**`convex/schema.ts:103`** — Change role validator:

```typescript
// FROM:
role: v.union(
  v.literal('catechist'),
  v.literal('branch_deputy'),
  v.literal('branch_leader'),
  v.literal('board'),
),

// TO:
role: v.union(v.literal('admin'), v.literal('user')),
```

> ⚠️ Run Phase 2 backfill BEFORE this step. After schema narrows, old role values
> in the database will fail validation until all documents are updated.
> Run a second internal mutation to update all existing catechists:
>
> - `board` → `admin`
> - `catechist | branch_deputy | branch_leader` → `user`

**`convex/migrations/backfillAssignments.ts`** — Add second mutation `migrateRoleValues`:

```typescript
// For each catechist:
//   if role === 'board' → patch to 'admin'
//   else → patch to 'user'
// Do in batches of 100 to avoid timeout.
```

### 3b. Auth Utilities — Replace assertBoardRole

**`convex/lib/authz.ts`** — Replace existing content:

```typescript
// assertAdminRole(ctx, requesterId) — role === 'admin'
// assertBoardMemberOrAdmin(ctx, requesterId, academicYearId) — admin OR board_member that AY
// assertBranchHeadOrAbove(ctx, requesterId, academicYearId, branchId) — admin OR board_member OR branch_head
// assertClassCatechistOrAbove(ctx, requesterId, academicYearId, classYearId) — any assignment or admin
// getEffectivePermissions(ctx, requesterId, academicYearId?) — returns permission level enum
```

Pattern for each: check `isDeleted`, `isActive`, then role, then assignment tables.
Use `.withIndex()` not `.filter()`.

### 3c. Auth Login Response

**`convex/auth.ts:47`** — Login now returns new role values (`'admin' | 'user'`).
No structural change needed — `role: catechist.role` still works after schema narrow.

### 3d. Seed Update

**`convex/seed.ts:40`** — Change `role: 'board'` → `role: 'admin'`.
After creating admin catechist and the initial academic year, also insert into
`academicYearAssignments` with `assignmentType: 'board_member'`.

### 3e. Update All Functions Using assertBoardRole

Grep for `assertBoardRole` and `catechist.role` in `convex/`:

```bash
grep -rn "assertBoardRole\|catechist\.role\|role.*board\|board.*role" convex/ --include="*.ts"
```

Replace each call with appropriate new auth utility based on the operation's scope:

- Global admin ops (create AY, assign roles) → `assertAdminRole`
- AY-scoped ops (manage board, manage classes in AY) → `assertBoardMemberOrAdmin`
- Branch-scoped ops → `assertBranchHeadOrAbove`
- Class-scoped ops → `assertClassCatechistOrAbove`

### 3f. Tests — Update All Fixtures

Files to update: `convex/auth.test.ts`, `convex/catechists.test.ts`,
`convex/branches.test.ts`, `convex/classes.test.ts`,
`convex/academicYears.test.ts`, `convex/lib/authz-counter.test.ts`

- Replace all `role: 'catechist'` → `role: 'user'`
- Replace all `role: 'board'` → `role: 'admin'`
- Add new tests for `assertBoardMemberOrAdmin` and `assertBranchHeadOrAbove`
- Add test: `admin` always passes even without AY assignment
- Add test: `user` with `board_member` assignment passes AY-scoped check
- Add test: `user` with no assignment → read-only (auth check throws)

### Verification

```bash
npx tsc --noEmit          # no type errors
npm test -- --coverage    # all 4 metrics ≥ 85%
npx convex dev            # schema deploys cleanly
```

---

## Phase 4: Frontend — Update Auth & Permission Checks

**Goal:** Update `AuthUser` type, create centralized permission helper, replace all
inline `user?.role === 'board'` checks.

### 4a. Update AuthUser Type

**`src/lib/auth.tsx:5`** — Change role type:

```typescript
// FROM:
export type AuthUser = {
  // ...
  role: string | null
}

// TO:
export type AuthUser = {
  // ...
  role: 'admin' | 'user' | null
}
```

### 4b. Create Permission Helper

**`src/lib/permissions.ts`** (new file):

```typescript
import type { AuthUser } from './auth'

export function isAdmin(user: AuthUser | null): boolean {
  return user?.role === 'admin'
}

// For board-member check: backend should return effective permission level
// as part of session, OR frontend calls a lightweight query.
// Initial implementation: treat 'admin' as the only elevated role.
// Board-member UI gating requires Phase 5 backend query.
export function canManageAcademicYear(user: AuthUser | null): boolean {
  return isAdmin(user)
}
```

> **Note:** Full board-member + branch-head UI gating (showing/hiding per-AY
> actions) requires a backend query `getMyPermissions(academicYearId)` returning
> `{ isAdmin, isBoardMember, branchHeadOf: Id<'branches'>[] }`. Add this query
> in Phase 3 and consume it here.

### 4c. Update AppSidebar

**`src/components/app-sidebar.tsx:148`** — Replace `user.role === 'board'` with
`isAdmin(user)` (import from `src/lib/permissions`).

### 4d. Update Page Guards

Replace pattern in each file:

```typescript
// FROM (4 locations):
const isBoard = user?.role === 'board'
if (!isBoard) { return <Unauthorized /> }

// TO:
import { isAdmin } from '~/lib/permissions'
const canAccess = isAdmin(user)
if (!canAccess) { return <Unauthorized /> }
```

Files:

- `src/routes/_authenticated/classes.tsx:63`
- `src/routes/_authenticated/branches.tsx:61`
- `src/routes/_authenticated/classes_.bulk-create.tsx:34`
- `src/routes/_authenticated/academic-years.tsx:57` (partial — keep read-only
  access, hide create/edit actions only)

### 4e. Add i18n Key for Unauthorized Message

Add to translation files:

```json
"common.contactAdmin": "Contact admin for access."
```

Replace hardcoded `'Unauthorized access. Board role required.'` with i18n key.

### Verification

```bash
npx tsc --noEmit
npm test -- --coverage   # ≥ 85% all metrics
# Manual: login as 'user' role → pages show read-only, no create/edit buttons
# Manual: login as 'admin' → full access
```

---

## Phase 5: Cleanup & Deprecation

**Goal:** Remove dead code, deprecate `catechistClasses` (old table), finalize.

### Tasks

1. **`convex/schema.ts`** — Mark `catechistClasses` as deprecated via comment.
   Do NOT delete yet (safe migration window). Add comment:

   ```typescript
   // DEPRECATED: use classCatechists. Remove after 2 releases.
   ```

2. **`convex/lib/authz.ts`** — Delete the old `assertBoardRole` export if no
   callers remain (verify with grep first).

3. **`docs/schema/02-catechists.md`** — Update role field docs from
   `catechist|branch_deputy|branch_leader|board` to `admin|user`.

4. **`docs/13-role-refactor-migration.md`** — Check off implementation checklist
   items, update status from "awaiting implementation" to "implemented".

5. **`convex/seed.ts`** — Remove old board-check filter that used
   `.filter(q => q.eq(q.field('role'), 'board'))`. Replace with index-based check
   on `role === 'admin'`.

6. **Run full test suite:**

```bash
npm test -- --coverage
# Require: statements ≥ 85%, branches ≥ 85%, functions ≥ 85%, lines ≥ 85%
```

---

## Execution Order

```
Phase 1 → Phase 2 (backfill run) → Phase 3a (schema narrow + role migration run)
       → Phase 3b-f (authz rewrite + tests) → Phase 4 (frontend)
       → Phase 5 (cleanup)
```

Each phase can be a separate PR or commit. Phases 1–2 are purely additive and safe
to merge independently. Phase 3a is the only breaking change.

## Risk & Mitigations

| Risk                                                   | Mitigation                                                         |
| ------------------------------------------------------ | ------------------------------------------------------------------ |
| Board catechist with no active AY at backfill time     | Log warning, skip; admin role preserved regardless                 |
| Branch leader with no class assignments (no branchId)  | Log warning, skip; data was already inconsistent                   |
| Schema narrow before role migration → validation error | Run `migrateRoleValues` mutation before deploying schema narrow    |
| Frontend shows wrong permissions after role change     | Auth context reads from login response; re-login clears stale data |
