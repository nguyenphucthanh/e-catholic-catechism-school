# Convex cost / Database I/O audit

**Date:** 2026-10-29 · **Branch at audit time:** `feat-mark-all-as-absent` · **Status:** #1 resolved (feature removed, 2026-10-29); #8 (Academic Year Report) added 2026-10-29, open and top priority; #2–#7 open.

**Goal:** stay within the Convex **free tier**. Prefer removing a heavy feature over optimising it when it isn't essential.

Read-only audit of which Convex functions drive Database I/O (bytes / documents read). Use this file to resume work: pick an item from the [Work checklist](#work-checklist), fix it, tick it off.

## How Convex Database I/O works (background)

- Billing/limits count **every document a function scans, in full** — not rows returned, not fields used. `.filter()` and JS-side filtering do **not** reduce reads.
- Per-function hard limits: ~**32,000 documents scanned** and ~**16 MiB read** per query/mutation. Exceed → function throws (the feature breaks, not just costs more).
- A `useQuery` subscription **re-runs the whole query whenever any document in its read set changes**. Broad read set + frequent writes + many open clients = read amplification.
- Effective cost of a function ≈ **docs scanned per call × doc size × call/re-run frequency**. Always consider both factors.
- Indexed range (`.withIndex(...)`) + `.take(n)` / `.paginate()` → flat cost. `.collect()` on a range that grows with data → linear cost that compounds every school year.
- Absolute prices depend on plan and change over time — see https://www.convex.dev/pricing. This doc gives growth shapes, not dollar figures.

## Evidence gathered

| Source | Result |
|---|---|
| `npx convex insights` — dev `expert-bloodhound-972` | "No issues found" (72h) |
| `npx convex insights --prod` — prod `laudable-pheasant-504` | "No issues found" (72h) |

`insights` only reports near-limit read events and OCC conflicts, so it gave **no per-function bytes-read numbers**. Ranking below is from **query shapes in code**, not measured traffic. Call volume is inferred from where the UI uses each function. Table row counts were **not** pulled (would need prod data reads).

To get real numbers later: Convex dashboard → Usage / Functions breakdown (bytes read per function), or re-run `npx convex insights --prod --details` once data volume grows.

Overall: code is mostly well-indexed (nearly every lookup uses `withIndex`; global search uses a search index + `.take(8)`). The problems are a few **aggregate/list queries that read whole ranges and then filter/sort/paginate in JS**.

---

## Findings (ranked, worst first)

### 1. `reports.academicYearComparison` — reads up to 5 years of attendance + scores per call ✅ RESOLVED (removed)

> **Resolution (2026-10-29): feature removed entirely.** We chose removal over the fixes listed below, to stay in the Convex free tier. What changed:
>
> - `convex/reports.ts`: deleted the `academicYearComparison` query, its alias `getAcademicYearOverview`, `MAX_YEARS`, the `EnrollmentRow` / `AttendanceRow` / `GradesRow` / `StaffingRow` types, and the helpers used only by it (`buildEnrollmentRow`, `fetchPresentOrLateCounts`, `computeParishAttendanceRate`, `computeClassAttendanceRate`, `buildAttendanceRow`, `buildGradesRow`). `academicYearReport` and `buildClassReport` remain.
> - `convex/reports.test.ts`: deleted the `academicYearComparison` describe block and the seed helpers only it used (`seedAnnualResult`, `seedScoreColumn`, `seedScoreEntry`).
> - Deleted route `src/routes/_authenticated/_catechist/reports_.academic-years-comparison.tsx` (`/reports/academic-years-comparison`); regenerated `src/routeTree.gen.ts`.
> - `src/components/app-sidebar.tsx`: removed the "5-Year Comparison" item from the Reports menu.
> - `src/locales/en-US.json`, `vi-VN.json`: removed `nav.reports.academicYearsComparison` and all `reports.academicYearsComparison.*` keys. The Academic Year Report was reusing `reports.academicYearsComparison.enrollment.description` for its student-count chart. That text moved to the new key `reports.academicYearReport.charts.studentCountDescription` (wording unchanged), and `reports_.academic-year-report.tsx` now uses it.
> - `src/content/help/branch-head.{en-US,vi-VN}.md`: dropped the mention of the comparison report.
> - Verified: `tsc --noEmit` clean, eslint clean on touched files, `convex/reports.test.ts` (5 tests) and `src/routes/-_authenticated.test.tsx` (11 tests) pass, `vite build` succeeds.
> - Follow-up note: the copy "Total active students per year, and breakdown by class for the most recent year." doesn't quite match the per-class chart on the Academic Year Report. Rewording it is optional.
> - If cross-year comparison is ever needed again, rebuild it from pre-aggregated stats (option 1/2 below), never by scanning raw records.
>
> The original analysis below is kept for reference. Line numbers refer to the code **before** removal.

- **Where:** `convex/reports.ts:334` (query), helpers `buildAttendanceRow` (`reports.ts:143`), `fetchPresentOrLateCounts` (`reports.ts:87`), `buildGradesRow` (`reports.ts:245`), `buildEnrollmentRow` (`reports.ts:58`). `MAX_YEARS = 5` (`reports.ts:14`).
- **What it reads per call:** for each of the last 5 academic years:
  - every `classSessions` row per class-year + parish sessions (mass/extracurricular) by date range,
  - **every `attendanceRecords` row of every session** (`fetchPresentOrLateCounts` → `.withIndex('by_session_id').collect()` per session),
  - every `studentClasses` row per class-year (twice: enrollment row + attendance denominator),
  - **every `scoreEntries` row per score column** (`buildGradesRow`, `reports.ts:300`) + `annualResults`.
- **Frequency:** reactive subscription. Any attendance save / score entry in the active year invalidates it → full re-run for every client that has the report open. Access is any active catechist, not admin-only.
- **Growth:** O(students × sessions × years) — grows every year until the 5-year window is full, then stays at a 5-year-sized plateau that still grows with school size.
- **Hard-limit risk:** rough math — 600 students × 40 sessions × 5 years ≈ 120,000 attendance docs ≫ 32,000 scan limit. **The report will start throwing** before cost even matters. Even 1 year of a large school (~24k) is near the limit once score entries are added.
- **Fix options (cheapest first):**
  1. **Pre-aggregated counters (recommended).** Add a small table, e.g. `attendanceSessionStats { sessionId, academicYearId, classYearId?, presentOrLateCount, recordCount }` (index `by_session_id`, `by_academic_year_id`). Update it inside the mutations that write `attendanceRecords` (single save, bulk "mark all as…", QR check-in, delete/soft-delete). The report then reads ~one row per session instead of one per student per session. Same idea for grades: per-column `{ sum, count }` stats updated by score-entry mutations.
     - Alternative: `@convex-dev/aggregate` component (`TableAggregate` keyed by session/year) — handles counts/sums with O(log n) reads; more setup, but no hand-rolled consistency.
     - Needs a one-off backfill migration for existing years (`@convex-dev/migrations`, see `convex-migration-helper` skill).
  2. **Freeze closed years.** Past academic years are locked (`isActive = false`) and their data can't change. Compute their row once (on year close, or lazily via an internal mutation) into an `academicYearReportSnapshots` table; the query only computes the active year live. Cuts reads ~5×, but the active year is still a full scan.
  3. **Stop live re-runs** (stop-gap only): load the report through a one-shot fetch (e.g. `useConvex().query(...)` / an action) with a manual refresh button instead of `useQuery`. Removes amplification but **not** the per-call scan limit.
- **Recommendation:** (1) for attendance + grades, optionally (2) on top. Do (3) only as a quick patch.

### 8. `reports.academicYearReport` (page `/reports/academic-year-report`) — reads every attendance record of the whole year per call 🔴

*Added 2026-10-29 after #1 was removed. Ranked second, right after #1, so it sits here despite its number. In the first pass it was wrongly filed under #5 as "per class-year"; it actually covers **every** class-year of the year.*

- **Where:**
  - Backend: `academicYearReport` query (`convex/reports.ts:170`) → `buildClassReport` (`reports.ts:18`), run once per active class-year via `Promise.all` (`reports.ts:196`). Helpers in `convex/lib/statsHelpers.ts`: `getActiveClassYearsForAcademicYear`, `getStudentIdSetForClassYears` (`statsHelpers.ts:48`), `getCatechistIdSetForAcademicYear`.
  - Frontend: `src/routes/_authenticated/_catechist/reports_.academic-year-report.tsx:93` — `useQuery(api.reports.academicYearReport, { academicYearId })`, so it's a **live subscription**. Shown in the Reports sidebar menu for **every catechist** (`src/components/app-sidebar.tsx`, `nav.reports.academicYearReport`).
- **What one call reads** (Y = the selected academic year):
  | Read | Source | Size at year end (example: 600 students, 20 classes, 40 sessions/class) |
  |---|---|---|
  | `classYears` of Y + `classes` get per class-year | `getActiveClassYearsForAcademicYear` | ~40 |
  | `branches` (non-deleted) | `reports.ts:187` | few |
  | Per class-year: `classYears` get, `classes` get | `buildClassReport` | ~40 |
  | Per class-year: **all `studentClasses`** (`by_class_year_id`) | `reports.ts:26` | ~600+ (includes withdrawn/deleted rows) |
  | Per active enrollment: **`students` get** (whole doc; only `fullName` + `studentCode` used, and only for at-risk rows) | `reports.ts:34` | ~600 |
  | Per class-year: all `classSessions` (`by_class_year_id_and_semester_id`) | `reports.ts:55` | ~800 |
  | **Per session: all `attendanceRecords`** (`by_session_id`) | `reports.ts:74-83` | **~24,000** (students × sessions) |
  | `studentClasses` **again** for every class-year + `students` get again | `getStudentIdSetForClassYears` (`reports.ts:215`) | ~600 + ~600 (repeat `ctx.db.get` of the same doc in one function may be cheap; not verified) |
  | `classCatechists` by academic year (+ related reads) | `getCatechistIdSetForAcademicYear` (`reports.ts:221`) | ~50–100 |
  | **Total** | | **≈ 26,000–27,000 docs per call** |
- **Frequency / amplification:**
  - Live `useQuery`: **any attendance write in any class of that year** (single save, the new bulk "Mark all as…", QR check-in), any enrollment change, any session create/cancel re-runs the whole report for every open tab of every user viewing it. On a Sunday morning with attendance being taken, one open report tab re-reads ~27k docs for every save batch.
  - Selecting a **past year** reads that year's full data too, even though it can no longer change (the year is locked).
- **Growth:** O(students × sessions) within a year, so it peaks at year end. It doesn't compound across years (only one year at a time), but it **sits close to the ~32,000 docs-scanned limit** for a mid-size parish. Larger parishes, more sessions (supplemental classes) or students in several classes push it over, and then **the report throws**.
- **What the data is actually used for** (this tells us what we can skip reading):
  1. KPIs: total classes, total students, average attendance rate (mean of per-class rates), active catechists.
  2. Per-class overall rate = (present + late among *currently active* enrollments) ÷ (active enrollments × sessions).
  3. Per-class sparkline: rate for the **last 10 sessions** only.
  4. At-risk list: per student, count of consecutive absences (excused or unexcused) from the most recent session backwards, if ≥ 3.
  5. Class-size comparison chart: `studentCount` per class.
  6. Branch grouping.
  Only (2) needs records from all sessions. (3) needs only the last 10 sessions. (4) needs only recent sessions until each student's streak breaks.
- **Fix options** (cheapest first; they can be combined):
  - **A. Read `students` only for at-risk rows.** Build `activeEnrollments` from `studentClasses` alone (`studentClassId`, `studentId`). Fetch `students` docs only for the few at-risk students (and for the `isDeleted` check, use the enrollment state, or accept the small read for at-risk only). Saves ~600 full student-doc reads per call. No behaviour change, apart from the soft-deleted-student edge case; keep that check for at-risk rows.
  - **B. Read `studentClasses` once.** `getStudentIdSetForClassYears` re-reads every class-year's enrollments and every student. Derive `totalStudents` from the enrollments `buildClassReport` already loaded. ⚠ The two use different predicates: `buildClassReport` uses `status === 'active'`, while the helper uses `isActiveEnrollment()` (`convex/lib/enrollment.ts:5`: `!isDeleted && status !== 'withdrawn'`, so it **includes `on_leave`**). Keep the helper's semantics for the KPI when merging, i.e. return the needed fields from one pass. Saves ~1,200 reads.
  - **C. Don't subscribe live.** Load the report with a one-shot fetch (`useConvex().query(...)` in an effect / TanStack Query) plus a "Refresh" button and a "Last updated hh:mm" label. This removes the re-run-on-every-attendance-save amplification, which is probably the **largest real-world cost** on class days. The per-call cost is unchanged. Cheap and UI-only.
  - **D. Snapshot locked years.** When `academicYear.isActive === false`, the data is immutable. Store the computed report JSON in an `academicYearReportSnapshots` table (written when the year is closed/locked, or lazily on first view via an internal mutation; invalidate on unlock). Past-year views then cost ~1 doc read.
  - **E. Pre-aggregated per-session stats (the real fix for the active year).** New table, e.g. `attendanceSessionStats { sessionId, classYearId, academicYearId, presentOrLateCount, excusedCount, unexcusedCount, recordCount }`, indexed `by_session_id` and `by_class_year_id`. Every mutation that writes/soft-deletes `attendanceRecords` must update it: single save, bulk mark-all, QR check-in, deletes, and session cancel/delete. Backfill existing sessions with a migration (`@convex-dev/migrations`). The overall rate and sparkline then read ~1 row per session (~800 instead of ~24,000).
    - ⚠ **Semantics change:** today's rate counts only records of *currently active* enrollments (`statusFor` looks up active enrollments only), so records of students who later withdrew are ignored. Session stats would include them unless stats are keyed per enrollment status, or the rate definition changes to "present ÷ recorded". Decide with the user; the per-class health widget (`attendanceHealth.ts`) also uses the "fixed enrollment denominator" definition (a removed code comment cited `docs/09-design-decisions.md §9.12`, which doesn't exist in `docs/`).
    - Alternative: the `@convex-dev/aggregate` component (`TableAggregate` over `attendanceRecords` keyed by `[sessionId, status]`). Less hand-rolled consistency code, more setup.
  - **F. At-risk without scanning everything.** Options: (i) walk sessions newest-first and load records one session at a time, stopping once every student's streak is broken (usually 1–3 sessions); or (ii) denormalize `currentAbsenceStreak` on `studentClasses`, recomputed in attendance mutations from that enrollment's records (`by_student_class_id`, ~40 docs). Note that edits to old sessions must trigger a recompute. With (i) the report reads only the last few sessions for at-risk; with E for rates it no longer needs any full scan.
  - **G. Split / lazy-load.** Split into a light `academicYearReportSummary` (KPIs, class list, class sizes; uses stats) and an `academicYearReportAtRisk` query. Load per-class sparklines only when a branch section is expanded. This shrinks each subscription's read set, so one save invalidates less.
  - **H. Restrict access (product decision).** Currently any active catechist can open it. Limiting it to admins/board members (like `orgStats`) cuts call volume. Needs a user decision.
