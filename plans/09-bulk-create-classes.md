# Plan 09: Bulk Create Classes (KAN-54)

## Overview

Add a dedicated page with a smart form that lets board members bulk-create classes
grouped by branch. Each branch section has dynamic input rows with "add row" buttons.

---

## Phase 0 — Documentation Discovery (Complete)

### Sources consulted

| File                                    | What it provides                                                       |
| --------------------------------------- | ---------------------------------------------------------------------- |
| `docs/schema/01-core-organization.md`   | `classes` table fields: `branchId`, `name`, `description`, `isDeleted` |
| `convex/schema.ts`                      | Exact Convex schema for `classes` and `branches`                       |
| `convex/classes.ts`                     | Existing `create`, `update`, `softDelete` mutations + `list` query     |
| `convex/branches.ts`                    | `list` query returns branches ordered by `sortOrder`                   |
| `convex/lib/errors.ts`                  | `CLASS_ERRORS.DUPLICATE_NAME`                                          |
| `convex/lib/authz.ts`                   | `assertBoardRole` helper                                               |
| `src/routes/_authenticated/classes.tsx` | Full pattern: PageHeader, DataTable, tanstack-form, dialog, i18n       |
| `src/locales/vi.json`                   | All existing i18n keys for `classes.*`                                 |
| `_authenticated.tsx`                    | Breadcrumb pattern via `staticData.crumb` + `useMatches()`             |

### Allowed APIs

- `api.classes.list` — no-arg query, returns `Doc<'classes'>[]`
- `api.classes.create` — single-create mutation (can be reused in a loop or new `bulkCreate` mutation)
- `api.branches.list` — returns all non-deleted branches ordered by `sortOrder`
- `assertBoardRole(ctx, requesterId)` — authorization for board-only actions
- TanStack Form `useForm` + `<form.Field>` + shadcn `<Input>`, `<Button>`, `<Label>` — form building
- `PageHeader` — page title/subtitle/actions
- `DataTable` — list views (not needed for bulk create but for classes list page modifications)

### Anti-patterns to avoid

- Do NOT invent Convex API parameters not in existing signatures
- Do NOT store computed values (not relevant here)
- Do NOT use raw `<form>` without TanStack Form when the pattern already uses it
- Do NOT skip soft-delete checks; all class mutations check `isDeleted`

---

## Phase 1 — Convex: `bulkCreate` mutation

**File:** `convex/classes.ts` (add new mutation, do not modify existing ones)

### What to implement

Add a `bulkCreate` mutation that accepts:

```typescript
args: {
  requesterId: v.id('catechists'),
  classes: v.array(v.object({
    branchId: v.id('branches'),
    name: v.string(),
  })),
}
```

### Logic

1. `assertBoardRole(ctx, requesterId)`
2. Validate each entry:
   - Trim `name`; reject empty names
   - Check duplicate name within the same branch (against existing active classes + within the batch itself)
3. Use `ctx.db.insert('classes', {...})` for each validated entry in a loop (stays within transaction limits for reasonable batch sizes)
4. Return `Id<'classes'>[]`

### Verification

- `npx convex typecheck` passes
- Existing tests in `convex/classes.test.ts` still pass

### Anti-pattern guards

- Use existing `CLASS_ERRORS.DUPLICATE_NAME` for duplicate errors
- Follow same `assertBoardRole` pattern as `create`

---

## Phase 2 — Route: Bulk Create Page

**New file:** `src/routes/_authenticated/classes/bulk-create.tsx`

### What to implement

A new route at `/_authenticated/classes/bulk-create` that renders a smart form.

### Patterns to copy

- Route definition with `createFileRoute`, `staticData: { crumb: 'classes.bulkCreate.title' }` — copy from `src/routes/_authenticated/classes.tsx:49-52`
- Board-only guard at top of component — copy from `classes.tsx:78-84`
- `PageHeader` with icon, title, subtitle — copy from `classes.tsx:170-183`
- TanStack Form with `useForm` — copy pattern from `classes.tsx:329-365`
- Confirm-leave dialog when form is dirty — copy from `classes.tsx:91-97, 238-264`

### Form design

- **Data source:** `useQuery(api.branches.list)` to get all branches
- **Layout:** For each branch (in `sortOrder`), render a section:
  - Branch name as a section header
  - List of input rows (each row = one class name field)
  - "Add row" button at the bottom of each branch section
  - Each row has a delete button (X icon) to remove that row
