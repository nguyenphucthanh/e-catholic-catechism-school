# Plan 05 — Academic Year Views + Global Selected-Year State

## Goal

Board-managed CRUD for `AcademicYear`, readable by all catechists. After login, a
sidebar dropdown shows the latest years with the current `isActive` year
pre-selected; the selection is global client state used to scope future
year-dependent queries (classes, attendance, grading).

## Decisions (locked in brainstorm)

- Route: `/academic-years` — top-level nav item, visible to everyone (read).
  Create/Edit/Delete actions hidden for non-board, and re-enforced server-side.
- **`isActive` (server truth) ≠ `selectedYearId` (client state).** `isActive` is
  the single parish-wide operational year, board-controlled, lives in
  `academicYears` table. `selectedYearId` is per-browser browsing context,
  defaults to `isActive` on first load, persisted to `localStorage`, lets any
  catechist browse a past year's data without touching what's active for
  everyone else.
- Sidebar dropdown lists the 5 most recent years (by `start_date` desc), is a
  pure switcher (read-only). Setting which year is `isActive` only happens on
  the `/academic-years` management page, board-only action.

## Phase 0 — Documentation Discovery (already done inline)

Sources read, no further discovery subagents needed:

- `convex/schema.ts:21-27` — `academicYears` table: `name`, `startDate`,
  `endDate`, `timezone`, `isActive`, `isDeleted`. Index `by_name`,
  `by_is_deleted`. No index on `startDate` yet — need one for "latest N".
- `convex/_generated/ai/guidelines.md` — confirms: queries/mutations use
  `query`/`mutation` from `./_generated/server`, args via `v.*` validators,
  return validators optional but encouraged, indexes via `.withIndex`, no
  `.filter()` in queries (lint rule `@convex-dev/no-filter-in-query` — seed.ts
  has one exception with an eslint-disable, don't repeat that pattern in new
  code, use an index instead).
- `convex/auth.ts` — **no Convex Identity/session.** Custom credential system:
  client holds `AuthUser` (incl. `role`) in `localStorage` after `login`
  mutation, passes IDs as explicit args to every subsequent call. Role checks
  in mutations must take a `requesterId: v.id('catechists')` arg and look the
  role up server-side — never trust a client-supplied role string.
- `convex/catechists.ts` — pattern for queries/mutations: `ctx.db.get('table',
id)`, `ctx.db.patch('table', id, fields)` (table name passed explicitly —
  this project's generated server wraps the usual Convex API, follow this
  signature, don't use the bare `ctx.db.get(id)` form from generic Convex
  docs/training).
- `convex/catechists.test.ts` — test pattern: `convexTest(schema, modules)`,
  seed via `t.run(ctx => ctx.db.insert(...))`, call via `t.query`/`t.mutation`.
- `src/lib/auth.tsx` — Context + `localStorage` pattern for global client
  state. Copy this shape for the new `AcademicYearProvider`.
- `src/routes/_authenticated.tsx` — layout wraps `AppSidebar` + `Outlet`,
  reads `useAuth()`. New provider must wrap inside (or alongside)
  `AuthProvider` so `useAuth()` (for `role`) is available when resolving the
  default selected year.