- **Recommended order:** C + A + B now (small, no schema change, big drop in real usage) → D (past years almost free) → E + F for the active year (schema change + migration; removes the near-limit risk). Decide H separately.
- **Tests:** existing coverage is in `convex/reports.test.ts` (`describe('academicYearReport')`). Any change must keep those assertions (KPIs, class counts, sparkline, at-risk) or update them deliberately. New stats-maintenance logic in attendance mutations needs its own tests (unit-test-writer agent, ≥75% on touched files).

### 2. `students.list` / `students.exportList` — full `students` scan on every page, sort, filter, keystroke 🟠

- **Where:** `filterAndSortStudents` (`convex/students.ts:198`), used by `list` (`students.ts:311`) and `exportList` (`students.ts:412`).
- **What it reads per call:** `ctx.db.query('students').withIndex('by_is_deleted', isDeleted=false).collect()` = **every non-deleted student ever**, then JS filters (isActive, gender, name substring, branch/class scope), JS sort (incl. `compareByNameFormat`), then `slice()` for the page. A 20-row page still reads the whole table. Plus `resolveStudentIdsForScope` (class-year/branch scoping) reads enrollments.
  - Per page row (bounded by page size, OK): `checkEditStudentPermission`, `studentClasses by_student_id` + `classYears` + `classes` gets.
