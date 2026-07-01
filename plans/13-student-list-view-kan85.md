# KAN-85: Student List View Page

**Goal:** Build `/students` route — TanStack data-table with server-side pagination (Convex `usePaginatedQuery`), client-side search, group-by dropdown, row actions (view/edit/delete).

---

## Phase 0: Discovered APIs & Patterns

### Allowed APIs

| API                       | Location                                  | Notes                                                                    |
| ------------------------- | ----------------------------------------- | ------------------------------------------------------------------------ |
| `api.students.list`       | `convex/students.ts:8`                    | Args: `{ requesterId, paginationOpts: { numItems, cursor }, isActive? }` |
| `api.students.softDelete` | `convex/students.ts:101`                  | Args: `{ requesterId, studentId }` — throws if active enrollment         |
| `usePaginatedQuery`       | `convex/react`                            | Returns `{ results, status, loadMore, isLoading }`                       |
| `DataTable`               | `src/components/custom/data-table.tsx:43` | Props: `columns`, `data`, `searchColumnKey?`, `searchPlaceholder?`       |
| `Badge`                   | `src/components/ui/badge.tsx`             | Variants: `default`, `secondary`, `outline`                              |
| `DropdownMenu*`           | `src/components/ui/dropdown-menu.tsx`     | BaseUI-based — use `render={}` not `asChild`                             |
| `Select*`                 | `src/components/ui/select.tsx`            | For group-by dropdown                                                    |

### Copy-from references

| Pattern                  | File                                           | Lines                      |
| ------------------------ | ---------------------------------------------- | -------------------------- |
| Full list page structure | `src/routes/_authenticated/classes.tsx`        | 1–216                      |
| Badge for isActive       | `src/routes/_authenticated/academic-years.tsx` | 117–129                    |
| Row action DropdownMenu  | `src/routes/_authenticated/classes.tsx`        | 108–140                    |
| DataTable usage          | `src/routes/_authenticated/branches.tsx`       | 213–218                    |
| Breadcrumb staticData    | `src/routes/_authenticated/branches.tsx`       | 40–42                      |
| Nav item push            | `src/components/app-sidebar.tsx`               | 149–164                    |
| i18n key pattern         | `src/locales/en.json`                          | 149–181 (branches section) |
| Delete dialog            | `src/routes/_authenticated/classes.tsx`        | 142–177                    |

### Student schema fields (from `convex/schema.ts:238`)

- `studentCode: string` — unique login ID
- `fullName: string`
- `saintName?: string` — Tên Thánh
- `dateOfBirth?: string` — ISO YYYY-MM-DD
- `gender?: 'male' | 'female' | 'other'`
- `previousParish?: string`
- `previousDiocese?: string`
- `isActive: boolean`
- `createdAt: number`

### Pagination strategy

`usePaginatedQuery` is cursor-based ("load more"), not page-based. Use it as follows:

- `usePaginatedQuery(api.students.list, args | 'skip', { initialNumItems: 50 })`
- Pass `results` directly as `data` to `DataTable`
- Show "Load More" button below table when `status !== 'Exhausted'`
- Client-side search via DataTable's `searchColumnKey="fullName"`

### Anti-patterns

- DO NOT use `useQuery` with `collect()` — students uses paginated backend
- DO NOT import from Radix directly — use components in `src/components/ui/`
- DO NOT use `asChild` on DropdownMenuTrigger — use `render={<Button .../>}`
- DO NOT filter with `.filter()` in Convex queries — use indexes

---

## Phase 1: i18n Translation Keys

**Files to edit:**

- `src/locales/en.json`
- `src/locales/vi.json`

**Keys to add** (insert after `branches.*` block, before `classes.*`):

```json
"nav.students": "Students",

"students.title": "Students",
"students.subtitle": "Manage student records",

"students.col.studentCode": "Code",
"students.col.fullName": "Full Name",
"students.col.saintName": "Saint Name",
"students.col.gender": "Gender",
"students.col.status": "Status",

"students.gender.male": "Male",
"students.gender.female": "Female",
"students.gender.other": "Other",

"students.status.active": "Active",
"students.status.inactive": "Inactive",

"students.searchPlaceholder": "Search by name...",

"students.groupBy.none": "No grouping",
"students.groupBy.gender": "Group by Gender",
"students.groupBy.status": "Group by Status",

"students.delete.title": "Delete Student?",
"students.delete.description": "Are you sure you want to delete \"{name}\"? This action cannot be undone.",
"students.delete.confirm": "Delete Student",
"students.deleted": "Student deleted",
"students.deleteError": "Failed to delete student",
"students.deleteActiveEnrollmentError": "Cannot delete student with active class enrollment",

"students.loadMore": "Load more"
```

**Vietnamese equivalents** (`vi.json`) — translate matching keys.

**Verification:**

- `grep -r "students.title" src/locales/` returns hits in both files
- No TypeScript errors from i18n usage

---

## Phase 2: Add Students Nav Link

**File:** `src/components/app-sidebar.tsx`

**Task:** Inside the `if (isAdmin(user))` block (after line 149), add students nav item. Students are admin-managed.

```ts
navItems.push({
  title: t('nav.students'),
  url: '/students',
  icon: Users, // from lucide-react — already imported or add import
})
```

Place it as the first item in the `isAdmin` block (before classes), since students are a primary entity.

**Verification:**

- Sidebar shows "Students" link when logged in as admin
- `grep 'nav.students' src/components/app-sidebar.tsx` returns hit

---

## Phase 3: Student List Route

**File to create:** `src/routes/_authenticated/students.tsx`

