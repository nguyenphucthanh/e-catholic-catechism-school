[← Back to index](README.md)

## 15. Anti-Patterns

Mistakes seen (or easy to make) in this codebase. Each one has bit us or a similar project before — treat as hard "don't."

### 15.1 Convex Backend

- **`.filter()` in queries** — never use it. Define index in schema, query with `.withIndex(...)`. `.filter()` full-scans.
- **`.collect().length` for counts** — no free count in Convex. Maintain denormalized counter doc, updated in mutations, if a count must stay cheap at scale.
- **`.collect()` / `.take(n)` to delete rows** — Convex has no bulk `.delete()`. Batch with `.take(n)`, loop `ctx.db.delete()`, repeat until empty.
- **Unbounded array field on a document** (e.g. `v.array(v.object({...}))` that grows without bound) — hits 1MB doc limit, rewrites whole doc on every update. Use child table + foreign key instead.
- **`userId` passed as a function arg for authorization** — never trust a client-supplied identity. Always derive via `ctx.auth.getUserIdentity()` server-side.
- **`identity.subject` as global identity key** — use `identity.tokenIdentifier`, the guaranteed stable identifier.
- **`ctx.db` inside an action** — actions have no DB access. Call a query/mutation via `ctx.runQuery`/`ctx.runMutation` instead.
- **`"use node"` in a file that also exports queries/mutations** — only actions run in Node runtime. Split into separate files.
- **Eligibility-query / mutation predicate drift** — when a query predicts whether a later mutation will succeed (e.g. `getEligibleForTransfer` predicting `enrollStudents`'s conflict check), the query's predicate must mirror the mutation's _actual_ check exactly, not an approximation. Seen bug: query flagged any active/on_leave enrollment in target year, but mutation (`hasPrimaryClassConflict`) only rejects primary-class conflicts — blocked valid transfers for students with only elective enrollments. When adding this pattern, write the predicate by copy-checking the real mutation logic, not by re-deriving intent.
- **`sortBy` validator drift** — frontend column IDs (e.g. `catechist_role`) must exist in the backend's `sortBy` union validator, or Convex throws `ArgumentValidationError` at runtime, not compile time. When adding a sortable column, check the corresponding backend validator list, or disable sorting on that column (`enableSorting: false`).
- **Read-side query using unscoped authorization while write-side mutation scopes per-class** — recurring gap. `getEligibleForTransfer`/`getEligibleForEnrollment`-style queries must apply the same authorization scope as their mutation counterpart, not skip it because "it's just a read."

### 15.2 Schema / Data Model

- **Hard delete** — every entity table (except `ScoreEntryHistory`, `counters`) uses `is_deleted` soft delete. Never `ctx.db.delete()` a user-facing entity; flip the flag. Active-record queries must filter `is_deleted = false`; historical-reference resolution (e.g. `AttendanceRecord.recordedBy`) must still resolve through soft-deleted rows.
- **Writing to a locked academic year** — mutations touching year-scoped entities (classes, enrollments, grades, attendance) must check `academic_year.is_active = true` before writing. Don't skip this check because "the UI already prevents it" — UI checks are not a substitute for mutation-layer enforcement.
- **Raw phone strings** — never store user-typed phone input as-is. Normalize with `parsePhoneNumber(value).format('E.164')` (`libphonenumber-js`) before writing to `GuardianContact.value` / any phone field.
- **Zero-padding IDs in storage** — `member_id`/`student_code` are stored as raw integers. Padding (`padStart(6, '0')`) is display-only; don't pad before storing or use it as a lookup key.

### 15.3 UI / Frontend

- **Hand-editing `src/components/ui/*`** — these are shadcn-generated. Fix mismatches at the call site; regenerate via shadcn CLI if the base component truly needs a change.
- **Custom HTML/CSS table or form when shadcn already covers it** — check shadcn MCP first. List views use `DataTable`; create/edit use zod + TanStack Form + shadcn `Field`.
- **Global "inactive year" banners** — the alert must be page-scoped (rendered only on pages that actually show year-scoped data), driven by the page's own academic-year id, not the global year-selector context (§9.14). A global banner produces false warnings on non-year-scoped pages (catechist profiles, branch settings).
- **Displaying `fullName` without leading `saintName`** — Catholic naming convention requires `${saintName} ${fullName}` everywhere a person is shown, and `saintName` field before `fullName` in every edit form. Use `formatPersonName()` from `src/lib/name.ts`, don't hand-roll string concatenation per component.
- **Radix-specific patterns/docs for shadcn components** — this project's shadcn is built on Base UI (`@base-ui/react`), not Radix. APIs differ; consult `/shadcn-baseui` skill or Base UI docs, not Radix docs.
- **Exporting raw API response instead of visible table state** — CSV/PDF export must reflect the table's current filter/sort, not the unfiltered query result.
- **jsPDF built-in fonts for Vietnamese text** — they lack Vietnamese diacritic glyphs and render garbled. Use `pdfmake` with the bundled Roboto font per `src/lib/export.ts`.
- **`useNavigate()` for button navigation** — if you want to implement a button with `useNavigate()`, then you should use TanStack Router's `Link` component instead, then use `Button`'s `render` prop to render `Link`. This is to take advantage of the `<a>` element in the browser so the user can open a new tab, which a `<button>` cannot do.

### 15.4 Testing

- **Skipping unit tests for new components/functions** — required per project rule, written via `unit-test-writer` agent, not skipped because "it's a small change."
- **Chasing 100% coverage project-wide** — only files touched by the current task need to clear the 75% bar; don't run/fix the entire suite's coverage as part of an unrelated change.
- **Mocking around a real constraint just to make a test pass** — e.g. bypassing an "inactive year" insert restriction by inserting test fixtures directly instead of exercising the actual mutation path, when the test's purpose is to verify that restriction. Fine for _unrelated_ setup data; wrong when it's the behavior under test.