- **Frequency:** high — main list view; re-runs on every page change, sort change, filter change, search keystroke (check whether the search input is debounced on the client). Also reactive: **any patch to any student** re-runs every open students list for every user.
- **Growth:** O(total students) — includes inactive/graduated students since only `isDeleted` is indexed; never shrinks.
- **Side issue:** cursor is a numeric offset into a JS-sorted array (`continueCursor: String(startIndex + numItems)`), so pages can shift/duplicate if data changes between pages. Real `.paginate()` fixes this too.
- **Existing indexes on `students`:** `by_student_code`, `by_token_identifier`, `by_is_active`, `by_is_deleted`, search index `search_full_name` (searchField `fullName`, filterFields `['isDeleted']`).
- **Fix options:**
  1. **Name search → search index.** When `name` is set, use `withSearchIndex('search_full_name', q => q.search('fullName', name).eq('isDeleted', false))` with a bounded `.take()` / `.paginate()` instead of substring scan. Add `isActive`/`gender` to `filterFields` if those filters combine with search. Note: search index is full-text/prefix, not substring — `saintName` matching would need its own search field (or a combined `searchText` field). Behaviour change; confirm with user.
  2. **No search + simple sort → real index pagination.** Add compound indexes, e.g. `by_is_deleted_and_is_active`, `by_is_deleted_and_student_code`, `by_is_deleted_and_gender` (pick by which filter/sort combos the UI actually uses) and call `.paginate(args.paginationOpts)`. Reads per call become page-sized.
  3. **Sort by name format** can't use an index directly (`compareByNameFormat` is computed). Option: store a denormalized `nameSortKey` field (computed from `fullName` + `appConfig.nameFormat`, recomputed by a migration when `nameFormat` changes) and index `by_is_deleted_and_name_sort_key`.
  4. **Class/branch scoped lists:** when `classYearId`/`branchId` is set, drive the query from `studentClasses by_class_year_id` (small range) and `ctx.db.get` the students, instead of scanning all students and intersecting.
  5. `exportList` legitimately needs all filtered rows; keep it as a one-shot fetch (not a live subscription) so it doesn't re-run.