**Copy base structure from** `src/routes/_authenticated/classes.tsx` (lines 1–216), then adapt.

### 3a. Route setup

```ts
export const Route = createFileRoute('/_authenticated/students')({
  staticData: { crumb: 'students.title' },
  component: StudentsPage,
})
```

### 3b. Data fetching

Use `usePaginatedQuery` (NOT `useQuery`):

```ts
const paginatedStudents = usePaginatedQuery(
  api.students.list,
  requesterId ? { requesterId } : 'skip',
  { initialNumItems: 50 },
)
// paginatedStudents.results = Student[]
// paginatedStudents.status = 'LoadingFirstPage' | 'LoadingMore' | 'CanLoadMore' | 'Exhausted'
// paginatedStudents.loadMore(n) = load next n items
```

### 3c. Column definitions

```ts
const columns: Array<ColumnDef<Student>> = [
  {
    accessorKey: 'studentCode',
    header: t('students.col.studentCode'),
  },
  {
    accessorKey: 'fullName',
    header: t('students.col.fullName'),
  },
  {
    accessorKey: 'saintName',
    header: t('students.col.saintName'),
    cell: ({ row }) => row.original.saintName ?? '—',
  },
  {
    accessorKey: 'gender',
    header: t('students.col.gender'),
    cell: ({ row }) => {
      const g = row.original.gender
      if (!g) return '—'
      return <Badge variant="outline">{t(`students.gender.${g}`)}</Badge>
    },
  },
  {
    accessorKey: 'isActive',
    header: t('students.col.status'),
    cell: ({ row }) => {
      const active = row.original.isActive
      return (
        <Badge variant={active ? 'default' : 'secondary'}>
          {active ? t('students.status.active') : t('students.status.inactive')}
        </Badge>
      )
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => <StudentActionsCell student={row.original} />,
  },
]
```

### 3d. Row actions

Copy DropdownMenu pattern from `classes.tsx:108–140`. Actions:

- **View** → `navigate({ to: '/students/$id', params: { id: student._id } })`
- **Edit** → `navigate({ to: '/students/$id/edit', params: { id: student._id } })`
- **Delete** → set `deleteTarget` state → show confirmation dialog

### 3e. Delete confirmation dialog

Copy dialog pattern from `classes.tsx:142–177`. On confirm:

```ts
await softDelete({ requesterId, studentId: deleteTarget._id })
toast.success(t('students.deleted'))
```

Catch error — check message for enrollment constraint → show `students.deleteActiveEnrollmentError`.

### 3f. Group-by dropdown (new pattern)

Add local state: `const [groupBy, setGroupBy] = useState<'none' | 'gender' | 'isActive'>('none')`

Above the DataTable, alongside search:

```tsx
<Select value={groupBy} onValueChange={setGroupBy} items={groupByOptions}>
  <SelectTrigger className="w-44">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    {groupByOptions.map((o) => (
      <SelectItem key={o.value} value={o.value}>
        {o.label}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

Where `groupByOptions`:

```ts
const groupByOptions = [
  { value: 'none', label: t('students.groupBy.none') },
  { value: 'gender', label: t('students.groupBy.gender') },
  { value: 'isActive', label: t('students.groupBy.status') },
]
```

Group rows client-side by computing a `groupKey` per row and inserting group header rows before rendering. **Simplest approach**: sort `paginatedStudents.results` by `groupBy` field before passing to DataTable. Use TanStack Table's built-in grouping via `grouping` state + `enableGrouping: true` on relevant columns — see TanStack Table docs for `getGroupedRowModel`.

### 3g. Load More button

Below the DataTable:

```tsx
{
  paginatedStudents.status === 'CanLoadMore' && (
    <Button
      variant="outline"
      onClick={() => paginatedStudents.loadMore(50)}
      disabled={paginatedStudents.status === 'LoadingMore'}
    >
      {t('students.loadMore')}
    </Button>
  )
}
```

### 3h. Page header

```tsx
<div>
  <h1 className="text-2xl font-bold">{t('students.title')}</h1>
  <p className="text-muted-foreground">{t('students.subtitle')}</p>
</div>
```

**Verification checklist:**

- Route renders at `/students`
- Breadcrumb shows "Students"
- Table loads with student rows
- Load More button appears and loads next 50
- Search filters by `fullName`
- Group-by dropdown groups rows visually
- Badge renders for gender and isActive
- Actions dropdown: view/edit navigate correctly
- Delete dialog appears → confirms → row disappears → toast shown
- Soft-delete with active enrollment shows specific error toast

---

## Phase 4: Unit Tests

**Delegate to `unit-test-writer` agent.**

Brief the agent:

- File under test: `src/routes/_authenticated/students.tsx`
- Copy test setup pattern from `src/routes/_authenticated/-classes.test.tsx`
- Must cover: renders with data, renders empty state, search filters, delete flow (success + active-enrollment error), Load More button visibility, Badge variants for gender/isActive
- Run `npm test -- --coverage` and verify all 4 metrics ≥ 85%

---

## Phase 5: Code Review

**Delegate to `ts-react-reviewer` agent.**

Brief the agent:

- Review `src/routes/_authenticated/students.tsx`
- Check: TypeScript strictness, correct `usePaginatedQuery` usage, no Radix direct imports, `render={}` pattern on DropdownMenuTrigger, no `asChild`, i18n keys used consistently, loading states handled

---

## Execution Order

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 (agent) → Phase 5 (agent)
```

Phases 1 and 2 are independent and can run in parallel.
Phase 3 depends on Phase 1 (i18n keys must exist).
Phases 4 and 5 depend on Phase 3.