- `src/components/app-sidebar.tsx` — `navItems` array + `SidebarHeader`. Add
  nav entry here; add the year-switcher as its own block in `SidebarHeader`
  near the app name, not inside `navItems` (it's not a navigation link).
- `src/routes/_authenticated/profile.tsx` — full reference for: TanStack Form
  - zod validators + shadcn `Field`-style `Label`/`Input`/`Select` (lines
    92–254 form, 337–397 form with date inputs, 488–746 dialog add/edit pattern,
    883–927 `AlertDialog` delete-confirm pattern). Copy this shape exactly for
    the academic year create/edit dialog and delete confirm — don't invent a
    new form pattern.
- `src/components/custom/data-table.tsx` + `data-table-demo.tsx` — `DataTable`
  component, client-managed state mode (`columns`, `data`, `searchColumnKey`).
  Years list will be small (single digits to low tens of rows) — use
  client-side mode, not the server/URL-synced mode.
- `docs/03-auth-access-control.md` — permission matrix: `board` role is the
  only one with program-wide write access; matches the create/update gate
  here.
- `docs/schema/01-core-organization.md` — `AcademicYear` field list, confirms
  `is_active` semantics ("Only one year active at a time").

**Allowed APIs (cite, don't invent):**

- `query`, `mutation` from `convex/_generated/server`
- `v.string()`, `v.boolean()`, `v.id('academicYears')`, `v.optional(...)`
- `ctx.db.query('academicYears').withIndex(...).order('desc').collect()`
- `ctx.db.get('academicYears', id)`, `ctx.db.patch('academicYears', id, {...})`,
  `ctx.db.insert('academicYears', {...})`
- `useQuery`, `useMutation` from `convex/react`
- `useForm` from `@tanstack/react-form`
- `createFileRoute` from `@tanstack/react-router`

**Anti-patterns to avoid:**

- Don't use `.filter()` on a Convex query — add/use an index.
- Don't read `role` off the client `AuthUser` object inside a mutation to
  authorize a write — that's client-controlled. Always re-fetch the
  `catechists` doc by `requesterId` server-side and check `role` there.
- Don't invent a `ctx.db.get(id)` one-arg call — this codebase's wrapper takes
  the table name as the first arg (see `catechists.ts`).
- Don't build a new global-state library (no zustand/redux in deps) — Context
  - `localStorage`, matching `auth.tsx`, is the established pattern.

---

## Phase 1 — Schema: index for "latest N years"

**What:** Add `.index('by_start_date', ['startDate'])` to the `academicYears`
table in `convex/schema.ts` (alongside the existing `by_name`,
`by_is_deleted`). Needed to query latest years in `order('desc')` without a
table scan + in-memory sort.

**Where:** `convex/schema.ts:21-27` (the `academicYears` table block).

**Verification:**

- `npx tsc --noEmit` clean.
- `npx convex dev` (or whatever the project's dev command is) accepts the
  schema without error.

---

## Phase 2 — Convex backend: `convex/academicYears.ts` + role-check helper

**What to implement:**

1. `convex/lib/authz.ts` (new file) — `assertBoardRole(ctx, requesterId:
Id<'catechists'>)`: loads the catechist by id, throws if missing, inactive,
   soft-deleted, or `role !== 'board'`. Single shared helper so create/update
   mutations don't duplicate the check. Copy the lookup shape from
   `convex/auth.ts:36-48` (`ctx.db.get('catechists', id)`).

2. `convex/academicYears.ts` (new file):
   - `list` query (no args) — read for everyone. Returns all
     non-deleted years (`isDeleted: false`), sorted desc by `startDate`. Used
     by the `/academic-years` table.
   - `listRecent` query `{ limit: v.optional(v.number()) }` (default 5) —
     `withIndex('by_start_date')`, `.order('desc')`, `.take(limit)`, filter
     `isDeleted === false` in the handler (small N, fine without an index on
     the boolean combo). Used by the sidebar dropdown.
   - `getActive` query (no args) — returns the single year with `isActive:
true` (or `null`). Used to resolve the default `selectedYearId` on first
     load/login.
   - `create` mutation `{ requesterId, name, startDate, endDate, timezone }` —
     `assertBoardRole`, then `ctx.db.insert('academicYears', { ...args,
isActive: false, isDeleted: false })`. New years never auto-activate;
     activation is explicit (see `setActive`).
   - `update` mutation `{ requesterId, academicYearId, name?, startDate?,
endDate?, timezone? }` — `assertBoardRole`, `ctx.db.patch(...)` with only
     provided fields.
   - `setActive` mutation `{ requesterId, academicYearId }` — `assertBoardRole`,
     then: patch every other year's `isActive` to `false`, patch the target to
     `true`. Do this in a loop over `ctx.db.query('academicYears').collect()`
     inside the same mutation (Convex mutations are transactional/serialized
     per `docs/03-auth-access-control.md` counter pattern — same guarantee
     applies here).
   - `softDelete` mutation `{ requesterId, academicYearId }` — `assertBoardRole`,
     refuse if `isActive === true` (must deactivate/reassign active status
     first — surface this as a thrown `Error` with a clear message for the UI
     to toast), else `ctx.db.patch(..., { isDeleted: true })`.

**Documentation references:** `convex/catechists.ts` (full file) is the
direct template for query/mutation shape, arg validators, and `ctx.db.*` call
signatures in this codebase.

**Verification:**

- `npx tsc --noEmit` clean.
- Unit tests (Phase 2b, via `unit-test-writer` agent per `CLAUDE.md`/`AGENTS.md`
  rule) cover: read access for non-board, write rejection for non-board,
  `setActive` flips exactly one year, `softDelete` blocked on active year,
  `listRecent` ordering/limit.

**Anti-pattern guards:**

- No `.filter()` in any query — use `withIndex` or in-memory filter only after
  an index-narrowed `.collect()`/`.take()` on small result sets (the
  `isDeleted` post-filter on `listRecent` is acceptable here because the
  index already narrows to a handful of rows by date order).
- Every write mutation takes `requesterId` and calls `assertBoardRole` —
  no mutation trusts a `role` field passed directly from the client.

---

## Phase 2b — Unit tests (delegate to `unit-test-writer` agent)

Per the `CLAUDE.md`/`AGENTS.md` rule ("every component/function
creation/update must include unit tests"), hand Phase 2 and Phase 3/4 work to
the `unit-test-writer` agent immediately after each is implemented — don't
batch it to the end. Tests follow `convex/catechists.test.ts`'s
`convexTest(schema, modules)` pattern for backend, and existing
`*.test.tsx` files (e.g. `profile.test.tsx`) for frontend component tests.

---

## Phase 3 — Frontend: `AcademicYearProvider` (global selected-year state)

**What to implement:** `src/lib/academic-year.tsx` (new file), mirroring
`src/lib/auth.tsx` exactly:

- `AcademicYearContext` holding `{ selectedYearId: Id<'academicYears'> | null,
setSelectedYearId: (id) => void }`.
- Persist to `localStorage` under a new key (e.g. `giaoly_selected_year`),
  same lazy-init pattern as `auth.tsx:22-30`.
- On mount, if no persisted value (or the persisted id no longer resolves —
  see Phase 4 query), resolve default via `api.academicYears.getActive` and
  set it once available.
- Export `useSelectedAcademicYear()` hook mirroring `useAuth()`.

**Where to wire it:** wrap `AcademicYearProvider` around the router's `Wrap`
in `src/router.tsx` (alongside/inside wherever `AuthProvider` is wired —
check `src/routes/__root.tsx` since `auth.tsx`'s `AuthProvider` isn't visible
in the files read so far; locate it there first) so it's available from
`_authenticated.tsx` and below.

**Verification:** component test for the provider/hook (delegate to
`unit-test-writer`) — covers: defaults to `isActive` year when nothing
persisted, persists selection across remount, falls back gracefully if
persisted id no longer exists.

**Anti-pattern guards:** don't add a state library dependency; don't put this
state in TanStack Router's search params (it's cross-route global state, not
URL-shareable per the brainstorm — sidebar dropdown, not a route param).

---

## Phase 4 — Frontend: sidebar year-switcher

**What to implement:** new `src/components/year-switcher.tsx`, rendered
inside `SidebarHeader` in `src/components/app-sidebar.tsx`, above or below
the existing app-name `SidebarMenuItem` (app-sidebar.tsx:146-161).

- `useQuery(api.academicYears.listRecent, { limit: 5 })`.
- `useSelectedAcademicYear()` for current value + setter.
- Render with shadcn `Select` (already used in `profile.tsx` for gender —
  copy that pattern) or `DropdownMenu` if a richer item (e.g. "Active" badge
  next to the system-active year) is wanted — recommend `Select` for
  simplicity, badge the active year's label text with a "(active)" suffix
  instead of a separate `Badge` component to keep it compact in the trigger.
- Loading state: skeleton/disabled trigger while `listRecent` is `undefined`.

**Verification:** component test (delegate to `unit-test-writer`) — renders
list, selecting an item calls `setSelectedYearId`, active year shows the
"(active)" marker.

---

## Phase 5 — Frontend: `/academic-years` route

**What to implement:** `src/routes/_authenticated/academic-years.tsx`
(new file), structured like `profile.tsx` but as a full-page list:

- `PageHeader` (copy `profile.tsx:959` pattern) with an appropriate icon
  (e.g. `CalendarRange` from `lucide-react`).
- `DataTable` (client-side mode, per `data-table-demo.tsx`) with columns:
  name, start_date, end_date, timezone, active (badge), actions
  (edit/delete — board only, via `DropdownMenu` per `profile.tsx:811-843`).
- "Create" button in the header area, board-only (`useAuth().user?.role ===
'board'` to show/hide — UI-only gate, real gate is server-side in Phase 2).
- Create/Edit dialog: `Dialog` + TanStack Form + zod, copying
  `ContactDialogForm` shape (`profile.tsx:488-746`) — fields: name (text,
  required), startDate/endDate (date inputs, required, zod refine
  `endDate > startDate`), timezone (text input or a small fixed `Select` of
  common IANA zones — recommend free-text input with a placeholder example,
  since the doc only requires "IANA timezone string", not a fixed enum).
- Delete: `AlertDialog` confirm, copying `profile.tsx:883-927` — call
  `academicYears.softDelete`, catch the "active year" rejection and toast it
  via `t(...)` (add a new i18n key) rather than a generic error.
- "Set Active" action: a `DropdownMenuItem` per row (board-only), calls
  `academicYears.setActive`, toast success — this is the only place
  `isActive` is changed (locked decision: not from the sidebar dropdown).

**Add nav entry:** `src/components/app-sidebar.tsx` `navItems` array — new
item `{ title: t('nav.academicYears'), url: '/academic-years', icon:
CalendarRange }`. Visible to all (read access), per locked decision.

**i18n:** add `nav.academicYears` and an `academicYears.*` namespace block to
`src/lib/i18n.ts` (check its structure first — `profile.*` / `password.*`
keys are the existing pattern, follow the same nesting).

**Verification:**

- Route test (`*.test.tsx` pattern, e.g. `profile.test.tsx`) covering:
  non-board sees no create/edit/delete controls, board sees them, create
  flow inserts and shows in table, delete-active-year shows error toast.
- Manual check via `/run` skill: log in as board, create a year, set it
  active, confirm sidebar switcher updates; log in as non-board catechist,
  confirm read-only.

---

## Phase 6 — Verification

1. `npx tsc --noEmit` — clean across the whole repo.
2. Run full test suite (`npm test` or project's vitest command) — all new
   and existing tests pass.
3. Grep check: `grep -rn "ctx.db.get(" convex --include='*.ts'` — confirm no
   new call uses the bare one-arg form (table name must be passed explicitly,
   per this codebase's wrapper).
4. Grep check: `grep -rn "\.filter(" convex/academicYears.ts` — should be
   empty (no filter-in-query violations).
5. Manual run-through via `/run` skill: board create/edit/setActive/delete
   flow, non-board read-only enforcement, sidebar switcher persists across
   reload, defaults to active year on fresh login.
