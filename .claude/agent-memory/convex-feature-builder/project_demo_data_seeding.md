---
name: project-demo-data-seeding
description: Architecture of the nightly demo-data wipe+reseed system (convex/demoData.ts, convex/seed.ts, convex/crons.ts) added 2026-07-11, replacing the old ad-hoc convex/seed.ts mutations.
metadata:
  type: project
---

## What exists now

- `convex/demoData.ts` — pure, DB-agnostic generators (no `ctx.db`). Name pools
  (LAST_NAMES, BOY/GIRL_*, STREET_NAMES, HAMLETS, PARISHES) were moved here
  from the old `seedFiftyStudents`/`seedCalendarEvents`. All generator
  functions take an `rng: () => number` param (seeded via `createRng(seed)`,
  a mulberry32 PRNG) so `convex/demoData.test.ts` can assert deterministic
  shapes without a Convex context. Production code (`convex/seed.ts`) calls
  these with `Math.random` instead.
- `convex/seed.ts` — fully rewritten. The OLD exports (`runSeed`,
  `seedCatechistAssignments`, `seedSampleStudents`, `seedFiftyStudents`,
  `seedCalendarEvents`, `seedExamForTest`) were deleted entirely per explicit
  user instruction — if you see references to those names anywhere (they
  existed in `convex/students.test.ts` as 2 tests), that's stale and should
  be removed, not fixed.
