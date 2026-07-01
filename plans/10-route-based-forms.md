# Plan 10: Route-Based Create/Edit Forms + Detail Views

**Goal**: Replace dialog-based create/edit forms in academic-years, branches, and classes with dedicated routes. Add blank detail views.

**Scope**: academic-years, branches, classes

---

## Phase 0: Discovery (Done)

### Allowed Patterns

**Form component stack** (copy from `src/routes/_authenticated/academic-years.tsx:420-559`):

- `useForm` from `@tanstack/react-form` — no top-level Zod schema; validators inline on `form.Field`
- `Field`, `FieldLabel`, `FieldError`, `FieldGroup` from `src/components/ui/field.tsx`
- `data-invalid={field.state.meta.errors.length > 0}` on `<Field>`
- `form.Subscribe` for submit button disabled state
- Track dirty state via `onDirtyChange(true)` inside `onChange` handlers

**Route file naming** (copy from `classes_.bulk-create.tsx`):

```
academic-years_.create.tsx       → /_authenticated/academic-years_/create
academic-years_.$id.tsx          → /_authenticated/academic-years_/$id
academic-years_.$id_.edit.tsx    → /_authenticated/academic-years_/$id_/edit
```

Each uses `createFileRoute('/_authenticated/...')` with `staticData: { crumb: 'i18n.key' }`.

**Navigation pattern** (copy from `classes_.bulk-create.tsx:150,173`):

```typescript
const navigate = useNavigate()
navigate({ to: '/academic-years' })
```

**Breadcrumb**: every route must have `staticData: { crumb: '<i18n-key>' }`.

### Known File Locations

- List pages: `src/routes/_authenticated/{academic-years,branches,classes}.tsx`
- Form components (to extract): embedded in each list page file
  - `AcademicYearForm` → `academic-years.tsx:324-577`
  - `BranchForm` → `branches.tsx:335-472`
  - `ClassForm` → `classes.tsx:308-492`
- i18n files: `src/locales/en.json`, `src/locales/vi.json`
- Field components: `src/components/ui/field.tsx`

### Anti-Patterns

- Do NOT use `<Dialog>` wrapper in extracted form components
- Do NOT invent Zod schema where current code uses inline validators
- Do NOT keep dialog state (`DialogState`) in list page for create/edit (remove it)
- Do NOT skip `staticData: { crumb }` on any new route

---

## Phase 1: Extract Shared Form Components

**Goal**: Extract form logic out of list pages into standalone components usable by both create and edit routes.

### 1.1 Create directory

```
src/components/forms/
```

### 1.2 Extract `AcademicYearForm`

**Source**: `src/routes/_authenticated/academic-years.tsx:324-577`

**Target**: `src/components/forms/academic-year-form.tsx`

**Component API**:

```typescript
interface AcademicYearFormProps {
  yearId?: Id<'academicYears'> // undefined = create mode
  initialValues?: {
    name: string
    startDate: string
    endDate: string
  }
  onSuccess: () => void
  onCancel: () => void
}
```

**What to include**: form state (`useForm`), field components, submit handler with mutations, dirty-state tracking, `AlertDialog` for unsaved-changes confirmation on cancel.

**What to exclude**: `Dialog`/`DialogContent` wrapper, dialog open/close props.

**Form sections** (split fields, each section has a description per CLAUDE.md rules):

- Section "Basic Info": name field
- Section "Date Range": startDate, endDate fields
- Section "Semesters" (create only): numberOfSemesters field

### 1.3 Extract `BranchForm`

**Source**: `src/routes/_authenticated/branches.tsx:335-472`

**Target**: `src/components/forms/branch-form.tsx`

**Component API**:

```typescript
interface BranchFormProps {
  branchId?: Id<'branches'>
  initialValues?: {
    name: string
    description?: string
  }
  onSuccess: () => void
  onCancel: () => void
}
```

**Form sections**:

- Section "Basic Info": name, description fields

### 1.4 Extract `ClassForm`

**Source**: `src/routes/_authenticated/classes.tsx:308-492`

**Target**: `src/components/forms/class-form.tsx`

**Component API**:

```typescript
interface ClassFormProps {
  classId?: Id<'classes'>
  initialValues?: {
    name: string
    branchId: Id<'branches'>
    description?: string
  }
  onSuccess: () => void
  onCancel: () => void
}
```

**Form sections**:

- Section "Basic Info": name, branch selector, description fields

### Verification

```bash
npx tsc --noEmit   # must pass
grep -r "AcademicYearForm\|BranchForm\|ClassForm" src/components/forms/  # finds 3 files
```

---

## Phase 2: Add i18n Keys

**Goal**: Add keys for create/edit page titles and form section headers/descriptions.

### 2.1 Keys to add in `src/locales/en.json`

