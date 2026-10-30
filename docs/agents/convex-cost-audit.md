# Convex cost / Database I/O audit

**Last updated:** 2026-10-30 · **Goal:** stay within the Convex **free tier**. Prefer removing or deferring a heavy feature over optimising it when it isn't essential.

Read-only audit of which Convex functions drive Database I/O. Pick an item from the [Work checklist](#work-checklist), fix it, then delete it from this file.

Already fixed and removed from this doc (see git history): academic-year comparison, Academic Year Report, `getEligibleForEnrollment`, catechist delete-guard indexes, dashboard widgets (attendance health, grading progress, org stats, branch stats: one-shot + Refresh), students-needing-follow-up (removed), catechist-attendance matrix report (one-shot + Refresh), sidebar `listMyClasses` (names only unless `withDetails`), `getClassDetails` (sacraments/photos only with `withProfile`; create-session/exam pages skip them), `students.list` / `catechists.list` scoped reads, admin student/catechist account lists (indexed account join; students page natively), `students.list` `fullName` sort (`nameSortKey` index; `saintName` / `isActive` sorts removed, re-add only with a compound index), search-index name search and native pagination.

## How Convex Database I/O works (background)

- Billing/limits count **every document a function scans, in full** — not rows returned. `.filter()` and JS-side filtering do **not** reduce reads.
- Per-function hard limits: ~**32,000 documents scanned** and ~**16 MiB read** per query/mutation. Exceed → function throws.
- A `useQuery` subscription **re-runs the whole query whenever any document in its read set changes**. Broad read set + frequent writes + many open clients = read amplification.
- Cost ≈ **docs scanned per call × doc size × call/re-run frequency**.
- `.withIndex(...)` + `.take(n)` / `.paginate()` → flat cost. `.collect()` on a growing range → linear cost.
- Heavy report-style queries: fetch once + Refresh button instead of `useQuery` (use `useOneShotQuery` in `src/hooks/use-one-shot-query.ts`); split by scope and load on demand.

## Evidence

`npx convex insights` (dev and prod, 2026-10-29): "No issues found". It only reports near-limit reads and OCC conflicts, so the ranking below comes from **query shapes in code**, not measured traffic. For real numbers: Convex dashboard → Usage / Functions breakdown, or `npx convex insights --prod --details`.

Code is mostly well-indexed. Remaining problems are list queries that read a whole table and filter/sort/paginate in JS.

---

## Open findings

### 1. Attendance grid / per-session reads — re-run on every save 🟢 (watch)

- `attendanceQueries.getAttendanceGrid`, plus `classSessions.ts` / `attendance.ts` per-session reads: all `attendanceRecords` of one class-year, ~30 students × ~40 sessions ≈ 1,200 docs/call at year end, re-run for each open client on every save in that class.
- Fine now. If dashboards get heavy: per-session attendance stats table maintained by all attendance mutations (+ backfill; mind that today's rates count only active enrollments). The grid itself needs per-cell data; leave it.

### 2. Small scans — leave as is ⚪

- `catechists.list`: unscoped non-index sorts / `title` filter scan the table (tens to low hundreds of rows).
- `cleanupOrphanedStorage.ts`, `updateAccountPrefixes.ts`: cron/one-off full scans, not reactive. Batch them if tables approach 32k.
- `appConfig` `.first()`: singleton.
- `catechists` delete guard full-scans `calendarEvents`: rare, admin-only.

---

## Not checked yet (follow-ups)

- Real traffic numbers from the dashboard Usage tab (or `npx convex insights --prod --details`) to confirm this ranking. Compare against: `students.getEligibleForEnrollment`, `reports.academicYearReport`, `orgStats.getOrgStats`, `branchStats.getBranchStats`, `attendanceQueries.getAttendanceGrid`, `attendanceHealth.getMyAttendanceHealth`, `classes.listMyClasses`, `classes.getClassDetails`, `catechistAttendance.getYearlyMatrixReport`.

### Checked, bounded (no action)

- `orgStats.getOrgStats`, `branchStats.getBranchStats` (via `lib/statsHelpers.ts`): per academic year, indexed. Reads = classYears + classes + all enrollments of the year + one `students` get per distinct enrolled student + year's `classCatechists`. ~2 docs/student (≈2k docs at 1,000 students), no unbounded scan. Dashboard widgets are one-shot + Refresh; `academic-years_.setup.tsx` still calls `getOrgStats` live (admin setup page, rare).
- `catechistAttendance.getYearlyMatrixReport`: capped at 120 targets / 100 catechists, ≈1–1.5k docs/call, one-shot.
- `classes.getClassDetails`: roster + catechists per class-year, ~2 docs/student (+ sacraments/photo only on the detail page). Live; re-runs on student/enrollment writes in the class.
- `classes.listMyClasses`: sidebar path reads class years + classes only; dashboard widget (`withDetails`) ≈ 40–70 docs/class, live.
- `accountAdmin.listStudentAccounts`: default path (no name search / account-status filter) pages natively and does one `accounts` lookup per row (`by_account_type_and_user_ref_id`). Name search is bounded by the search index; the account-status filter (esp. "no account") still reads all students + student accounts and filters in memory. `gender` sort removed. `listCatechistAccounts`: small table, per-catechist account lookup, in-memory sort.
- `students.list`: unscoped = native pagination (creation time / code / `nameSortKey`). Scoped (class/branch) or name-search lists use the bounded in-memory path; its offset cursor can shift/duplicate pages on concurrent changes. Name search is word-prefix (not substring), capped at `take(200)` per index (`take(1000)` for `exportList`); scoped lists keep substring matching. `nameSortKey` ignores tone marks.
- `lib/authz.ts` role helpers: `.collect()` on fully-keyed indexes → 0–2 docs. `getActiveAcademicYear` reads one doc per school year.
- `listActiveRosterByClassYear`, `getRosterByClassYear`, `getEnrollmentSummary`, `grading.getScoresGrid`: all per class-year (enrollments + students + score columns/entries). A few hundred docs.

## Work checklist

- [ ] **Deploy step:** admin clicks **Rebuild name sorting** (Admin → App config) once to backfill `students.nameSortKey`; rows without it sort first. Changing `nameFormat` reruns it.
- [ ] **#1** stats table only if per-class attendance reads become heavy.
- [ ] Follow-up: real traffic numbers.

Project rules for every fix (see `CLAUDE.md`): read `convex/_generated/ai/guidelines.md` first; never `.first()` on soft-delete tables (use `firstActive()`); soft delete only; year-scoped mutations must check `academicYear.isActive`; new/changed functions need unit tests via the `unit-test-writer` agent, ≥75% coverage on touched files.
