# Plan 06 — Semester Generation on Academic Year Creation

KAN-23: https://thanh-nguyen-phuc.atlassian.net/browse/KAN-23

## Goal

Given I am `board` catechist, when I create a new academic year, the create
flow shows a numeric "number of semesters" input (default 2, min 1, **max 4**),
validated, with a hint that semesters cannot be changed after creation. The
update/edit flow hides this input entirely (existing semesters are immutable
via this form). On submit, the `create` mutation atomically inserts the
academic year **and** N semester docs (`semesterNumber` 1..N).

## Decisions (locked, see clarifying Q&A)

- **Cap at max 4** semesters per year (not unlimited). Ticket only states
  min 1/default 2, but `docs/04-academic-structure.md` and the `semesters`
  schema comment currently hardcode "exactly 2, only 1 or 2 allowed" — going
  fully unlimited contradicts that business rule with no upper guard. 4 is a
  safe ceiling that satisfies the ticket's literal ask (flexible, validated)
  without removing the guard rail. Validate both client (`Input` min/max) and
  server (mutation arg check) — never trust client-only validation.
- Do **not** add a `numberOfSemesters` field to the `academicYears` table —
  it's a one-time generation input, not a stored/computed value (CLAUDE.md:
  "Do not store computed values"). The semester count is always derivable via
  `ctx.db.query('semesters').withIndex('by_academic_year_id_and_semester_number', q => q.eq('academicYearId', id)).collect().length`.
- `semesterNumber` naming stays `1..N` (was hardcoded "1 or 2"); update the
  schema comment to reflect the new 1–4 range.
- Form field only renders when `dialogState.mode === 'create'` (no
  `initialValues`/no `yearId`); on edit it's omitted from the form entirely
  (not just disabled), matching the "cannot be updated" hint.

## Phase 0 — Documentation Discovery (done, via Explore subagent)

Sources read, no further discovery needed:

- `convex/schema.ts:22-32` — `academicYears` table fields: `name`,
  `startDate`, `endDate`, `timezone`, `isActive`, `isDeleted`. Indexes
  `by_name`, `by_is_deleted`, `by_start_date`.
- `convex/schema.ts:39-49` — `semesters` table: `academicYearId:
v.id('academicYears')`, `semesterNumber: v.number()` (comment currently says
  "Only 1 or 2 allowed" — update to 1–4), `name: v.optional(v.string())`,
  `isDeleted: v.boolean()`. Unique `(academicYearId, semesterNumber)` enforced
  app-side. Index `by_academic_year_id_and_semester_number`.
- `convex/academicYears.ts:59-88` — `create` mutation. Args: `requesterId,
name, startDate, endDate, timezone`. Calls `assertBoardRole(ctx,
args.requesterId)`, then `ctx.db.insert('academicYears', {...})`. **Does not
  touch semesters today** — this is the insertion point for the new arg +
  semester inserts.
- `convex/academicYears.ts:93-127` — `update` mutation, patches only year
  fields, untouched by this plan (no semester arg accepted here, by design).
- `convex/lib/errors.ts` — `ACADEMIC_YEAR_ERRORS` const object pattern
  (`DUPLICATE_NAME`, `CANNOT_DELETE_ACTIVE`). Add a sibling
  `SEMESTER_ERRORS.INVALID_COUNT` (or extend `ACADEMIC_YEAR_ERRORS`) following
  this exact shape — copy, don't invent a new error convention.
