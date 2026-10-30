# Convex cost / Database I/O audit

**Last updated:** 2026-10-30 · **Goal:** stay within the Convex **free tier**. Prefer removing or deferring a heavy feature over optimising it when it isn't essential.

Read-only audit of which Convex functions drive Database I/O. Pick an item from the [Work checklist](#work-checklist), fix it, then delete it from this file.

Already fixed and removed from this doc (see git history): academic-year comparison, Academic Year Report, `getEligibleForEnrollment`, catechist delete-guard indexes, dashboard widgets (attendance health, grading progress, org stats, branch stats: one-shot + Refresh), students-needing-follow-up (removed), catechist-attendance matrix report (one-shot + Refresh), sidebar `listMyClasses` (names only unless `withDetails`), `getClassDetails` (sacraments/photos only with `withProfile`; create-session/exam pages skip them), `students.list` / `catechists.list` scoped reads, `students.list` `fullName` sort (`nameSortKey` index), search-index name search and native pagination.

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

### 1. `students.list` — `saintName` / `isActive` sorts still scan the whole `students` table 🟡

- **Still scans everything** (`filterAndSortStudents` in `convex/students.ts`: `by_is_deleted` `.collect()`, JS sort, offset-cursor `slice`) when unscoped and `sortBy` is `saintName` / `isActive`. Name search + those sorts is bounded (search candidates only). `fullName` sort is now native (`by_name_sort_key`).
- **Side issue:** offset cursor on the non-native path can shift/duplicate pages on concurrent changes.
- **Deploy step:** after deploying, admin clicks **Rebuild name sorting** in Admin → App config (Name format section; or `npx convex run nameSortKeys:reindexStudents`) once to backfill `students.nameSortKey` (rows without it sort first). `appConfig.upsert` re-runs it when `nameFormat` changes.
- **Options (need user decision):** compound indexes for `isActive` / `saintName` if the UI needs them (or drop those sorts).
- **Known limits:** name search is word-prefix (not substring) and capped at `take(200)` per index (`take(1000)` for `exportList`); scoped lists keep substring matching. `nameSortKey` ignores tone marks (ties fall back to creation order).

### 2. `catechists.list` — non-index sorts still scan the table ⚪

- Unscoped sorts by `fullName` / `saintName` / `gender` / `isActive` / `joinedDate`, or a `title` filter, still scan. Table is small (tens to low hundreds) → leave.

### 3. Attendance grid / per-session reads — all attendance for one class-year, re-run on every save 🟢 (watch)

- **Where:** `attendanceQueries.getAttendanceGrid`, plus `classSessions.ts` / `attendance.ts` per-session reads.
- **Shape:** all `attendanceRecords` for one class-year, ~30 students × ~40 sessions ≈ 1,200 docs/call at year end. Every attendance save in that class re-runs them for each open client.
- **Fine now.** Possible fixes:
  - Only if dashboards get heavy: a per-session attendance stats table maintained by all attendance mutations (+ backfill migration). Note the rate-definition question: today's rates count only currently active enrollments.
  - The grid view needs per-cell data; leave it.

### 4. Admin/maintenance full scans — OK as is ⚪

- `cleanupOrphanedStorage.ts` (`students`, `catechists`, `appConfig` `.collect()`), `updateAccountPrefixes.ts` (all `accounts`) — cron/one-off, not reactive. Convert to batched internal mutations if tables approach 32k.
- `appConfig` `.first()` calls — singleton table, fine.
- `catechists` delete guard still full-scans `calendarEvents` (`createdBy`/`updatedBy`/`targetCatechistId`); accepted: rare, admin-only.

---

## Not checked yet (follow-ups)

- Real traffic numbers from the dashboard Usage tab (or `npx convex insights --prod --details`) to confirm this ranking. Compare against: `students.getEligibleForEnrollment`, `reports.academicYearReport`, `orgStats.getOrgStats`, `branchStats.getBranchStats`, `attendanceQueries.getAttendanceGrid`, `attendanceHealth.getMyAttendanceHealth`, `classes.listMyClasses`, `classes.getClassDetails`, `catechistAttendance.getYearlyMatrixReport`.

### Checked, bounded (no action)

- `orgStats.getOrgStats`, `branchStats.getBranchStats` (via `lib/statsHelpers.ts`): per academic year, indexed. Reads = classYears + classes + all enrollments of the year + one `students` get per distinct enrolled student + year's `classCatechists`. ~2 docs/student (≈2k docs at 1,000 students), no unbounded scan. Dashboard widgets are one-shot + Refresh; `academic-years_.setup.tsx` still calls `getOrgStats` live (admin setup page, rare).
- `catechistAttendance.getYearlyMatrixReport`: capped at 120 targets / 100 catechists, ≈1–1.5k docs/call, one-shot.
- `classes.getClassDetails`: roster + catechists per class-year, ~2 docs/student (+ sacraments/photo only on the detail page). Live; re-runs on student/enrollment writes in the class.
- `classes.listMyClasses`: sidebar path reads class years + classes only; dashboard widget (`withDetails`) ≈ 40–70 docs/class, live.
- `lib/authz.ts` role helpers: `.collect()` on fully-keyed indexes → 0–2 docs. `getActiveAcademicYear` reads one doc per school year.
- `listActiveRosterByClassYear`, `getRosterByClassYear`, `getEnrollmentSummary`, `grading.getScoresGrid`: all per class-year (enrollments + students + score columns/entries). A few hundred docs.

## Work checklist

- [ ] **#1** click **Rebuild name sorting** (App config) after deploy; decide on `saintName` / `isActive` sorts.
- [ ] **#3** stats table only if per-class attendance reads become heavy.
- [ ] Follow-up: real traffic numbers.

Project rules for every fix (see `CLAUDE.md`): read `convex/_generated/ai/guidelines.md` first; never `.first()` on soft-delete tables (use `firstActive()`); soft delete only; year-scoped mutations must check `academicYear.isActive`; new/changed functions need unit tests via the `unit-test-writer` agent, ≥75% coverage on touched files.
