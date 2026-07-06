---
name: project-convex-test-patterns
description: convex-test gotchas discovered while fixing convex/csvImport.test.ts — Date.now() is called internally by ctx.db.insert, coverage table hides fully-covered files
metadata:
  type: project
---

Convex mutations must do DB writes only, never CPU-heavy work (bcrypt, etc.) — mutations have a hard 1s execution limit, actions do not. `convex/csvImport.ts` was refactored (2026-07-06) to move bcrypt `hashPassword` calls out of `internalBulkImportStudentsBatch`/`internalBulkImportCatechistsBatch` (internal mutations) and into the `bulkImportStudents`/`bulkImportCatechists` actions, which now precompute `studentCode`/`memberId` + `passwordHash` per record (via a new `internalReserveCounters` internal mutation for the fast counter-reservation part) before calling the batch insert mutations.

**Why:** production timeouts ("Function execution timed out (maximum duration: 1s)") were traced to bcrypt.hashSync (12 rounds, ~150-300ms each) running up to 25x per batch inside a mutation.

**How to apply:** when reviewing/writing Convex mutations that do any per-item CPU-bound work in a loop (hashing, heavy parsing, crypto), flag it — that work belongs in an action, mutations should call it as an already-computed input.

Two convex-test gotchas surfaced while updating the tests for this refactor:

1. **`ctx.db.insert()` internally calls `Date.now()`** (see `node_modules/convex-test/dist/index.js` `_creationTime` assignment). This means `Date.now()` call counts inside a mutation handler are deterministic and can be used to simulate a genuine per-record insert failure with `vi.spyOn(Date, 'now').mockImplementation(...)` that throws on a specific call number — useful for testing per-item try/catch isolation in a batch-insert loop when there's no other natural way to make one record fail without modifying the source under test. Count carefully: every explicit `Date.now()` in app code PLUS one implicit call per `ctx.db.insert()`.

2. **Fully-covered files (100/100/100/100) can disappear from the printed vitest coverage text table** even though the underlying numbers are still counted in "All files" and thresholds. To check a specific file's real coverage, don't grep the printed table — rerun with `npx vitest run <pattern> --coverage --coverage.include='convex/path/to/file.ts'` to get an isolated summary.

Also: `vi.spyOn(passwordLib, 'hashPassword')` (spying on the imported module namespace, not a destructured binding) correctly intercepts calls made via `import { hashPassword } from './lib/password'` in the module under test — this pattern works for both mutations and actions in this codebase.

Global `npm test -- --coverage` thresholds (75% in `vitest.config.ts`) apply repo-wide, so running a scoped test file (e.g. `npm test -- csvImport --coverage`) will still print global ERROR lines for the whole repo's coverage — that's expected/ignorable per project convention (CLAUDE.md: "Only need to test files that are related to current task"). Check the specific file's row/isolated report instead of the global ERROR summary.
