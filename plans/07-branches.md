# Plan 07 — Branches (Ngành) List View

## Jira

KAN-51 "Create list view to manage branch" (parent epic KAN-50 "Create
Branches Management").

> Given I am `board` member. When I visit application then I want to see a
> sidebar menu Branches (under Academic Year). When I visit Branches page
> then I want to see list view to manage all branches. When I see each branch
> row then I want to see a dropdown menu with basic actions, and a control to
> change branch's order.

## Decisions (locked with user)

- **Reorder control:** up/down arrow buttons, not drag-and-drop. No new
  dependency (dnd-kit not installed); matches a simple `sortOrder` swap
  mutation.
- **Sidebar placement:** sibling nav item to "Academic Year" in the flat
  `navItems` array (not nested) — no sidebar refactor needed.
- **Delete:** allowed, soft-delete via existing `isDeleted` field, same
  confirm-dialog pattern as academic-years. Board-only, same as all other
  mutations.
- Route: `/branches` — board-only page (list visible to board only, per
  ticket "Given I am board member"; unlike academic-years this isn't a
  shared read for all catechists).

## Phase 0 — Documentation Discovery (already done)

Findings from exploration of the existing codebase (academic-years is the
direct precedent — copy its shape, don't invent new patterns):

- **Schema** — `convex/schema.ts:11-16`:
  ```ts
  branches: defineTable({
    name: v.string(),
    sortOrder: v.number(), // 1 = Chiên Con … 6 = Dự Trưởng; must be unique per application layer
    description: v.optional(v.string()),
    isDeleted: v.boolean(),
  }).index('by_is_deleted', ['isDeleted']),
  ```
  No `by_name` or `by_sort_order` index yet — needed for list query and
  duplicate-name check (add both, see Phase 1).
- **Seed data** — `convex/seed.ts:5-12`: 6 fixed branches, `sortOrder` 1–6,
  Vietnamese names (Chiên Con, Ấu Nhi, Thiếu Nhi, Nghĩa Sĩ, Hiệp Sĩ, Dự
  Trưởng).
- **Convex query/mutation pattern** — `convex/academicYears.ts` (full file
  read):
  - `list` (lines 11-21): `.withIndex(...).order(...).collect()` then
    `.filter(y => !y.isDeleted)` in JS (not `.filter()` in the query —
    lint rule `@convex-dev/no-filter-in-query` forbids query-builder
    `.filter()`).
  - `create` (lines 59-107): `assertBoardRole(ctx, args.requesterId)` first,
    duplicate-name check via index + `.collect()` + `.some()` (not
    `.unique()`, because soft-deleted rows can share a name), insert with
    `isDeleted: false`.
  - `update` (lines 112-146): board check, existence + not-deleted check,
    conditional duplicate-name check only if name changed, `ctx.db.patch`.
  - `softDelete` (lines 183-204): board check, existence check, `ctx.db.patch`
    with `{ isDeleted: true }`. Academic-years also blocks deleting the
    _active_ year — branches have no "active" concept so this guard doesn't
    carry over.
  - Authorization: `assertBoardRole` from `convex/lib/authz.ts` — copy
    exactly, every mutation takes `requesterId: v.id('catechists')` as first
    arg, never trust a client role string.
  - Errors: academic-years centralizes messages in
    `convex/lib/errors.ts` (`ACADEMIC_YEAR_ERRORS`) per recent refactor
    (commit `23` in project history "Extract academic year error messages to
    centralized constant"). Do the same: add `BRANCH_ERRORS` to
    `convex/lib/errors.ts`.
- **Route file** — `src/routes/_authenticated/academic-years.tsx` (full file
  read), the direct template:
  - `createFileRoute('/_authenticated/academic-years')({ component,
staticData: { crumb: 'academicYears.title' } })` (line 44-47).
  - Data hooks (lines 60-64): one `useQuery` for list, one `useMutation` per
    action.
  - `DataTable` usage (lines 203-209): `columns`, `data`, `searchColumnKey`,
    `searchPlaceholder` props — component at
    `src/components/custom/data-table.tsx`.
  - Column defs (lines 104-133): `accessorKey`, custom `cell` renderers,
    `Badge` for status-like fields (branches has no status field, so no
    Badge column needed — but the **order column** itself doubles as a
    "group-by ready" sortable column per CLAUDE.md rule).
  - Row-actions dropdown (lines 141-173): `DropdownMenu` +
    `DropdownMenuTrigger render={<Button .../>}` + `DropdownMenuItem
onClick={...}` — **use `onClick`, not `onSelect`** (recent refactor,
    commit `3f88c26`).
  - Dialog state machine (lines 51-68): discriminated union `DialogState =
{ mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; year: ... }`,
    single `setDialogState` setter.
  - Delete confirm dialog: shadcn `AlertDialog`/`Dialog`, `deleteTarget`
    state, same shape as academic-years' delete flow.
  - Skeleton loading (lines 195-209): `years === undefined` → pulse
    skeletons, else render `DataTable`.
- **Sidebar** — `src/components/app-sidebar.tsx`:
  - `navItems` array (lines 138-149), flat list of `{ title, url, icon }`.
    Add `{ title: t('nav.branches'), url: '/branches', icon: GitBranch }`
    (or similar lucide-react icon not already imported) right after the
    Academic Year entry.
  - Import the new icon at top (existing imports list at line 4 area).
  - Rendering loop (lines 174-189) needs no change — it already maps over
    `navItems` generically.
- **Breadcrumbs / i18n** — `staticData: { crumb: 'branches.title' }` on the
  route; add keys to **both** `src/locales/en.json` and
  `src/locales/vi.json` following the `academicYears.*` namespace shape
  (lines 99-134 of en.json): `branches.title`, `branches.subtitle`,
  `branches.col.*`, `branches.dialog.*`, `branches.fields.*`,
  `branches.actions.*`, `branches.delete.*`, plus `nav.branches`.
- **Tests** — precedent files to copy structure from:
  - `convex/academicYears.test.ts` — `convexTest(schema, modules)`, seed via
    `t.run`, assert via `t.query`/`t.mutation`, cover: unauthorized caller
    rejected, create/update/list/delete happy paths, duplicate-name
    rejection, not-found errors.
  - `src/routes/_authenticated/-academic-years.test.tsx` — mock
    `useQuery`/`useMutation` with `vi.mocked()`, render the route's
    `.options.component` directly, assert board-only UI gating, dialog
    open/close, form submit, error toasts via `sonner`.

## Phase 1 — Convex backend (`convex/branches.ts`)

Delegate to **convex-feature-builder** agent. Give it this spec:

1. Add indexes to `branches` table in `convex/schema.ts`: `by_name` (`name`)
   and keep `by_is_deleted`. Add `by_sort_order` (`sortOrder`) for ordered
   listing.
2. Add `BRANCH_ERRORS` to `convex/lib/errors.ts`: `DUPLICATE_NAME`,
   `NOT_FOUND` (mirror `ACADEMIC_YEAR_ERRORS` shape).
3. `convex/branches.ts`:
   - `list` query — no args, `.withIndex('by_sort_order').order('asc')`,
     filter out `isDeleted` in JS, return all (no pagination — fixed small
     set).
   - `create` mutation — `requesterId`, `name`, `description?`. Board-only.
     New branch gets `sortOrder = max(existing sortOrder) + 1`. Duplicate
     non-deleted name → `BRANCH_ERRORS.DUPLICATE_NAME`.
   - `update` mutation — `requesterId`, `branchId`, `name?`, `description?`.
     Board-only, existence check, conditional duplicate-name check on
     rename.
   - `softDelete` mutation — `requesterId`, `branchId`. Board-only,
     existence + not-already-deleted check, patch `isDeleted: true`. No
     "is active, can't delete" guard (branches have no active concept) —
     but **do** check the branch isn't referenced by a non-deleted `class`
     row before allowing delete (look up the `classes` table's branch
     foreign key — confirm exact field name in schema before writing this
     check; if classes reference branches, block delete with a clear error
     rather than orphaning data).
   - `moveUp` / `moveDown` mutations (or a single `reorder` mutation taking
     `direction: 'up' | 'down'`) — `requesterId`, `branchId`. Board-only.
     Find the adjacent non-deleted branch by `sortOrder` and swap the two
     `sortOrder` values via two `ctx.db.patch` calls. No-op (or throw) if
     already at the top/bottom.
4. Write/verify return validators per project convention (check a couple
   more `convex/*.ts` files quickly if `academicYears.ts` doesn't show one,
   to confirm whether return validators are mandatory or optional in this
   codebase before adding them).

**Verification:** `npx convex dev --once` (or whatever this project's
typecheck command is) compiles with no errors; manually trace each mutation
against `convex/_generated/ai/guidelines.md` rules (no `.filter()` in
queries, explicit table name in `ctx.db.get`/`patch`, `requesterId` checked
via `assertBoardRole`).

## Phase 2 — Frontend route (`src/routes/_authenticated/branches.tsx`)

Build directly off `academic-years.tsx` as a template, adapted:

1. `createFileRoute('/_authenticated/branches')({ component,
staticData: { crumb: 'branches.title' } })`.
2. `PageHeader` with title/subtitle from i18n, board-only "create" button
   (this whole page is board-only per the ticket's "Given I am board
   member" — gate the entire route content behind `useAuth().user.role ===
'board'`, not just the actions, since unlike academic-years this isn't a
   shared read view. Confirm the exact role-check helper/shape used
   elsewhere, e.g. `src/lib/auth.tsx`, before writing this).
3. `DataTable` columns:
   - `sortOrder` / order column — render as a numeric badge or plain text,
     **plus** the up/down arrow control (two icon `Button`s, `ChevronUp`/
     `ChevronDown` from lucide-react, disabled at the boundaries) calling
     the `moveUp`/`moveDown` mutations.
   - `name`.
   - `description`.
   - actions column — `DropdownMenu` with `onClick` handlers: Edit (opens
     dialog), Delete (opens confirm dialog). No "set active" item (no active
     concept for branches).
4. Global search input above table, `searchColumnKey="name"`.
5. Create/Edit dialog — TanStack Form + zod schema (`name` required, unique
   enforced server-side; `description` optional), shadcn `Field`/`Input`/
   `Textarea`. Confirm-before-leave-dialog per CLAUDE.md UI rules.
6. Delete confirm dialog — shadcn dialog, mirrors academic-years' delete
   flow, surfaces the server's "branch in use by classes" error if Phase 1
   added that guard.
7. Skeleton loading state while `branches === undefined`.
8. Toasts via `sonner` for success/error on every mutation, matching
   academic-years' toast copy style.

## Phase 3 — Sidebar + i18n

1. `src/components/app-sidebar.tsx`: import an unused lucide icon (e.g.
   `GitBranch` or `Network` — verify it's not already imported, pick
   something visually distinct from `CalendarRange`), add `{ title:
t('nav.branches'), url: '/branches', icon: <Chosen> }` to `navItems`
   right after the Academic Year entry.
2. `src/locales/en.json` and `src/locales/vi.json`: add `nav.branches` plus
   the full `branches.*` namespace (title, subtitle, col._, dialog._,
   fields._, actions._, delete.*) — mirror every key academic-years has,
   translated appropriately (vi.json needs real Vietnamese, not
   transliteration).

## Phase 4 — Tests (delegate to unit-test-writer agent)

Per CLAUDE.md: every component/function must have tests, minimum 85%
coverage (statements/branches/functions/lines), verified via `npm test --
--coverage`.

1. `convex/branches.test.ts` — copy `convex/academicYears.test.ts` structure:
   unauthorized-caller rejection for every mutation, list (empty + seeded),
   create (happy path + duplicate-name rejection), update (happy path +
   rename duplicate check), softDelete (happy path + already-deleted +
   in-use-by-class guard if implemented), moveUp/moveDown (happy path +
   boundary no-op/throw).
2. `src/routes/_authenticated/-branches.test.tsx` — copy
   `-academic-years.test.tsx` structure: mock `useQuery`/`useMutation`,
   render route's `.options.component`, assert: board-gated rendering,
   table renders rows, search filters, create dialog flow, edit dialog
   flow, delete confirm flow, up/down arrow calls correct mutation and is
   disabled at boundaries, error toast on mutation rejection.

**Verification:** `npm test -- --coverage` reports all four metrics ≥85%
for the new files; if not, add more cases before marking done.

## Phase 5 — Review (delegate to ts-react-reviewer agent)

Review the full diff (schema, `convex/branches.ts`, `convex/lib/errors.ts`,
route file, sidebar, locale files, tests) for:

- Type safety (no `any`, proper Convex `v.*` arg/return types).
- Correct `onClick` (not `onSelect`) on `DropdownMenuItem`.
- No `.filter()` inside Convex query builders.
- `assertBoardRole` present on every mutation.
- Duplicate-name checks correctly exclude soft-deleted rows.
- Consistent i18n key usage (no hardcoded strings in JSX).

## Final Verification Checklist

- [ ] `convex/schema.ts` has `by_name` and `by_sort_order` indexes on
      `branches`.
- [ ] All Convex mutations require `requesterId` and call
      `assertBoardRole`.
- [ ] `npm test -- --coverage` ≥85% on statements/branches/functions/lines
      for all new/changed files.
- [ ] `npx tsc --noEmit` (or project's typecheck script) passes.
- [ ] Manual run: board user sees "Branches" in sidebar, list loads 6 seeded
      branches in order, up/down arrows reorder correctly and persist on
      refresh, edit/delete dialogs work, non-board user cannot reach
      `/branches` (or sees it read-only, per whichever gating was actually
      implemented in Phase 2 step 2).
- [ ] `ts-react-reviewer` agent sign-off with no unresolved findings.