- **Recommendation:** 4 + 2 give most of the win with least behaviour change; 1 and 3 are bigger changes — decide with user.

### 3. `catechists.list` / `catechists.exportList` — same pattern as students 🟡

- **Where:** `filterAndSortCatechists` (`convex/catechists.ts:311`), `list` (`catechists.ts:426`), `exportList` (`catechists.ts:504`).
- **Shape:** full non-deleted catechists scan → JS filter/sort → `slice`. Per page row: `getRoleFlags`, `classCatechists by_catechist_id` + `classYears`/`classes` gets.
- **Growth:** O(total catechists). This table is small (tens to low hundreds) so it's **low risk today**. Fix together with #2 for consistency, not urgently.
- **Existing indexes:** `by_member_id`, `by_token_identifier`, `by_is_deleted`, `by_role_and_is_deleted`, search index `search_full_name`.
- **Fix:** same options as #2.

### 4. `students.getEligibleForEnrollment` — unindexed full `studentClasses` scan 🟠

- **Where:** `convex/students.ts:1994`, scan at `students.ts:2022`:
  ```ts
  const allEnrollments = await ctx.db.query('studentClasses').collect()
  ```
  Then filters in JS by `isActiveEnrollment(e)` and `classYearIds.includes(e.classYearId)` (also O(n·m) `includes` on an array).