- `convex/_generated/ai/guidelines.md` — argument validators required on every
  function; `ctx.db.insert`/`ctx.db.patch`/`ctx.db.get` take the table name as
  first arg (this project's wrapped API, not bare Convex). A mutation handler
  can call `ctx.db.insert` multiple times (parent then children) — single
  mutation execution is one transaction, safe for inserting 1 year + up to 4
  semesters.
- `src/routes/_authenticated/academic-years.tsx`:
  - Lines 233 — `dialogState.mode === 'edit' ? dialogState.year :
undefined` decides create vs edit `initialValues`.
  - Lines 277-466 — `AcademicYearForm`, `@tanstack/react-form` `useForm` +
    `.Field` children render pattern, inline `onBlur` validators (no separate
    zod schema file for this form today).
  - Lines 306-354 — `onSubmit`: `if (yearId)` → `updateMutation`, else →
    `createMutation`. This is where the new `numberOfSemesters` value is read
    from form state and passed only into the create-mutation call.
  - Lines 364-381 — copy this exact `form.Field` + `Label` + `Input` +
    `flex flex-col gap-1.5` shape for the new numeric field; add a hint
    `<p className="text-muted-foreground text-sm">` line under the `Input`
    for the "cannot be changed after creation" copy (i18n key, not literal
    string — see `t('academicYears.fields...')` pattern used for existing
    labels/placeholders).
- `convex/academicYears.test.ts` (356 lines) — `convex-test` + `vitest`
  pattern: `const t = convexTest(schema, modules)`, `await
t.mutation(api.academicYears.create, {...})`, asserting inserted doc shape.
  No semester assertions yet — extend here.
- `src/routes/_authenticated/-academic-years.test.tsx` (771 lines) — RTL +
  vitest, mocked `useQuery`/`useMutation`/`useAuth`, covers dialog open/close,
  submit, create vs edit branches, field validation errors. Extend with cases
  for: field visible on create / absent on edit, default value 2, min/max
  validation, hint text rendered.
- `docs/schema/01-core-organization.md:23-47` — authoritative field tables for
  both `AcademicYear` and `Semester`; needs editing to reflect 1–4 range.
- `docs/04-academic-structure.md:5-9` — currently states "Each year has 2
  semesters" as a fixed fact; needs editing to "1–4, chosen at creation,
  default 2, immutable after creation."

**Allowed APIs (cite, don't invent):**

- `mutation`, `query` from `convex/_generated/server`
- `v.number()`, `v.optional(v.string())`, `v.id('academicYears')`
- `ctx.db.insert('semesters', {...})`, `ctx.db.insert('academicYears', {...})`
- `assertBoardRole(ctx, requesterId)` (existing helper, reused as-is)
- `@tanstack/react-form` `form.Field` render-prop pattern (existing usage only
  — no new form library)
- shadcn `Input`, `Label` (existing imports in `academic-years.tsx`)

**Anti-patterns to avoid:**

- Do not add `numberOfSemesters` as a persisted column on `academicYears`
  (violates "no computed/derivable stored values" rule).
- Do not use `.filter()` in any Convex query — use the existing
  `by_academic_year_id_and_semester_number` index.
- Do not validate only client-side — mutation must reject `< 1` or `> 4`
  server-side regardless of what the UI sends.
- Do not show/disable the field on edit — omit it from the render tree
  entirely on edit mode.

## Phase 1 — Backend: schema comment + create mutation + errors

1. `convex/schema.ts:39-49` — update the `semesterNumber` inline comment from
   "Only 1 or 2 allowed" to "1–4 allowed, set at academic year creation,
   immutable".
2. `convex/lib/errors.ts` — add `INVALID_SEMESTER_COUNT:
'ACADEMIC_YEAR_INVALID_SEMESTER_COUNT'` to `ACADEMIC_YEAR_ERRORS` (same
   object, same naming convention as existing keys).
3. `convex/academicYears.ts` `create` mutation:
   - Add arg `numberOfSemesters: v.number()`.
   - Validate `Number.isInteger(args.numberOfSemesters) &&
args.numberOfSemesters >= 1 && args.numberOfSemesters <= 4`; throw using
     the same error-throwing convention already used for
     `ACADEMIC_YEAR_ERRORS.DUPLICATE_NAME` in this file (copy that
     `throw`/error-shape exactly).
   - After `const academicYearId = await ctx.db.insert('academicYears',
{...})`, loop `for (let i = 1; i <= args.numberOfSemesters; i++) { await
ctx.db.insert('semesters', { academicYearId, semesterNumber: i,
isDeleted: false }) }`. Leave `name` unset (optional field) — no i18n
     label generation logic invented here, matches schema's "optional" intent.

**Verification:**

- `npx convex dev` / typecheck passes (mutation args + table inserts compile).
- New/updated tests in `convex/academicYears.test.ts` (Phase 4) green.
- Grep: `grep -n "Only 1 or 2" convex/schema.ts` returns nothing after edit.

## Phase 2 — Backend tests (delegate to `unit-test-writer` agent)

Per CLAUDE.md, all mutation changes require unit tests via the
`unit-test-writer` agent. Extend `convex/academicYears.test.ts` using the
existing `convexTest(schema, modules)` + `t.mutation(api.academicYears.create,
{...})` pattern:

- `create` with `numberOfSemesters: 2` (default) inserts 1 academicYear doc +
  2 semester docs with `semesterNumber` 1 and 2.
- `create` with `numberOfSemesters: 1` inserts exactly 1 semester.
- `create` with `numberOfSemesters: 4` inserts exactly 4 semesters.
- `create` with `numberOfSemesters: 0` throws
  `ACADEMIC_YEAR_ERRORS.INVALID_SEMESTER_COUNT`.
- `create` with `numberOfSemesters: 5` throws same error (max boundary).
- `create` with non-integer (e.g. `1.5`) throws same error.
- Assert `update` mutation is untouched — no semester side effects when
  patching an existing year (regression guard).

**Verification:** `npm test -- --coverage` — `convex/academicYears.ts`
statements/branches/functions/lines all ≥ 85% (CLAUDE.md gate).

## Phase 3 — Frontend: form field (create-only) + hint + submit wiring

`src/routes/_authenticated/academic-years.tsx`:

1. In `AcademicYearForm`, add `numberOfSemesters` to `useForm`'s
   `defaultValues` — `2` when `mode === 'create'` (field unused/irrelevant on
   edit since it won't render).
2. Add a new `form.Field name="numberOfSemesters"` block, copying the
   structural shape of the existing `name` field block (lines 364-381):
   - `Input type="number" min={1} max={4} value={field.state.value}
onChange={(e) => field.handleChange(Number(e.target.value))}
onBlur={field.handleBlur}`.
   - Inline validator (same `onBlur`-validator convention already used in
     this file) rejecting non-integer, `< 1`, `> 4` with an i18n error key
     (follow existing error-key naming next to `academicYears.fields.*`).
   - Hint text under the input, i18n key e.g.
     `academicYears.fields.numberOfSemesters.hint`, content: "Cannot be
     changed after the academic year is created."
   - **Wrap this entire `form.Field` block in `{mode === 'create' && (...)}`**
     (or equivalent condition already used to distinguish dialog mode in this
     component) so it's absent from the DOM on edit, not just hidden/disabled.
3. In `onSubmit` (lines 306-354), in the `else` (create) branch only, pass
   `numberOfSemesters: value.numberOfSemesters` into the `createMutation`
   call. The `if (yearId)` (update) branch is untouched — it never sends this
   field.
4. Add the new i18n keys (`fields.numberOfSemesters`, `.placeholder`,
   `.hint`, validation error key) to whatever locale file(s) back
   `t('academicYears.fields...')` in this project (find via existing key
   usage, mirror file/locale structure exactly — do not invent a new i18n
   namespace).

**Verification:**

- Manual: open create dialog → field visible, defaults to 2, hint visible;
  open edit dialog on existing year → field absent.
- Manual: enter 0 or 5 → inline validation error, submit blocked.
- `npx tsc --noEmit` (or project's typecheck script) passes.

## Phase 4 — Frontend tests (delegate to `unit-test-writer` agent)

Extend `src/routes/_authenticated/-academic-years.test.tsx` using its existing
mocked `useQuery`/`useMutation`/`useAuth` + RTL pattern:

- Create dialog renders the numeric field with default value `2`.
- Edit dialog does **not** render the numeric field.
- Hint text is present in create dialog.
- Submitting create with value `1` calls `createMutation` with
  `numberOfSemesters: 1`.
- Submitting create with value `0` or `5` shows validation error and does
  _not_ call `createMutation`.
- Submitting edit never includes `numberOfSemesters` in the `updateMutation`
  call args (regression guard).

**Verification:** `npm test -- --coverage` — file-level and project-level
statements/branches/functions/lines all ≥ 85% (CLAUDE.md gate, same command
as Phase 2).

## Phase 5 — Docs update

- `docs/schema/01-core-organization.md` — `Semester` table row for
  `semester_number`: change "Only 1 or 2 allowed" to "1–4, set once at
  academic year creation, immutable".
- `docs/04-academic-structure.md:5-9` — replace "Each year has 2 semesters"
  with "Each year has 1–4 semesters, chosen by the board catechist at
  creation (default 2) and immutable thereafter."

**Verification:** `grep -rn "2 semesters\|Only 1 or 2" docs/` returns nothing.

## Final Phase — Verification

1. `npm run typecheck` (or equivalent) — no errors.
2. `npm test -- --coverage` — all four metrics ≥ 85% project-wide (CLAUDE.md
   gate).
3. `npx eslint .` — no `@convex-dev/no-filter-in-query` violations, no new
   lint errors.
4. Manual smoke test (per CLAUDE.md UI rules): create an academic year with
   3 semesters via the dialog, confirm 3 `semesters` docs exist (via Convex
   dashboard/data tool), then edit that same year and confirm the numeric
   field is absent and existing semesters are untouched.
5. Code review via `ts-react-reviewer` agent on the full diff before merge
   (CLAUDE.md gate).
