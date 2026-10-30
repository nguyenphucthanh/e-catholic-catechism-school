# Convex cost / Database I/O audit

**Last updated:** 2026-10-30 · **Goal:** stay within the Convex **free tier**. Prefer removing or deferring a heavy feature over optimising it when it isn't essential.

Read-only audit of which Convex functions drive Database I/O. Pick an item from the [Work checklist](#work-checklist), fix it, then delete it from this file.

Already fixed and removed from this doc (see git history): academic-year comparison report (removed), Academic Year Report (summary/branch split, one-shot fetch, admin/board only, at-risk list removed), `getEligibleForEnrollment` full scan, catechist delete-guard indexes, dashboard attendance-health and grading-progress widgets (one-shot + Refresh via `useOneShotQuery`, scoped to directly assigned classes, hidden when none; attendance superset read kept for absence streaks), students-needing-follow-up widget/query (removed), org-stats and branch-stats dashboard widgets (one-shot + Refresh), catechist-attendance yearly matrix report page (one-shot + Refresh), sidebar `classes.listMyClasses` (names only unless `withDetails`).

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

### 1. `students.list` — non-index sorts still scan the whole `students` table 🟡

- **Fixed already:** class/branch-scoped lists read only the scoped students; unscoped lists sorted by creation time (default) or `studentCode` use native `.paginate()`; name search uses search indexes `search_full_name` / `search_saint_name` (word-prefix match, `take(200)` per index for `list`, `take(1000)` for `exportList`; scoped lists keep substring matching).
- **Still scans everything** (`filterAndSortStudents` in `convex/students.ts`: `by_is_deleted` `.collect()`, JS sort, offset-cursor `slice`) when unscoped and `sortBy` is `fullName` / `saintName` / `isActive`. Name search + those sorts is bounded (search candidates only).
- **Side issue:** offset cursor on the non-native path can shift/duplicate pages on concurrent changes.
- **Remaining options (need user decision):** `nameSortKey` denormalization (+ migration when `nameFormat` changes) and index for `fullName` sort; compound indexes for `isActive` / `saintName` sorts if the UI needs them (gender sort removed; use the gender filter).

### 2. `catechists.list` — non-index sorts still scan the table ⚪

- Same fixes as #1 applied (branch-scoped read by id, search indexes for name, native `.paginate()` for default / `memberId` sort). Remaining full-table path: unscoped sorts by `fullName` / `saintName` / `gender` / `isActive` / `joinedDate`, or a `title` filter. Table is small (tens to low hundreds) → leave.

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

### 5. `classes.getClassDetails` — N+1 sacrament reads, reactive 🟢 (watch)

- **Where:** class detail page, plus create-session and create-exam pages (`classes_.$id*.tsx`), live `useQuery`.
- **Shape:** per class-year: catechists + enrollments + per active student one `students` get + `studentSacraments` collect + `storage.getUrl`. ~30 students → ~150–200 docs/call. Re-runs on any student/sacrament/enrollment write in the class.
- **Fine now.** Options: create-session/create-exam pages likely need only class meta/type, not the roster → give them a lighter query; split sacraments into a separate query loaded on demand.

---

## Not checked yet (follow-ups)

- Real traffic numbers from the dashboard Usage tab to confirm this ranking.
- **Functions to re-check** (user-requested; existence verified 2026-10-30). Compare dashboard Usage numbers against each:
  - `students.getEligibleForEnrollment` (already fixed: full scan removed; verify in Usage)
  - `branchStats.getBranchStats` (checked, bounded; widget is one-shot)
  - `reports.academicYearReport` (already split/one-shot; verify)
  - `orgStats.getOrgStats` (checked, bounded; `academic-years_.setup.tsx` still calls it live)
  - `attendanceQueries.getAttendanceGrid` (see #3)
  - `attendanceHealth.getMyAttendanceHealth` (one-shot; reads all attendance for each directly assigned class-year)
  - `classes.listMyClasses` (sidebar light; dashboard widget with `withDetails` ≈ 40–70 docs/class, live)
  - `classes.getClassDetails` → reviewed, see #5
  - `catechistAttendance.getYearlyMatrixReport` (capped 120 targets / 100 catechists; page is one-shot + Refresh)
  - ~~`studentFollowUp.getStudentsNeedingFollowUp`~~ — no longer exists (removed), nothing to check.

### Checked, bounded (no action)

- `orgStats.getOrgStats`, `branchStats.getBranchStats` (via `lib/statsHelpers.ts`): per academic year, indexed. Reads = classYears + classes + all enrollments of the year + one `students` get per distinct enrolled student + year's `classCatechists`. ~2 docs/student (≈2k docs at 1,000 students), no unbounded scan. Dashboard widgets are one-shot + Refresh; `academic-years_.setup.tsx` still calls `getOrgStats` live (admin setup page, rare).

- `lib/authz.ts` role helpers: `.collect()` on fully-keyed indexes → 0–2 docs. `getActiveAcademicYear` reads one doc per school year.
- `listActiveRosterByClassYear`, `getRosterByClassYear`, `getEnrollmentSummary`, `grading.getScoresGrid`: all per class-year (enrollments + students + score columns/entries). A few hundred docs.

## Work checklist

- [ ] **#1 decision (needs user)**: `nameSortKey` for name-format sorting (unscoped `fullName` sort still scans all students).
- [ ] **#5** lighter query for create-session/exam pages (optional).
- [ ] **#3** stats table only if per-class attendance reads become heavy.
- [ ] Follow-ups listed above.

Project rules for every fix (see `CLAUDE.md`): read `convex/_generated/ai/guidelines.md` first; never `.first()` on soft-delete tables (use `firstActive()`); soft delete only; year-scoped mutations must check `academicYear.isActive`; new/changed functions need unit tests via the `unit-test-writer` agent, ≥75% coverage on touched files.
