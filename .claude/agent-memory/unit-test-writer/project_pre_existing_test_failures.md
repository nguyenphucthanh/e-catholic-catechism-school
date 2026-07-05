---
name: project-pre-existing-test-failures
description: Known pre-existing failing tests in the frontend suite (form blur-validation timing; enrollment-summary.test.tsx null querySelector; dashboard.tsx catechist-branch context error), unrelated to unit-test-writer's own work — confirmed via git stash, do not attribute to new test files.
metadata:
  type: project
---

As of 2026-07-02, running the full frontend suite (`npx vitest run --project
frontend`) shows **5 failed test files / 7 failed tests out of 45 files / 352
tests**, all pre-existing and unrelated to any work done by this agent:

- `src/routes/-login.test.tsx` — "shows field-level required errors on blur"
- `src/components/forms/academic-year-form.test.tsx` — numberOfSemesters change validation
- `src/components/forms/catechist-contact-dialog-form.test.tsx` — "requires label field"
- `src/components/forms/catechist-personal-info-form.test.tsx` — fullName required on clear
- `src/routes/_authenticated/-profile.test.tsx` — 3 failures (fullName required, contact label required, invalid phone) all `waitFor(...)` timeouts on blur-triggered TanStack Form + zod validation messages not appearing

All failures are `waitFor` timeouts waiting for a validation error message after
`fireEvent.blur(...)`, i.e. **the same class of flakiness across every failure**
(likely a TanStack Form/zod async-validation timing issue, not related to any
specific component's logic). Confirmed pre-existing by `git stash`-ing all
working-tree changes and re-running `src/routes/-login.test.tsx` in isolation —
it still failed with zero uncommitted changes present.

**How to apply:** if the full suite is run after adding/editing tests and these
same 7 tests fail, do not treat it as a regression caused by the current change —
verify by checking whether the specific failing test names match this list. If a
*different* test fails, that's a real signal worth investigating. If asked to fix
these, they likely need a longer `waitFor` timeout or a look at whether the
zod/TanStack Form validation trigger timing changed — that's a separate task from
whatever prompted reading this memory.

**Second, unrelated pre-existing failure found 2026-07-04**: running the full
frontend suite also shows 2 failures in `src/components/custom/enrollment-summary.test.tsx`
("renders present/late/excused/unexcused counts and the formatted rate" and
"shows the no-attendance-recorded message when total is 0"), both
`TypeError: Cannot read properties of null (reading 'textContent')` from that
file's local `statValue` helper (line ~102, `valueEl.textContent` where
`block.querySelector('p.text-lg')` returns null — the component's stat-card
markup apparently no longer matches that selector). Confirmed pre-existing via
`git stash -u` (which also stashes untracked new test files) + re-run in
isolation — fails identically with a clean working tree. This was discovered
while adding `src/components/custom/evaluations-board.test.tsx` (unrelated
component, same directory) — do not attribute it to work on a sibling file
just because they live in the same folder.

**Third, unrelated pre-existing failure found 2026-07-05**:
`src/routes/_authenticated/-dashboard.test.tsx` has 2 of 3 tests failing:
"renders page heading with title and icon successfully" and "renders
placeholder grid for catechist accounts". Both throw `Error:
useSelectedAcademicYear must be used within AcademicYearProvider` from
`src/lib/academic-year.tsx:83`, because `dashboard.tsx`'s catechist branch now
renders `CatechistDashboard` (`src/components/custom/catechist-dashboard.tsx`),
which calls the real (unmocked-in-that-file) `useSelectedAcademicYear` hook —
that route test file never wraps its render in an `AcademicYearProvider` nor
mocks `~/lib/academic-year`. Confirmed pre-existing (not caused by adding
`catechist-dashboard.test.tsx` / `my-classes-widget.test.tsx`) via `git stash
push -u` on just the two new test files (leaving the untested
`catechist-dashboard.tsx`/`my-classes-widget.tsx` source files in place) +
rerun: identical 2 failures, and coverage numbers barely move (74.55%/66.46%/
73.94%/75.89% without the new tests vs 74.66%/66.8%/74.15%/76% with them) —
confirming the two new test files are a small net *improvement*, not the
source of the pre-existing global-threshold miss. Also note: this failure
mode means `npm test -- --coverage` produces **no coverage table at all**
(vitest's default `coverage.reportOnFailure: false` skips the report whenever
any test fails) — pass `--coverage.reportOnFailure=true` on the CLI to force
the report to print anyway, or read `coverage/lcov.info` directly per-file
(`awk '/^SF:path\/to\/file.tsx$/,/^end_of_record$/' coverage/lcov.info`) since
the ASCII "text" reporter's folded-by-directory table silently omits some
files from display (e.g. `catechist-dashboard.tsx`, `my-classes-widget.tsx`,
and even `student-dashboard.tsx` never appeared as rows under
`src/components/custom` in the text table despite being instrumented and
fully covered in `lcov.info` — a display/truncation quirk of that reporter in
this repo's setup, not a real coverage gap). If asked to fix the
`-dashboard.test.tsx` failure itself, the fix belongs in that test file (mock
`~/lib/academic-year`'s `useSelectedAcademicYear` the way
`classes_.$id.test.tsx` does, or wrap in a provider) — out of scope for a
task that says "don't touch other files."