- **Default state:** Each branch starts with 1 empty input field
- **State:** A `Record<Id<'branches'>, string[]>` mapping branch ID to array of class names being entered
- **Validation:**
  - No empty class names allowed on submit
  - No duplicate names within the same branch in the submission
- **Submit:** Call `api.classes.bulkCreate` with all entries
- **Success:** Toast + navigate back to `/_authenticated/classes`
- **Error:** Show toast with error details (first error encountered)

### Verification

- `npm run typecheck` passes
- Navigate to `/classes/bulk-create` and see branch sections
- Can add/remove rows per branch
- Empty name validation prevents submission
- Successful submit creates classes and redirects

### Anti-pattern guards

- Do NOT use dialog for this — it's a full-page form per the ticket
- Do NOT pre-fill class names — ticket says "empty text field"
- Do NOT use DataTable for the form — use plain card layout

---

## Phase 3 — Classes List: Add navigation button

**File:** `src/routes/_authenticated/classes.tsx`

### What to implement

Add a "Bulk Create" button (with `Layers` or `ListPlus` icon) in `PageHeader` actions,
next to the existing "Create" button. It links to `/classes/bulk-create`.

### Change

```tsx
actions={
  <>
    <Button
      onClick={() => navigate({ to: '/classes/bulk-create' })}
      variant="outline"
      className="flex gap-2"
    >
      <ListPlus className="size-4" />
      {t('classes.actions.bulkCreate')}
    </Button>
    <Button
      onClick={() => setDialogState({ mode: 'create' })}
      className="flex gap-2"
    >
      <Plus className="size-4" />
      {t('classes.actions.create')}
    </Button>
  </>
}
```

### Verification

- Button visible on `/_authenticated/classes` for board users
- Click → navigates to `/classes/bulk-create`

---

## Phase 4 — i18n keys

### Files

- `src/locales/vi.json`
- `src/locales/en.json`

### Keys to add

```json
"classes.bulkCreate.title": "...",
"classes.bulkCreate.subtitle": "...",
"classes.actions.bulkCreate": "...",
"classes.bulkCreate.addRow": "...",
"classes.bulkCreate.removeRow": "...",
"classes.bulkCreate.submit": "...",
"classes.bulkCreate.success": "...",
"classes.bulkCreate.emptyName": "...",
"classes.bulkCreate.duplicateName": "...",
"classes.bulkCreate.noEntries": "...",
```

Vietnamese translations:

```json
"classes.bulkCreate.title": "Tạo Hàng Loạt",
"classes.bulkCreate.subtitle": "Thêm nhiều lớp cùng lúc cho từng ngành",
"classes.actions.bulkCreate": "Tạo hàng loạt",
"classes.bulkCreate.addRow": "Thêm lớp",
"classes.bulkCreate.removeRow": "Xóa",
"classes.bulkCreate.submit": "Tạo tất cả",
"classes.bulkCreate.success": "Đã tạo {count} lớp thành công",
"classes.bulkCreate.emptyName": "Vui lòng nhập tên lớp",
"classes.bulkCreate.duplicateName": "Tên lớp bị trùng trong cùng ngành",
"classes.bulkCreate.noEntries": "Chưa có lớp nào để tạo",
```

---

## Phase 5 — Tests

### Convex mutation tests

**File:** `convex/classes.test.ts`

Add tests for `bulkCreate`:

- Board member can bulk create classes across multiple branches
- Non-board member is rejected
- Duplicate name in the same branch in the batch is rejected
- Empty name is rejected
- Existing duplicate name in DB is rejected

### Component tests

**New file:** `src/routes/_authenticated/-classes-bulk-create.test.tsx`

Follow pattern from `-classes.test.tsx`:

- Renders all branch sections
- Can add and remove rows per branch
- Empty name validation error shown on submit
- Successful submit redirects to classes list
- Confirm-leave dialog when form is dirty
- Unauthorized for non-board users

### Coverage target

`npm test -- --coverage` must show ≥85% on all 4 metrics for the new code.

---

## Execution Order

1. Phase 1 — `bulkCreate` mutation + tests
2. Phase 4 — i18n keys
3. Phase 2 — Bulk create route
4. Phase 3 — Navigation button in classes list
5. Phase 5 — Full test coverage
6. Final — `npm run typecheck` + `npm test -- --coverage`
