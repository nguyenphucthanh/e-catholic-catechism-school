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

## "My accessible classYears/classIds for a year" pattern (getEffectivePermissions)

Reused in `convex/classes.ts` `listMyClasses` (produces `classIds`) and
`convex/classSessions.ts` `listMySessionsInRange` (produces `classYearIds`). Both call
`getEffectivePermissions(ctx, requesterId, academicYearId)` from `convex/lib/authz.ts`, which
returns `{ isAdmin, isBoardMember, branchHeadOf: Id<'branches'>[], classCatechistOf:
Id<'classYears'>[] }` already scoped to that academic year. Standard shape to resolve the
accessible set:

1. For each `classYearId` in `perms.classCatechistOf`: `ctx.db.get('classYears', id)`, include if
   `!isDeleted && classYear.academicYearId === academicYearId` (the pre-filter by year already
   happened inside `getEffectivePermissions`, but re-checking here is the established pattern —
   keep it for defense-in-depth/consistency, not because it's structurally necessary).
2. For `perms.branchHeadOf` (non-empty): query `classYears` via `by_academic_year_id` index for
   the year, `.filter(cy => !cy.isDeleted)` in-memory (not `.withIndex` — no index on isDeleted+
   academicYearId combo), then for each fetch its `classes` record and include if
   `!classRecord.isDeleted && perms.branchHeadOf.includes(classRecord.branchId)`.
3. Dedupe via `Set<Id<'classYears'>>` or `Set<Id<'classes'>>` depending on what the caller needs.

This pattern does NOT branch on `perms.isAdmin`/`perms.isBoardMember` — those roles see broader
data through other queries/UI paths, not through this same resolved-set mechanism. Don't assume
admins should be folded into the same Set unless a query explicitly asks for that.

Multi-class fan-out queries that aggregate across a resolved classYearId set (e.g.
`getMyAttendanceHealth` in `convex/attendance.ts`) extend this pattern one step further: for
each classYearId, run a per-class helper (`async function buildX(ctx: QueryCtx, classYearId, ...)`)
that does its own `.withIndex('by_class_year_id_and_semester_id', q => q.eq('classYearId', id))`
fetch + in-memory filtering, `Promise.all` them, then merge/sort the combined results at the top
level. This is O(classes × sessions × students) within one catechist's own scope — accepted as
the complexity budget precedent set by `getAttendanceGrid`, which already does the same per-class
fan-out for a single class.

Gotcha for tests: `convex/attendance.test.ts`'s shared `setupTest()` fixture seeds a stray
non-cancelled `catechism` classSession dated `2024-10-01` on the fixture's own classYearId. Any
new describe block that queries a date-windowed range starting near that date (e.g. testing
attendance rate/trend over a `2024-10-01`..`2024-10-28` window) will silently pick up that extra
unrecorded session and skew rate/denominator calculations. Soft-delete it explicitly
(`ctx.db.patch('classSessions', ids.catechismSessionId, { isDeleted: true })`) at the top of such
tests rather than trying to dodge the date range.

Query-shape convention when returning rows derived from `classSessions`/`classYears`/`classes`:
fetch the initial large collection via a real index (e.g. `by_session_date` with
`.gte()/.lte()` range on the indexed field), then push everything else (isDeleted, isCancelled,
enum-type filters, "id in accessible Set") into a single plain-array `.filter()` after
`.collect()`. This is deliberate house style to avoid the `@convex-dev/no-filter-in-query` lint
rule while still not requiring a compound index for every filter combination — see `list` in
`convex/classSessions.ts` and `getClassDetails`/`listMyClasses` in `convex/classes.ts` for
precedent.

## Org/branch stats aggregation pattern (convex/orgStats.ts, convex/branchStats.ts)

Shared dedup/aggregation helpers live in `convex/lib/statsHelpers.ts` (not `authz.ts` — that
file is auth-only): `getActiveClassYearsForAcademicYear` (joins classYears→classes, drops
soft-deleted rows on either side, returns `{classYearId, classId, branchId}[]`),
`getStudentIdSetForClassYears` (fans out `studentClasses.by_class_year_id` per classYearId,
dedupes via `Set<Id<'students'>>`), `getCatechistIdSetForAcademicYear` (queries
`classCatechists.by_academic_year_id` once, optional `allowedClassYearIds` filter, dedupes via
`Set<Id<'catechists'>>`). `orgStats.getOrgStats` and `branchStats.getBranchStats` both build on
these three; `branchStats` additionally groups the classYear rows into a
`Map<Id<'branches'>, classYearId[]>` before calling the two Set-builder helpers per branch, so
adding a third "stats" query (e.g. per-class-year stats) should reuse the same helpers rather
than re-deriving the join.

`assertBoardMemberOrAdmin`/`getEffectivePermissions` (already in `lib/authz.ts`) are the auth
gates for these two queries — org stats requires board-member-or-admin for the academic year;
branch stats uses `getEffectivePermissions` and returns `[]` early if the requester is neither
admin/board-member nor a branch head for that year (mirrors the existing branchHeadOf pattern
noted above).

## Per-record error-isolation batch mutations (convex/csvImport.ts)

`bulkImportStudents`/`bulkImportCatechists` follow a deliberate pattern: `assertAdminRole` runs
once outside a plain `for` loop, then each record's inserts run inside a per-iteration
`try/catch` that pushes `{index, status:'ok'|'error', ...}` to a results array — one bad record
must never abort the rest of the batch. Do not "fix" this into a Promise.all-with-throw or an
all-or-nothing transaction; it's intentional (mirrors JIRA-style CSV import UX where partial
success is expected). Note: since Convex's args validator (`v.array(v.object({...}))`) validates
the WHOLE array up front, a genuinely malformed record (wrong type/missing required field) makes
the entire mutation call reject before the handler runs at all — the per-record try/catch can
only ever catch true *runtime* failures (e.g. an exception thrown by a helper function), not
argument-shape violations. Keep this in mind when testing "one bad record, one good" scenarios:
you cannot express the bad record via a schema violation, you need a helper that throws at
runtime for specific input (see next note).

