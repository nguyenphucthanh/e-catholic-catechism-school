# Convex cost / Database I/O audit

**Last updated:** 2026-10-30 · **Goal:** stay within the Convex **free tier**. Prefer removing or deferring a heavy feature over optimising it when it isn't essential.

Read-only audit of which Convex functions drive Database I/O. Pick an item from the [Work checklist](#work-checklist), fix it, then delete it from this file.

Already fixed and removed from this doc (see git history): academic-year comparison/report, `getEligibleForEnrollment`, catechist delete-guard indexes, dashboard widgets and catechist-attendance matrix (one-shot + Refresh), attendance grid (month window) and summary report (one-shot), `listMyClasses` (`withDetails`), `getClassDetails` (`withProfile`), `students.list` / `catechists.list` (scoped reads, search index, native pagination, `nameSortKey`; `saintName` / `isActive` sorts removed, re-add only with a compound index), admin account lists (indexed join, native paging). Follow-up removed: students-needing-follow-up.

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

### 1. Attendance grid — live, windowed 🟢 (watch)

- `getAttendanceGrid` takes `from`/`to`; the board loads one month (≈150 docs/call, live `useQuery`). Summary report calls it for the whole year (≈1,200 docs at year end), one-shot + Refresh.
- Grid rate and rate sort cover the visible month only. For a live year-level rate: per-session attendance stats table kept by all attendance mutations (+ backfill; today's rates count only active enrollments).

### 2. Small scans — leave as is ⚪

- `listStudentAccounts` with the account-status filter (esp. "no account", an anti-join): reads all students + student accounts, filters in memory. Admin-only; add an index only if it gets slow.
- `catechists.list`: unscoped non-index sorts / `title` filter scan the table (tens to low hundreds of rows).
- `cleanupOrphanedStorage.ts`, `updateAccountPrefixes.ts`: cron/one-off full scans, not reactive. Batch them if tables approach 32k.
- `appConfig` `.first()`: singleton.
- `catechists` delete guard full-scans `calendarEvents`: rare, admin-only.

---

## Not checked yet (follow-ups)

- Real traffic numbers from the dashboard Usage tab (or `npx convex insights --prod --details`) to confirm this ranking.

### Checked, bounded (no action)

- `orgStats.getOrgStats`, `branchStats.getBranchStats` (via `lib/statsHelpers.ts`): per academic year, indexed. Reads = classYears + classes + all enrollments of the year + one `students` get per distinct enrolled student + year's `classCatechists`. ~2 docs/student (≈2k docs at 1,000 students), no unbounded scan. Dashboard widgets are one-shot + Refresh; `academic-years_.setup.tsx` still calls `getOrgStats` live (admin setup page, rare).
- `catechistAttendance.getYearlyMatrixReport`: capped at 120 targets / 100 catechists, ≈1–1.5k docs/call, one-shot.
- `classes.getClassDetails`: roster + catechists per class-year, ~2 docs/student (+ sacraments/photo only on the detail page). Live; re-runs on student/enrollment writes in the class.
- `classes.listMyClasses`: sidebar path reads class years + classes only; dashboard widget (`withDetails`) ≈ 40–70 docs/class, live.
- `accountAdmin.listStudentAccounts` / `listCatechistAccounts`: one `accounts` lookup per row (`by_account_type_and_user_ref_id`); students page natively, name search is bounded by the search index. Catechists: small table, in-memory sort.
- `students.list`: unscoped = native pagination (creation time / code / `nameSortKey`). Scoped (class/branch) and name-search lists use a bounded in-memory path (offset cursor can shift/duplicate pages on concurrent changes). Name search is word-prefix, capped at `take(200)` per index (`take(1000)` for `exportList`); scoped lists keep substring matching. `nameSortKey` ignores tone marks.
- `lib/authz.ts` role helpers: `.collect()` on fully-keyed indexes → 0–2 docs. `getActiveAcademicYear` reads one doc per school year.
- `listActiveRosterByClassYear`, `getRosterByClassYear`, `getEnrollmentSummary`, `grading.getScoresGrid`: all per class-year (enrollments + students + score columns/entries). A few hundred docs.

## Work checklist

- [ ] **Deploy step:** admin clicks **Rebuild name sorting** (Admin → App config) once to backfill `students.nameSortKey`; rows without it sort first. Changing `nameFormat` reruns it.
- [ ] **#1** stats table only if a live year-level rate is needed or reads get heavy.
- [ ] Follow-up: real traffic numbers.

Project rules for every fix (see `CLAUDE.md`): read `convex/_generated/ai/guidelines.md` first; never `.first()` on soft-delete tables (use `firstActive()`); soft delete only; year-scoped mutations must check `academicYear.isActive`; new/changed functions need unit tests via the `unit-test-writer` agent, ≥75% coverage on touched files.
