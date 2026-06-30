---
name: academic_years_semester_generation
description: KAN-23 semester-generation feature in convex/academicYears.ts and academic-years.tsx — known gap (server error code not mapped to a toast) and a placeholder test to watch for
metadata:
  type: project
---

`convex/academicYears.create` (convex/academicYears.ts) validates `numberOfSemesters`
server-side (integer, 1-4) and throws `ACADEMIC_YEAR_ERRORS.INVALID_SEMESTER_COUNT`
(convex/lib/errors.ts) on violation, then inserts N `semesters` docs in a loop after
the `academicYears` insert, all within the same mutation (atomic via Convex's
transactional mutation semantics).

**Known gap as of the KAN-23 diff:** the frontend `onSubmit` catch block in
`AcademicYearForm` (src/routes/_authenticated/academic-years.tsx) only special-cases
`ACADEMIC_YEAR_ERRORS.DUPLICATE_NAME` — it has no branch for `INVALID_SEMESTER_COUNT`,
so a server-side rejection (e.g. a stale/bypassed client, or future relaxation of the
`<input type=number max=4>` constraint) falls through to the generic
`academicYears.saveError` toast instead of the more specific
`academicYears.fields.numberOfSemesters.error` string that already exists in
src/locales/{en,vi}.json. Flag this if reviewing future edits to that catch block.

**Test smell to watch for:** `src/routes/_authenticated/-academic-years.test.tsx` had
a test titled "submitting create with value 1 calls createMutation with
numberOfSemesters: 1" that was entirely comments — no `fireEvent`/`expect` calls, just
the author's stream-of-consciousness about why they couldn't drive the DateInput in
JSDOM. It passes only because it asserts nothing. This is a recurring risk pattern in
this codebase: check that every `test(...)` body actually contains an assertion, not
just a `waitFor`/`fireEvent` with no `expect`.

**Why:** Confirmed via `npx vitest run ... academic-years.test.tsx` — 40/40 tests
"passed" including the empty one, and global coverage was nowhere near the project's
85% gate (33% statements) when run scoped to just these two files — that run doesn't
reflect repo-wide coverage, only that the harness honors the 85% threshold from
project config when invoked.

**How to apply:** When reviewing additions to AcademicYearForm's error handling, check
the catch block maps every error constant in ACADEMIC_YEAR_ERRORS to a dedicated toast,
not just DUPLICATE_NAME. When reviewing new tests in this file, grep the test body for
at least one `expect(` call before trusting a green run.
