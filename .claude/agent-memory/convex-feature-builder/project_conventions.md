---
name: project-conventions
description: Convex schema and coding conventions for the e-Catholic Catechism School project — field naming, type mappings, uniqueness patterns, polymorphic refs, and what NOT to store.
metadata:
  type: project
---

## Field naming

camelCase field names in schema (e.g. `academicYearId`, `isPrimaryClass`, `deviceQueuedAt`).

## Type mappings from SYSTEM_DESIGN.md to Convex validators

| Design type       | Convex validator                          | Notes                   |
| ----------------- | ----------------------------------------- | ----------------------- |
| string / text     | `v.string()`                              |                         |
| integer / decimal | `v.number()`                              |                         |
| boolean           | `v.boolean()`                             |                         |
| date              | `v.string()`                              | ISO 8601 YYYY-MM-DD     |
| timestamp         | `v.number()`                              | Unix milliseconds       |
| enum              | `v.union(v.literal(...), ...)`            |                         |
| ref → Table       | `v.id("tableName")`                       |                         |
| optional field    | `v.optional(...)`                         |                         |
| polymorphic ref   | `v.union(v.id("tableA"), v.id("tableB"))` | e.g. accounts.userRefId |

## Uniqueness constraints

Convex has no DB-level unique constraint. All uniqueness rules from §10 of SYSTEM_DESIGN.md are:

1. Enforced at application layer (check before insert/update)
2. Supported by a corresponding index for the lookup (e.g. `by_login_id` on accounts)

## Polymorphic foreign key

`accounts.userRefId` is `v.union(v.id("catechists"), v.id("students"))`.
Use `accounts.accountType` to know which table to look up.

## Computed values — never stored

`weighted_average` and `diligence_score` are always computed at query time from
`scoreEntries` and `attendanceRecords` respectively. Do not add them to any table.

## Boilerplate

The original `convex/myFunctions.ts` (starter boilerplate referencing a `numbers` table) was
replaced with an empty comment file when the schema was introduced. New domain functions go in
purpose-named files under `convex/` (e.g. `convex/students.ts`, `convex/attendance.ts`).

## Testing

Guidelines specify `convex-test` + `vitest` + `@edge-runtime/vm`. Test files live alongside
source as `convex/<module>.test.ts` (e.g. `convex/academicYears.test.ts`,
`convex/attendance.grid.test.ts` — grid-specific attendance tests are split into their own file
rather than living in `convex/attendance.test.ts`). Each file does
`const modules = import.meta.glob('./**/*.ts')` and passes it + `schema` to `convexTest(...)`.
Run with `npm test -- --coverage`.

Global coverage gate (75% stmts/branches/funcs/lines, see CLAUDE.md) was already failing on
`main` before any of my changes (~70.5% branches) — driven by low frontend route/form coverage,
not Convex code. Convex files individually run 90%+. Don't try to fix the global gate as a side
effect of an unrelated backend change; confirm via `git stash` + rerun coverage that a failure
pre-dates your diff before flagging it as your responsibility.

## Seed / setup

`convex/seed.ts` contains `runSeed` (`internalMutation`) — seeds 6 branches and the first
board-level catechist (Admin) + matching account. Run via:
`npx convex run seed:runSeed --prod` (or without `--prod` for dev).

Password hashing in seed uses SHA-256 via `crypto.subtle` (V8-safe). bcryptjs is NOT installed.
For production-grade hashing, move to a Node.js action with `bcryptjs` + `"use node"`.

memberId is derived post-insert by patching the catechist with its own `_id` (string form)
because `memberId` is required by schema and can't be known before the insert.

## Student self-service query pattern

Catechist-facing queries (any catechist can view any student's data) live alongside student
self-service variants of the same data, e.g. in `convex/students.ts`:
`getStudentDetail`/`getMyProfile`, `getEnrollmentSummary`/`getMyEnrollmentSummary`; in
`convex/attendance.ts`: `listAttendanceRecordsForStudentClass`/`listMyAttendanceRecordsForStudentClass`.

Convention for adding a student self-service twin of an existing catechist query:

1. `convex/lib/authz.ts` has `assertValidStudent(ctx, requesterId: Id<'students'>)` mirroring
   `assertValidCatechist` (checks not-found/isDeleted/!isActive, same 'Unauthorized: ...' message
   style). A student's own `students._id` doubles as their auth identity (see `auth.ts` login
   mutation — `userDocId: account.userRefId` for student accountType).
2. Extract the catechist query's post-authz body into a standalone `async function build_X(ctx:
   QueryCtx, ...)` helper (no `requesterId` param) so both the catechist query and the student
   query call the same shaping logic without duplicating it.
3. The student query takes `requesterId: v.id('students')` and — for anything scoped to a
   specific record (e.g. a `studentClasses` doc) — must do its own ownership check
   (`doc.studentId === args.requesterId`) before calling the shared helper, returning `null`/`[]`
   on mismatch or missing/deleted doc. This is the actual security boundary; don't skip it even
   though `assertValidStudent` already ran.
4. `getMyProfile`-style queries that only ever return the caller's own record (no id arg at all)
   don't need an extra ownership check — there's no id to guess.

Test pattern: put `assertValidStudent` unit tests in `convex/lib/authz-extra.test.ts` (same file
as the other assert* helper tests). Put query-level tests in the same `describe` block / test
file as the catechist-facing sibling (e.g. `getMyEnrollmentSummary` tests live inside
`describe('getEnrollmentSummary query', ...)` in `convex/students.test.ts`), reusing that block's
`setupEnrollment`/`setupTest` helper rather than duplicating fixture setup.