- `convex/crons.ts` — NEW file, registers `crons.cron('reset demo data
  nightly', '0 0 * * *', internal.seed.resetDemoData, {})`. **0 0 * * * UTC
  = 07:00 Asia/Ho_Chi_Minh, NOT local midnight.** If the user actually wants
  local midnight, the cron expression must be `'0 17 * * *'` (17:00 UTC =
  the *previous* day's midnight ICT, since ICT is UTC+7). This was flagged
  to the user but not changed by default — check before assuming which one
  is live.

## Safety gate

`resetDemoData` (internalAction, the cron's entry point) is the ONLY
destructive entry point. Its handler's first line checks
`process.env.CONVEX_DEPLOYMENT !== 'dev:expert-bloodhound-972'` and no-ops
(returns `{skipped: true}`, logs, touches nothing) otherwise. The cron
itself always registers in every deployment — the gate lives entirely in
the action body, never in `crons.ts`. If this deployment name ever changes,
update the `DEMO_DEPLOYMENT_NAME` const at the top of `convex/seed.ts`.

## Orchestration shape

`resetDemoData` is a long sequential chain of `ctx.runMutation`/`ctx.runQuery`
calls, each a small bounded phase (wipe x4, then seedOrgStructure →
seedCatechists → seedCatechistAccounts → seedAssignments →
getHomeroomAssignments (internalQuery) → seedStudentsCore →
seedStudentAccounts → seedEnrollments → seedAttendance → seedGrading →
seedCalendarEvents → seedAppConfig). bcrypt hashing (`hashPassword`) always
happens in the ACTION, never inside a mutation — mirrors the
`convex/csvImport.ts` precedent (see [[project-conventions]]) of moving
CPU-bound work out of the 1s mutation limit. memberId/studentCode are
reserved via the new `reserveCounterBatch(ctx, name, count)` in
`convex/lib/counter.ts` (one counter write for N ids, added alongside the
pre-existing `nextCounter`) — needed because the login/password string is
literally `CAT-<memberId>`/`STU-<studentCode>`, so the id must be known
*before* hashing, and hashing can't happen until after the mutation that
assigns ids returns.

**Gotcha (real, hit during implementation):** when an `internalAction`
calls `ctx.runMutation`/`ctx.runQuery` on exports defined in the *same
file*, TypeScript's circularity checker throws TS7022/TS7023
("implicitly has type 'any' ... referenced in its own initializer") across
**every** local export in that file, not just the one involved — annotate
an explicit type on every such `await ctx.runMutation(...)`/`ctx.runQuery(...)`
result (per the guidelines doc's own note on this), or the whole file's
typecheck breaks in a confusing cascade.

## Wipe pattern

Four phase mutations (`wipeAttendanceAndGrading`, `wipeEnrollmentAndAssignments`,
`wipeScheduleAndOrg`, `wipeCoreEntitiesAndConfig`) each loop a shared
`wipeTable(ctx, table)` helper over a hardcoded list of `TableNames` in
dependency order (leaf/child tables first — Convex has no FK enforcement,
this is cosmetic/safety only). `wipeTable` does `take(200)` + delete in a
loop, capped at 30 batches (6,000 docs) per invocation; if that cap is hit
it self-reschedules via `ctx.scheduler.runAfter(0, internal.seed.continueWipeTable, {table})`
as a defensive fallback — never actually triggered at this dataset's scale
(largest table is `attendanceRecords` at 480 rows), but kept per the
Convex bulk-deletion guidance. `wipeCoreEntitiesAndConfig` wipes `counters`
and `appConfig` too — `seedAppConfig` recreates the singleton row afterward
(same defaults as the old `runSeed`: parishName 'Giáo xứ Mẫu', dioceseName
'Tổng Giáo phận Sài Gòn', nameFormat 'firstName_lastName').

## Demo dataset shape (fixed, not user-configurable)

3 branches (Ấu Nhi/Thiếu Nhi/Nghĩa Sĩ, sortOrder 1-3) — NOT the 6-branch
production list. 2 academic years: old "2024-2025", current "2025-2026"
(both hardcoded dates, chosen to literally match the spec doc's examples —
note today's real date when this was built, 2026-07-11, is actually just
past "2025-2026"'s end date of 2026-05-31; this was a deliberate choice, not
a bug — re-derive if the "current" year needs to roll forward later). 1
admin + 20 random catechists. 3 board members + 2 branch heads (covering
all 3 branches, so one heads 2 branches) — assigned for BOTH years. 40
total unique students across 4 buckets (10 each): old Ấu Nhi (continues to
current Thiếu Nhi), old Thiếu Nhi (continues to current Nghĩa Sĩ), old
Nghĩa Sĩ (no continuation — "graduates" out of scope), current Ấu Nhi
(brand new). 60 total `studentClasses` rows. 48 classSessions / 480
attendanceRecords / 36 scoreColumns / 360 scoreEntries / 20 calendarEvents.
Full breakdown and the reasoning for each number lives in the original spec
message — don't re-derive from scratch, cross check `convex/seed.test.ts`'s
integration test assertions instead, they encode the exact expected counts.

## Coverage gotcha specific to this feature

`vitest.config.ts`'s coverage `exclude` list already contained
`convex/schema.ts` — and **also `convex/seed.ts`** (pre-existing, not added
by this change). This means `convex/seed.ts` is NEVER coverage-gated
regardless of how well it's tested; don't chase a coverage % for it.
`convex/demoData.ts` and `convex/lib/counter.ts` (both touched by this
feature) ARE coverage-gated and were driven to 100%/100%/100%/100% and
88.88%→100% respectively (the counter.ts gap was `reserveCounterBatch`'s
patch-existing-counter branch, fixed by adding a same-file-pattern test
in `convex/lib/authz-counter.test.ts` right next to the existing
`nextCounter` tests).

## Test-timing gotcha

The one full-integration test in `convex/seed.test.ts` (`resetDemoData`
end-to-end, run twice to prove wipe-then-reseed idempotency) does ~122
bcrypt hashes total (61 accounts × 2 runs, `BCRYPT_ROUNDS=12` in
`convex/lib/password.ts`) and takes ~30s — needed an explicit per-test
timeout override (`test(name, fn, 60000)`) well above the project's default
15000ms backend `testTimeout`. Keep this pattern (one heavy end-to-end test
with a bumped timeout, plus several cheap targeted tests calling individual
internal mutations directly to avoid paying the bcrypt cost repeatedly) if
extending this suite further.