### Gotcha: `vi.spyOn` + `vi.importActual` on the same ESM module causes infinite recursion

To simulate one runtime failure inside a batch loop, mocking a helper like `hashPassword` (from
`convex/lib/password.ts`) with `vi.spyOn(passwordLib, 'hashPassword').mockImplementation(...)` is
the right idea, but do NOT get the "real" fallback implementation via
`await vi.importActual('./lib/password')` and then call `actual.hashPassword(...)` inside the
mock body — `vi.importActual` returns the SAME live module namespace object as the one you
`import * as passwordLib`, so once `vi.spyOn` patches `passwordLib.hashPassword`, the property on
`actual` is patched too (same object), and the mock's fallback path recurses into itself
infinitely (observed: 1800+ recursive calls in 13ms before assertions even ran, all misattributed
at first to a phantom Convex OCC retry loop before the real cause was found). Fix: capture the
real function reference as a plain variable BEFORE calling `spyOn`
(`const realFn = passwordLib.hashPassword`), then call `realFn(...)` in the mock body — never
re-read `actual.someExport` after spying on the same object.

## Global search (header search-combobox) pattern (convex/search.ts, KAN-206)

First use of Convex `searchIndex` in this project (previously only `.index()`). Added
`.searchIndex('search_full_name', { searchField: 'fullName', filterFields: ['isDeleted'] })`
to both `students` and `catechists` tables in `convex/schema.ts` (a search index only supports
one `searchField`, so `saintName` is not searchable this way — fullName only). `search.ts`
exports a single catechist-only query `globalSearch({ requesterId: v.id('catechists'), query:
v.string() })` → `{ students: [...], catechists: [...] }`, each capped at `.take(8)`. Guards
against empty/whitespace query by short-circuiting before touching `withSearchIndex` (avoids
wasting a search-index read on `''`). Uses the standard `assertValidCatechist(ctx, requesterId)`
gate — same as every other catechist-facing query in this repo, nothing new there. Query syntax:
`.withSearchIndex('search_full_name', (q) => q.search('fullName', trimmed).eq('isDeleted', false))`.

## Promote/transfer students query (convex/students.ts, getEligibleForTransfer)

