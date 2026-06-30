# KAN-53: Create List View to Manage Classes

## Summary

Board members can view, create, edit, and soft-delete Classes (year-agnostic
templates). Follows exact same pattern as `branches.tsx`/`convex/branches.ts`.

---

## Phase 0: Docs Discovery (DONE)

**Sources consulted:**

- `convex/schema.ts:58-65` — `classes` table: `branchId`, `name`,
  `description`, `isDeleted`; indexes: `by_is_deleted`, `by_branch_id`
- `convex/branches.ts` — full CRUD pattern (list, create, update, softDelete)
  with `assertBoardRole`, duplicate name check, referential integrity
- `convex/branches.test.ts` — test pattern (convexTest, seed board user, run
  queries/mutations)
- `src/routes/_authenticated/branches.tsx` — full UI pattern (DataTable, Dialog,
  AlertDialog, form, i18n)
- `src/components/app-sidebar.tsx:152-158` — sidebar nav item registration
- `src/locales/en.json:137-162` — i18n pattern for branches
- `src/locales/vi.json:137-162` — Vietnamese translations
- `convex/lib/errors.ts:10-14` — error codes pattern
- `convex/lib/authz.ts` — `assertBoardRole` helper

**Allowed APIs:**

- `convex/values`: `v.id()`, `v.string()`, `v.optional(v.string())`, `v.boolean()`
- `convex/server`: `query`, `mutation`
- `_generated/server`: `query`, `mutation`, `MutationCtx`, `QueryCtx`
- `ctx.db.query(...).withIndex(...).collect()`, `ctx.db.get(...)`,
  `ctx.db.insert(...)`, `ctx.db.patch(...)`
- TanStack: `useQuery`, `useMutation` from `convex/react`; `useForm` from
  `@tanstack/react-form`; `ColumnDef` from `@tanstack/react-table`
- UI: shadcn Dialog, AlertDialog, DropdownMenu, Button, Input, Label, Textarea,
  Badge (already installed)
- `DataTable` from `~/components/custom/data-table`
- `PageHeader` from `~/components/page-header`
- `toast` from `sonner`

**Anti-patterns to avoid:**

- No hard-delete — always soft-delete via `isDeleted: true`
- No `by_name` index on `classes` — use `by_branch_id` + filter for duplicate
  check
- No `sortOrder` on classes (unlike branches) — no reorder mutation needed
- No reorder column in the UI
- Duplicate name check must scope within the same `branchId`

---

## Phase 1: Convex Backend — `convex/classes.ts`

### 1.1. Create `convex/classes.ts`

Copy `convex/branches.ts` pattern, adapt for classes schema:

**Query — `list`:**

```ts
export const list = query({
  args: {},
  handler: async (ctx) => {
    const classes = await ctx.db
      .query('classes')
      .withIndex('by_is_deleted')
      .collect()
    return classes.filter((c) => !c.isDeleted)
  },
})
```

**Mutation — `create`** (board only):

- Trim name
- Check duplicate name **within same branchId**: query `classes` by
  `by_branch_id`, filter active, check name
- Insert: `{ branchId, name, description?, isDeleted: false }`

**Mutation — `update`** (board only):

- Fetch existing; throw NOT_FOUND if missing/deleted
- If name changed, check duplicate name within same branchId
- Patch: `{ name?, description? }`

**Mutation — `softDelete`** (board only):

- Fetch existing; throw NOT_FOUND if missing/deleted
- Check referential integrity: query `classYears` by
  `by_class_id`, filter `!isDeleted`; throw IN_USE_BY_CLASS_YEAR if any found
- Patch: `{ isDeleted: true }`

### 1.2. Edit `convex/lib/errors.ts`

Add after `BRANCH_ERRORS`:

```ts
export const CLASS_ERRORS = {
  DUPLICATE_NAME: 'CLASS_DUPLICATE_NAME',
  NOT_FOUND: 'CLASS_NOT_FOUND',
  IN_USE_BY_CLASS_YEAR: 'CLASS_IN_USE_BY_CLASS_YEAR',
} as const
```

### 1.3. Create `convex/classes.test.ts`

Copy `convex/branches.test.ts` pattern:

- ConvexTest setup
- Seed board user + a branch
- Test list (empty → seed → returns classes)
- Test create (success, duplicate name, unauthorized non-board)
- Test update (success, duplicate name, not found)
- Test softDelete (success, in-use-by-classYear, not found)

**Verification:** `npx vitest run convex/classes.test.ts` passes.

---

## Phase 2: i18n — Add Class Translation Keys

### Edit `src/locales/en.json`

Add after `branches.*` block (before final `}`):

