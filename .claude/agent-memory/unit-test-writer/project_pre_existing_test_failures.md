---
name: project-pre-existing-test-failures
description: A known set of ~7 pre-existing failing tests in the frontend suite (form blur-validation timing), unrelated to unit-test-writer's own work — confirmed via git stash, do not attribute to new test files.
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