Added `getEligibleForTransfer({ requesterId: catechists, sourceClassYearId, targetAcademicYearId })`
alongside `getEligibleForEnrollment` (~line 1268, after it, last export in file). Builds a source
class year's roster (non-deleted active/on_leave `studentClasses`, joined to non-deleted
`students`) and flags each student `alreadyEnrolledInTargetYear: boolean` by resolving the target
academic year's non-deleted `classYears` into a `Set<Id<'classYears'>>`, then scanning
`ctx.db.query('studentClasses').collect()` in-memory for a non-deleted active/on_leave row whose
`classYearId` is in that set (same "collect everything, filter in JS" shape as
`getEligibleForEnrollment`, kept for consistency/lint — `@convex-dev/no-filter-in-query` forbids
`.filter()` on the query builder, and there's no compound index for "classYearId in set"). No new
mutation — frontend reuses `enrollStudents` (line ~712) for the actual bulk-enroll write; this
query is purely for building the picker/roster UI and pre-flagging conflicts.

Test gotcha: `enrollStudents` mutation requires the *target* class year's academic year to have
`isActive: true` (throws `ENROLLMENT_ACADEMIC_YEAR_NOT_ACTIVE` otherwise). Since transfer-flow
tests need to seed enrollments into a **past** (non-active) source academic year, seed those
`studentClasses` rows directly via `t.run(ctx => ctx.db.insert('studentClasses', {...}))` instead
of calling `api.students.enrollStudents` — the mutation can't be used to set up fixtures in an
inactive year.

## Student-scoped attendance report (convex/attendance.ts, getStudentAttendanceReport)

Sibling of `getParishAttendanceReport` (same file, added at end ~line 1311). Args
`{requesterId: catechists, studentId: students}`. Resolves "active academic year" the same way
`academicYears.ts`'s `getActive` query does: query `academicYears` via `by_is_deleted` index
(`isDeleted === false`), then `.find(y => y.isActive)` in memory — there is no `by_is_active`
index on this table (contrast `students`, which has one). Returns `[]` immediately if no active
year.

Fans out `studentClasses.by_student_id` → per-studentClass `attendanceRecords.by_student_class_id`
(Promise.all, not a loop — avoids N+1), flattens, drops `isDeleted`, then resolves each record's
`classSessions` doc via `ctx.db.get` and filters to `sessionType in ['mass','extracurricular']`
AND `academicYearId === activeYear._id` AND `!isCancelled && !isDeleted`.

Gotcha: className is resolved via the **session's** `classYearId` (not the studentClass's), per
explicit task spec, mirroring the letter of `getParishAttendanceReport`'s join chain. But per the
`classSessions` schema comment, mass/extracurricular sessions structurally never have a
`classYearId` (it's null/undefined for parish-scoped session types — see schema.ts ~L400) — so
after the sessionType filter, `className` is always `null` in every real scenario. That
`classYear && !classYear.isDeleted` branch in the query is therefore dead code for this specific
query's actual data shape; it stays uncovered by unit tests as a known/accepted gap, not a bug.
If a future ask wants a real className on this report, resolve it via the studentClass's
`classYearId` instead (like `getParishAttendanceReport` does), not the session's.

Sort: results ordered by `deviceQueuedAt` descending (most recent attendance first) —
`deviceQueuedAt` is the actual timestamp field per schema (`sessionDate` is just a YYYY-MM-DD
string, no time component).

Tests live in the same file as `getParishAttendanceReport`'s tests:
`convex/attendanceReport.test.ts`, in a second `describe('getStudentAttendanceReport backend
function', ...)` block with its own `setupTest()` (separate fixtures, not shared with the parish
report's block). Covers: mixed mass+extra happy path w/ sort order, empty-active-year, filtering
out catechism sessionType / inactive-year / cancelled / deleted-session / deleted-record, and auth
rejection. 129/129 attendance-suite tests pass after this addition (`npx vitest run attendance`).

## Coverage-report display quirk (v8 + vitest text reporter, not a real gap)

Running `vitest --coverage` against a narrow subset of test files (e.g. just 1-2 new test files)
can silently *omit* a covered file's row from the printed text table entirely — it doesn't show
0% or 100%, it's just missing from the list, even though the raw `coverage/coverage-final.json`
has full per-statement data for that file. Confirmed by parsing the JSON directly (`d[key]['s']`
statement-hit map) when `orgStats.ts` didn't appear in the printed table despite being 100%
covered. Don't conclude a file has "no coverage" just because it's absent from the printed table
— check `coverage-final.json` or run the full `convex/` suite before flagging a real gap.