```json
"classes.title": "Classes",
"classes.subtitle": "Manage class templates across branches (e.g., Ấu Nhi 1, Thiếu Nhi 2)",
"classes.searchPlaceholder": "Search classes...",
"classes.col.name": "Name",
"classes.col.branch": "Branch",
"classes.col.description": "Description",
"classes.dialog.create": "Create Class",
"classes.dialog.edit": "Edit Class",
"classes.fields.name": "Class Name",
"classes.fields.name.placeholder": "e.g. Ấu Nhi 1",
"classes.fields.name.duplicate": "A class with this name already exists in this branch",
"classes.fields.branch": "Branch",
"classes.fields.branch.placeholder": "Select a branch",
"classes.fields.branch.required": "Please select a branch",
"classes.fields.description": "Description",
"classes.fields.description.placeholder": "Optional description...",
"classes.actions.create": "Create",
"classes.delete.title": "Delete Class?",
"classes.delete.description": "Are you sure you want to delete \"{name}\"? This action cannot be undone.",
"classes.delete.confirm": "Delete Class",
"classes.deleted": "Class deleted successfully",
"classes.deleteError": "Failed to delete class",
"classes.saveError": "Failed to save class",
"classes.confirmLeave.title": "Discard unsaved changes?",
"classes.confirmLeave.description": "You have unsaved changes that will be lost.",
"classes.confirmLeave.discard": "Discard"
```

### Edit `src/locales/vi.json`

Vietnamese equivalents (same keys, translated values).

**Verification:** `grep '^  "classes\\.' src/locales/en.json` shows all keys.

---

## Phase 3: Route UI — `src/routes/_authenticated/classes.tsx`

### 3.1. Create `src/routes/_authenticated/classes.tsx`

Copy `src/routes/_authenticated/branches.tsx`, adapt:

**Route definition:**

```ts
export const Route = createFileRoute('/_authenticated/classes')({
  component: ClassesPage,
  staticData: { crumb: 'classes.title' },
})
```

**Type:**

```ts
type Class = Doc<'classes'>
```

**DialogState:**

```ts
type DialogState =
  { mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; class: Class }
```

**Page component:**

- Auth check: `user?.role === 'board'`
- Fetches: `api.classes.list`, `api.classes.create`, `api.classes.update`,
  `api.classes.softDelete`, `api.branches.list` (for branch dropdown)
- State: `dialogState`, `deleteTarget`, `formDirty`, `confirmLeaveOpen`
- Same skeleton loading, close dialog, request close dialog, handle delete
  patterns

**Columns** (no reorder):

```ts
const columns: Array<ColumnDef<Class>> = [
  {
    accessorKey: 'name',
    header: t('classes.col.name'),
  },
  {
    accessorKey: 'branchId',
    header: t('classes.col.branch'),
    cell: ({ row }) => {
      // resolve branch name from branches list
      const branch = branches?.find(
        (b) => b._id === row.original.branchId,
      )
      return <span>{branch?.name ?? '—'}</span>
    },
  },
  {
    accessorKey: 'description',
    header: t('classes.col.description'),
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      // DropdownMenu with Edit + Delete (same as branches)
    },
  },
]
```

**ClassForm component:**

- Fields: `name` (required), `branchId` (Select from branches list, required),
  `description` (optional Textarea)
- Branch select uses shadcn `<Select>` component
- `onSubmit`: create/update with branch validation
- Error handling: `CLASS_ERRORS.DUPLICATE_NAME`, generic save error
- Delete error handling: `CLASS_ERRORS.IN_USE_BY_CLASS_YEAR`

### 3.2. Edit `src/components/app-sidebar.tsx`

Add Classes nav item, board-only (between academic years and branches):

```ts
navItems.push({
  title: t('nav.classes'),
  url: '/classes',
  icon: GraduationCap, // import from lucide-react
})
```

Also add `import { GraduationCap } from 'lucide-react'` and
`"nav.classes": "Classes"` to i18n files.

**Verification:** `npm run typecheck` and `npm run lint` pass.

---

## Phase 4: Tests

### 4.1. Backend tests (Phase 1.3)

`convex/classes.test.ts` — created in Phase 1.

### 4.2. UI tests

Create `src/routes/_authenticated/-classes.test.tsx` following
`-branches.test.tsx` pattern.

**Verification:** `npm test -- --coverage` reports ≥85% across all metrics.

---

## Phase 5: Final Verification

1. `npm run typecheck` — no TS errors
2. `npm run lint` — no lint errors
3. `npm test -- --coverage` — ≥85% coverage
4. Check `convex/_generated/api.d.ts` — classes api functions auto-registered