```json
"academicYears.create.title": "Create Academic Year",
"academicYears.create.subtitle": "Add a new academic year to the system.",
"academicYears.edit.title": "Edit Academic Year",
"academicYears.edit.subtitle": "Update the details of this academic year.",
"academicYears.detail.title": "Academic Year Details",
"academicYears.form.basicInfo": "Basic Information",
"academicYears.form.basicInfo.description": "Enter the name for this academic year.",
"academicYears.form.dateRange": "Date Range",
"academicYears.form.dateRange.description": "Set the start and end dates for this academic year.",
"academicYears.form.semesters": "Semesters",
"academicYears.form.semesters.description": "Configure how many semesters this year will have.",

"branches.create.title": "Create Branch",
"branches.create.subtitle": "Add a new branch to the system.",
"branches.edit.title": "Edit Branch",
"branches.edit.subtitle": "Update the details of this branch.",
"branches.detail.title": "Branch Details",
"branches.form.basicInfo": "Basic Information",
"branches.form.basicInfo.description": "Enter the name and description for this branch.",

"classes.create.title": "Create Class",
"classes.create.subtitle": "Add a new class to the system.",
"classes.edit.title": "Edit Class",
"classes.edit.subtitle": "Update the details of this class.",
"classes.detail.title": "Class Details",
"classes.form.basicInfo": "Basic Information",
"classes.form.basicInfo.description": "Enter the class name, branch, and description."
```

### 2.2 Mirror all keys in `src/locales/vi.json`

Translate to Vietnamese equivalents.

### Verification

```bash
grep -c "academicYears.create.title\|branches.create.title\|classes.create.title" src/locales/en.json  # should be 3
grep -c "academicYears.create.title\|branches.create.title\|classes.create.title" src/locales/vi.json  # should be 3
```

---

## Phase 3: Academic Years — Create / Edit / Detail Routes

### 3.1 Create route: `src/routes/_authenticated/academic-years_.create.tsx`

```typescript
export const Route = createFileRoute('/_authenticated/academic-years_/create')({
  component: CreateAcademicYearPage,
  staticData: { crumb: 'academicYears.create.title' },
})
```

Page layout:

- Page header: title=`t('academicYears.create.title')`, description=`t('academicYears.create.subtitle')`
- Render `<AcademicYearForm onSuccess={() => navigate({ to: '/academic-years' })} onCancel={() => navigate({ to: '/academic-years' })} />`

### 3.2 Edit route: `src/routes/_authenticated/academic-years_.$id_.edit.tsx`

```typescript
export const Route = createFileRoute(
  '/_authenticated/academic-years_/$id_/edit',
)({
  component: EditAcademicYearPage,
  staticData: { crumb: 'academicYears.edit.title' },
})
```

Page layout:

- Read `const { id } = Route.useParams()`
- Fetch year data with existing query (`api.academicYears.get` or equivalent)
- Show skeleton while loading
- Page header: title=`t('academicYears.edit.title')`, description=`t('academicYears.edit.subtitle')`
- Render `<AcademicYearForm yearId={id} initialValues={...} onSuccess={...} onCancel={...} />`
- `onSuccess` → `navigate({ to: '/academic-years' })`
- `onCancel` → `navigate({ to: '/academic-years' })`

### 3.3 Detail route: `src/routes/_authenticated/academic-years_.$id.tsx`

```typescript
export const Route = createFileRoute('/_authenticated/academic-years_/$id')({
  component: AcademicYearDetailPage,
  staticData: { crumb: 'academicYears.detail.title' },
})
```

Page layout:

- Page header: title = fetched year name (fallback to `t('academicYears.detail.title')`)
- Body: `{/* TODO: Add detail content */}` — intentionally blank for now

### Verification

```bash
npx tsc --noEmit
grep "academic-years_" src/routes/_authenticated/academic-years_*.tsx  # finds 3 files
```

---

## Phase 4: Branches — Create / Edit / Detail Routes

Same structure as Phase 3, for branches.

### 4.1 Create route: `src/routes/_authenticated/branches_.create.tsx`

```typescript
export const Route = createFileRoute('/_authenticated/branches_/create')({
  component: CreateBranchPage,
  staticData: { crumb: 'branches.create.title' },
})
```

### 4.2 Edit route: `src/routes/_authenticated/branches_.$id_.edit.tsx`

```typescript
export const Route = createFileRoute('/_authenticated/branches_/$id_/edit')({
  component: EditBranchPage,
  staticData: { crumb: 'branches.edit.title' },
})
```

### 4.3 Detail route: `src/routes/_authenticated/branches_.$id.tsx`

```typescript
export const Route = createFileRoute('/_authenticated/branches_/$id')({
  component: BranchDetailPage,
  staticData: { crumb: 'branches.detail.title' },
})
```

All pages follow same layout pattern as Phase 3.

### Verification

```bash
npx tsc --noEmit
grep "branches_" src/routes/_authenticated/branches_*.tsx  # finds 3 files
```

---

## Phase 5: Classes — Create / Edit / Detail Routes

### 5.1 Create route: `src/routes/_authenticated/classes_.create.tsx`

```typescript
export const Route = createFileRoute('/_authenticated/classes_/create')({
  component: CreateClassPage,
  staticData: { crumb: 'classes.create.title' },
})
```

Note: `classes_.bulk-create.tsx` already exists — `classes_.create.tsx` is a sibling. Both are valid.

### 5.2 Edit route: `src/routes/_authenticated/classes_.$id_.edit.tsx`