- Also reads all non-deleted students (`by_is_deleted`) and filters `isActive` with `.filter()` (eslint-disabled), plus all `classYears` of the year.
- **Frequency:** when the enrollment dialog/page is open (reactive while open).
- **Growth:** O(every enrollment ever, all years, including deleted) — grows every school year with no bound.
- **Fix (cheap, ~5 lines):** replace the full scan with a per-class-year indexed fan-out:
  ```ts
  const allEnrollments = (
    await Promise.all(
      classYearIds.map((id) =>
        ctx.db
          .query('studentClasses')
          .withIndex('by_class_year_id', (q) => q.eq('classYearId', id))
          .collect(),
      ),
    )
  ).flat()
  ```
  Keep the `isActiveEnrollment` filter; drop the `classYearIds.includes` check (now implied). Cost becomes O(current year enrollments) — flat across years.
  Optional: students read could use `by_is_active` + JS `isDeleted` check, or a new `by_is_deleted_and_is_active` index (shared with #2).
- Check sibling `getEligibleForTransfer` (`students.ts:2090`) for the same pattern — not verified in this audit.

### 5. Per-class dashboards — read all attendance for one class-year, re-run on every save 🟢 (watch)

- **Where:**
  - `attendanceHealth` — `getMyAttendanceHealth` (`convex/attendanceHealth.ts:191`), records loop at `attendanceHealth.ts:95-105` (comment: "Attendance records for ALL class-scoped sessions (superset covers the window)" — reads all sessions, not just the date window).
  - `studentFollowUp.getStudentsNeedingFollowUp` (`convex/studentFollowUp.ts:192`), records loop at `studentFollowUp.ts:88-100`.
  - `attendanceQueries.getAttendanceGrid` (`convex/attendanceQueries.ts:18`, loop at :107).
  - ~~`reports.academicYearReport`~~ — moved to its own finding **#8**. It covers every class-year of the year, not one.
  - `classSessions.ts:188`, `attendance.ts:402` — similar per-session reads.
- **Shape:** all `attendanceRecords` for every session of one class-year (via `by_session_id`). Bounded per class-year: ~30 students × ~40 sessions ≈ 1,200 docs/call at year end.
- **Frequency:** dashboard subscriptions; **every attendance save in that class re-runs all of them** for every open client. The new bulk "Mark all as…" feature writes N records at once → one invalidation burst.
- **Growth:** linear within the year, resets per year. Fine now.
- **Fixes:**
  - `attendanceHealth`: only read sessions inside `[dateFrom, dateTo]` (`sessionsInWindow`) instead of `classScopedSessions` if the computation allows — check why the superset is used before changing.
  - Long term (only if needed): add a per-session attendance stats table, as described in #1 option 1, so dashboards that only need counts/rates read stats instead of raw records. #1 was resolved by removal, so this table does not exist yet.
  - Grid view genuinely needs per-cell data — leave as is.

### 6. Catechist delete guard — unindexed scans on 3 large tables 🟢 (accepted)

- **Where:** `convex/catechists.ts:1106-1125` (mutation). `.filter()` on `attendanceRecords.recordedBy`, `scoreEntries.enteredBy`, `scoreEntryHistories.changedBy` with `.first()`.
- **Shape:** if a match exists it stops early; **if no match, it scans the entire table** — O(all attendance ever). Code comment already accepts this: "rare, admin-only, one-time guard, not a hot path".
- **Risk:** cost is small (rare mutation, not reactive), but once `attendanceRecords` passes ~32k rows, deleting a catechist who never recorded attendance will **hit the scan limit and fail**.
- **Fix:** add `by_recorded_by` on `attendanceRecords`, `by_entered_by` on `scoreEntries`, `by_changed_by` on `scoreEntryHistories`, and use `.withIndex(...).first()`. Index storage cost is small. Low priority, but cheap.

### 7. Admin/maintenance full scans — OK as is ⚪

- `convex/cleanupOrphanedStorage.ts:28-34` — `students`, `catechists`, `appConfig` `.collect()` (cron/maintenance; not reactive).
- `convex/updateAccountPrefixes.ts:16` — all `accounts` `.collect()` (one-off admin migration).
- `convex/seed.ts:37` — batched `.take(WIPE_BATCH_SIZE)` wipe (dev only).
- `appConfig` `.first()` calls (`students.ts:248`, `students.ts:1977`, `catechists.ts:375`, `catechists.ts:1288`, `accountAdmin.ts:140`, `accountAdmin.ts:249`, `appConfig.ts:16`, `appConfig.ts:70`) — singleton table, 1 doc. Fine.
- Watch: if `students`/`accounts` grow large, `cleanupOrphanedStorage` and `updateAccountPrefixes` could hit the 32k limit; convert to paginated/batched internal mutations then.

---

## Not checked in this audit (follow-ups)

- `getEligibleForTransfer` (`students.ts:2090`), `listActiveRosterByClassYear` (`students.ts:1315`), `getRosterByClassYear` (`students.ts:2243`), `getEnrollmentSummary` (`students.ts:1847`) — only skimmed list; likely bounded per class-year but not verified.
- `grading.getScoresGrid` (`grading.ts:683`), `grading.getMyGradingProgress` (`grading.ts:1009`) — per class-year, probably bounded; verify.
- `orgStats.getOrgStats`, `branchStats.getBranchStats` — use `lib/statsHelpers.ts` fan-outs; per year, likely fine; verify.
- `lib/authz.ts` has 16 `.collect()` calls — authz runs on **every** function call, so even small extra reads multiply. Worth a dedicated look.
- Client side: confirm search inputs on students/catechists lists are debounced.
- Real traffic numbers: dashboard Usage → per-function bytes read, to confirm this ranking.

## Work checklist

Suggested order = biggest saving per line of code:

- [ ] **#8-C** Academic Year Report: switch the page from live `useQuery` to one-shot fetch + Refresh button + "last updated" label (UI only).
- [ ] **#8-A/B** `academicYearReport`: fetch `students` only for at-risk rows; read `studentClasses` once (keep the `isActiveEnrollment` semantics for the total-students KPI).
- [ ] **#8-D** snapshot table for locked (past) academic years.
- [ ] **#8-E decision (needs user)**: attendance rate definition when using pre-aggregated stats (include withdrawn students' records or not).
- [ ] **#8-E/F** per-session attendance stats (or `@convex-dev/aggregate`) maintained by all attendance mutations + backfill migration; at-risk via newest-first early-stop or a denormalized streak.
- [ ] **#8-G** optional: split summary / at-risk queries, lazy-load sparklines.
- [ ] **#8-H decision (needs user)**: restrict the report to admins/board members?
- [ ] **#4** `getEligibleForEnrollment`: replace full `studentClasses` scan with `by_class_year_id` fan-out (tiny change, flat cost). Check `getEligibleForTransfer` too.
- [x] **#1** `academicYearComparison`: removed the query, page, sidebar item, locale keys and tests (2026-10-29). Stop-gap / stats-table / snapshot options no longer needed.
- [ ] **#2** `students.list`: indexed fan-out for class/branch scope; compound indexes + `.paginate()` for unfiltered/simple-sort case.
- [ ] **#2 decision (needs user)**: name search via search index (behaviour change: substring → full-text; saintName coverage) and `nameSortKey` denormalization for name-format sorting.
- [ ] **#3** apply the #2 pattern to `catechists.list` (low priority).
- [ ] **#6** add `by_recorded_by` / `by_entered_by` / `by_changed_by` indexes for the delete guard.
- [ ] **#5** check `attendanceHealth` window superset; consider a per-session stats table only if dashboards become heavy.
- [ ] Follow-ups listed in "Not checked in this audit".

Project rules that apply to every fix (see `CLAUDE.md`): read `convex/_generated/ai/guidelines.md` first; never `.first()` on soft-delete tables (use `firstActive()`); soft delete only; mutations on year-scoped data must check `academicYear.isActive`; new/changed functions need unit tests via the `unit-test-writer` agent, ≥75% coverage on touched files.
