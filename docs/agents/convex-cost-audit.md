# Convex cost / Database I/O audit

**Last updated:** 2026-10-30 · **Goal:** stay within the Convex **free tier**. Prefer removing or deferring a heavy feature over optimising it when it isn't essential.

Read-only audit of which Convex functions drive Database I/O. Pick an item from the [Work checklist](#work-checklist), fix it, then delete it from this file.

Already fixed and removed from this doc (see git history): academic-year comparison report (removed), Academic Year Report (summary/branch split, one-shot fetch, admin/board only, at-risk list removed), `getEligibleForEnrollment` full scan, catechist delete-guard indexes, dashboard attendance-health and grading-progress widgets (one-shot + Refresh via `useOneShotQuery`, scoped to directly assigned classes, hidden when none; attendance superset read kept for absence streaks), students-needing-follow-up widget/query (removed).

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

### 1. `students.list` / `students.exportList` — full `students` scan on every page, sort, filter, keystroke 🟠

- **Where:** `filterAndSortStudents` (`convex/students.ts`), used by `list` and `exportList`.
- **Reads per call:** `students` `by_is_deleted` `.collect()` = every non-deleted student ever, then JS filter (isActive, gender, name substring, branch/class scope), JS sort (incl. `compareByNameFormat`), then `slice()`. A 20-row page reads the whole table. `resolveStudentIdsForScope` adds enrollment reads.
- **Frequency:** high. Re-runs on every page/sort/filter/keystroke, and reactively on **any** student patch for every open list.
- **Growth:** O(total students), includes inactive/graduated; never shrinks.
- **Side issue:** cursor is a numeric offset into a JS-sorted array, so pages can shift/duplicate on concurrent changes. Real `.paginate()` fixes this.
- **Existing indexes:** `by_student_code`, `by_token_identifier`, `by_is_active`, `by_is_deleted`, search index `search_full_name` (filterFields `['isDeleted']`).
- **Fix options:**
  1. Name search → `withSearchIndex('search_full_name', ...)` + bounded `.take()`/`.paginate()`. Behaviour change: full-text/prefix, not substring; `saintName` needs its own field. **Confirm with user.**
  2. No search + simple sort → compound indexes (`by_is_deleted_and_is_active`, `..._student_code`, `..._gender`, pick by UI use) + `.paginate()`.
  3. Name-format sort: denormalized `nameSortKey` (+ migration when `nameFormat` changes) and index. Bigger change.
  4. Class/branch-scoped lists: drive from `studentClasses by_class_year_id` and `ctx.db.get` students instead of scanning all students.
  5. `exportList`: keep as one-shot fetch (not a live subscription).
- **Recommendation:** 4 + 2 give most of the win with least behaviour change; 1 and 3 need a user decision. Also check the client search input is debounced.

### 2. `catechists.list` / `catechists.exportList` — same pattern 🟡

- `filterAndSortCatechists`, `list`, `exportList` in `convex/catechists.ts`. Full non-deleted scan → JS filter/sort → `slice`.
- Table is small (tens to low hundreds) → **low risk today**. Apply the #1 pattern for consistency, not urgently.
- Indexes: `by_member_id`, `by_token_identifier`, `by_is_deleted`, `by_role_and_is_deleted`, search index `search_full_name`.

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

- `orgStats.getOrgStats`, `branchStats.getBranchStats` — use `lib/statsHelpers.ts` fan-outs (`getStudentIdSetForClassYears` reads every enrollment plus a `students` get each); per year, likely fine; verify.
- Real traffic numbers from the dashboard Usage tab to confirm this ranking.

### Checked, bounded (no action)

- `lib/authz.ts` role helpers: `.collect()` on fully-keyed indexes → 0–2 docs. `getActiveAcademicYear` reads one doc per school year.
- `listActiveRosterByClassYear`, `getRosterByClassYear`, `getEnrollmentSummary`, `grading.getScoresGrid`: all per class-year (enrollments + students + score columns/entries). A few hundred docs.

## Work checklist

- [ ] **#1** `students.list`: indexed fan-out for class/branch scope; compound indexes + `.paginate()` for the unfiltered/simple-sort case.
- [ ] **#1 decision (needs user)**: name search via search index (substring → full-text; saintName coverage) and `nameSortKey` for name-format sorting.
- [ ] **#2** apply the #1 pattern to `catechists.list` (low priority).
- [ ] **#3** stats table only if per-class attendance reads become heavy.
- [ ] Follow-ups listed above.

Project rules for every fix (see `CLAUDE.md`): read `convex/_generated/ai/guidelines.md` first; never `.first()` on soft-delete tables (use `firstActive()`); soft delete only; year-scoped mutations must check `academicYear.isActive`; new/changed functions need unit tests via the `unit-test-writer` agent, ≥75% coverage on touched files.
