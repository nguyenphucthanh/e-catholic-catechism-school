---
name: convex-backend-test-pattern
description: convex-test + vitest boilerplate/conventions used across convex/*.test.ts backend unit tests in this repo
metadata:
  type: project
---

Reference test files: `convex/assignments.test.ts`, `convex/classSessions.test.ts`, `convex/students.test.ts`. New backend test files should copy this shape exactly.

Boilerplate at top of every `convex/*.test.ts`:
```ts
/// <reference types="vite/client" />
/* eslint-disable no-shadow */
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'
import type { Id } from './_generated/dataModel'
const modules = import.meta.glob('./**/*.ts')
```
Each `test()` does `const t = convexTest(schema, modules)`, seeds fixtures inside `t.run(async (ctx) => {...})` (ctx.db.insert directly — bypasses auth/mutation logic, used only for arranging state), then calls `t.query(api.module.fn, args)` / `t.mutation(...)` to exercise the actual handler, then asserts either the return value or re-reads state via another `t.run`.

Shared seed helpers pattern (re-declare per file, not imported — each test file is self-contained): `seedAdmin`, `seedCatechist(ctx, memberId, fullName, opts)`, `seedActiveYear`/`seedInactiveYear`, `seedBranch`, `seedClass`, `seedClassYear`, `makeBoardMember`/`makeBranchHead`/`makeClassCatechist` for `academicYearAssignments`/`branchAssignments`/`classCatechists` rows. Copy these verbatim into new test files rather than reinventing — keeps assertion style consistent across the suite.

Assertion style for errors: `await expect(t.mutation(...)).rejects.toThrow('EXACT_ERROR_CODE_STRING')` — this repo's error codes are plain string constants (e.g. `CALENDAR_EVENT_ERRORS.UNAUTHORIZED`), so `toThrow` with the literal code string works directly (no need for custom Error subclasses).

Backend tests run under the `backend` project in `vitest.config.ts` (`environment: 'edge-runtime'`, `include: ['convex/**/*.test.ts']`, `testTimeout: 15000` — raised because bcrypt hashing in `convex/lib/password.ts` is CPU-bound).

See also [[coverage_text_table_missing_row_quirk]] for a reporting gotcha hit while verifying coverage on this pattern.