```typescript
export const Route = createFileRoute('/_authenticated/classes_/$id_/edit')({
  component: EditClassPage,
  staticData: { crumb: 'classes.edit.title' },
})
```

### 5.3 Detail route: `src/routes/_authenticated/classes_.$id.tsx`

```typescript
export const Route = createFileRoute('/_authenticated/classes_/$id')({
  component: ClassDetailPage,
  staticData: { crumb: 'classes.detail.title' },
})
```

### Verification

```bash
npx tsc --noEmit
grep "classes_" src/routes/_authenticated/classes_*.tsx  # finds bulk-create + 3 new files
```

---

## Phase 6: Update List Pages to Remove Dialogs

### 6.1 `src/routes/_authenticated/academic-years.tsx`

**Remove**:

- `DialogState` type and related state (`dialogState`, `setDialogState`)
- Dialog open/close handlers (`handleCreate`, `handleEdit`, `handleDialogClose`)
- `AcademicYearForm` component definition (moved to Phase 1)
- `<Dialog>` / `<DialogContent>` wrapper JSX
- All dialog-related imports (`Dialog`, `DialogContent`, etc.)

**Add**:

- Import `useNavigate` from `@tanstack/react-router`
- "Create" button: `navigate({ to: '/academic-years/create' })`
- Row "Edit" action: `navigate({ to: '/academic-years/$id/edit', params: { id: row.original._id } })`
- Row name cell (or row click): `navigate({ to: '/academic-years/$id', params: { id: row.original._id } })`

### 6.2 `src/routes/_authenticated/branches.tsx`

Same removals/additions as 6.1 for branches:

- Remove `DialogState`, `BranchForm`, dialog JSX
- Add navigation to `/branches/create`, `/branches/$id/edit`, `/branches/$id`

### 6.3 `src/routes/_authenticated/classes.tsx`

Same removals/additions:

- Remove `DialogState`, `ClassForm`, dialog JSX for create/edit
- Keep bulk-create button (already navigates to `/classes/bulk-create`)
- Add navigation to `/classes/create`, `/classes/$id/edit`, `/classes/$id`

### Verification

```bash
npx tsc --noEmit
grep -n "DialogState\|<Dialog" src/routes/_authenticated/academic-years.tsx   # should return 0 matches
grep -n "DialogState\|<Dialog" src/routes/_authenticated/branches.tsx          # should return 0 matches
# Note: branches/classes may still have delete confirmation Dialogs — those stay
```

---

## Phase 7: Unit Tests

Delegate to `unit-test-writer` agent for each new form component and route.

**Test targets**:

1. `src/components/forms/academic-year-form.tsx` — create mode, edit mode, validation, dirty/cancel flow
2. `src/components/forms/branch-form.tsx` — create mode, edit mode, validation
3. `src/components/forms/class-form.tsx` — create mode, edit mode, branch selector
4. `src/routes/_authenticated/academic-years_.create.tsx` — renders form, navigates on success
5. `src/routes/_authenticated/academic-years_.$id_.edit.tsx` — loads data, renders form, navigates on success
6. `src/routes/_authenticated/academic-years_.$id.tsx` — renders page header

Same for branches and classes routes.

**Coverage requirement**: ≥85% statements, branches, functions, lines.

```bash
npm test -- --coverage
```

---

## Phase 8: Final Verification

```bash
# TypeScript
npx tsc --noEmit

# No dialog wrappers in list pages for create/edit
grep -n "AcademicYearForm\|BranchForm\|ClassForm" src/routes/_authenticated/academic-years.tsx
grep -n "AcademicYearForm\|BranchForm\|ClassForm" src/routes/_authenticated/branches.tsx
grep -n "AcademicYearForm\|BranchForm\|ClassForm" src/routes/_authenticated/classes.tsx

# New routes exist
ls src/routes/_authenticated/academic-years_*.tsx
ls src/routes/_authenticated/branches_*.tsx
ls src/routes/_authenticated/classes_*.tsx

# All new routes have staticData.crumb
grep -n "staticData" src/routes/_authenticated/academic-years_*.tsx
grep -n "staticData" src/routes/_authenticated/branches_*.tsx
grep -n "staticData" src/routes/_authenticated/classes_*.tsx

# i18n keys present
grep "create.title\|edit.title\|detail.title" src/locales/en.json | wc -l  # should be 9+
grep "create.title\|edit.title\|detail.title" src/locales/vi.json | wc -l  # should be 9+

# Tests pass
npm test -- --coverage
```

---

## Execution Order

| Phase | Description             | Depends On |
| ----- | ----------------------- | ---------- |
| 1     | Extract form components | —          |
| 2     | Add i18n keys           | —          |
| 3     | Academic years routes   | 1, 2       |
| 4     | Branches routes         | 1, 2       |
| 5     | Classes routes          | 1, 2       |
| 6     | Update list pages       | 3, 4, 5    |
| 7     | Unit tests              | 6          |
| 8     | Final verification      | 7          |

Phases 1 and 2 can run in parallel. Phases 3, 4, 5 can run in parallel. Phase 6 depends on all route phases.
