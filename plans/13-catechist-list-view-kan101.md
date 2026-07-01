# KAN-101: Catechist Profile List View

**Goal:** Build `/catechists` page — TanStack data-table with global search and branch assignment filter.

---

## Phase 0: Documentation Discovery

### Allowed APIs (verified)

**Backend — `convex/catechists.ts`:**

- `list({ requesterId })` — returns all non-deleted catechists via `.collect()` (no pagination, no filters)
- `get({ requesterId, catechistId })` — returns catechist + address + contacts
- Auth: `assertValidCatechist` for queries, `assertAdminRole` for admin mutations

**Schema fields (`catechists` table):**
`memberId`, `fullName`, `saintName`, `dateOfBirth`, `gender`, `role` (admin|user), `isActive`, `joinedDate`, `notes`, `isDeleted`

**`branchAssignments` table:**
Fields: `academicYearId`, `catechistId`, `branchId`, `isDeleted`
Indexes: `by_branch_id`, `by_academic_year_id_and_branch_id`, `by_academic_year_id_and_catechist_id_and_branch_id`
→ Can query catechist IDs for a given branch+academicYear.

**Frontend patterns (copy from):**

- List page: `src/routes/_authenticated/branches.tsx` — full template
- DataTable: `src/components/custom/data-table.tsx`
  - Props: `columns`, `data`, `searchColumnKey`, `searchPlaceholder`
  - Built-in: client-side search, sorting, column visibility, pagination
- Auth hook: `useAuth()` → `user?.userDocId as Id<'catechists'>`
- Permission check: `isAdmin(user)` from `~/lib/permissions`
- Convex hook: `useQuery(api.catechists.list, requesterId ? { requesterId } : 'skip')`
- i18n: `useTranslation()` → `t('catechists.title')`
- Breadcrumb: `staticData: { crumb: 'catechists.title' }` in `createFileRoute`
- Sidebar: `src/components/app-sidebar.tsx` — add nav item there

**Anti-patterns:**

- Do NOT use `ctx.db.filter()` — use `withIndex()` only
- Do NOT hard-delete records
- Do NOT invent Convex API methods not in `convex/_generated/ai/guidelines.md`

---

## Phase 1: Backend — Add Branch Filter to `list` Query

**What:** Update `catechists.list` to accept optional `branchId` + `academicYearId`.
When provided, query `branchAssignments` by `by_academic_year_id_and_branch_id` index, collect catechist IDs, then fetch those catechists.
When omitted, return all non-deleted catechists (existing behaviour).

**File to edit:** `convex/catechists.ts` (lines 71–81)

**New signature:**

```typescript
export const list = query({
  args: {
    requesterId: v.id('catechists'),
    branchId: v.optional(v.id('branches')),
    academicYearId: v.optional(v.id('academicYears')),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)

    if (args.branchId && args.academicYearId) {
      const assignments = await ctx.db
        .query('branchAssignments')
        .withIndex('by_academic_year_id_and_branch_id', (q) =>
          q
            .eq('academicYearId', args.academicYearId!)
            .eq('branchId', args.branchId!),
        )
        .collect()
      const activeAssignments = assignments.filter((a) => !a.isDeleted)
      const catechists = await Promise.all(
        activeAssignments.map((a) => ctx.db.get('catechists', a.catechistId)),
      )
      return catechists.filter(
        (c): c is NonNullable<typeof c> => c !== null && !c.isDeleted,
      )
    }

    return await ctx.db
      .query('catechists')
      .withIndex('by_is_deleted', (q) => q.eq('isDeleted', false))
      .collect()
  },
})
```

**Verification:**

- `npx tsc --noEmit` passes
- Existing tests for `list` still pass with no args change (branchId/academicYearId optional)

---

## Phase 2: i18n Keys

**What:** Add `catechists.*` translation keys to both locale files.

**Files:**

- `src/locales/en.json`
- `src/locales/vi.json`

**Keys to add (en.json):**

```json
{
  "catechists.title": "Catechists",
  "catechists.subtitle": "Manage catechist profiles",
  "catechists.col.memberId": "Member ID",
  "catechists.col.fullName": "Full Name",
  "catechists.col.saintName": "Saint Name",
  "catechists.col.gender": "Gender",
  "catechists.col.role": "App Role",
  "catechists.col.isActive": "Status",
  "catechists.col.joinedDate": "Joined",
  "catechists.searchPlaceholder": "Search by name or ID...",
  "catechists.filterByBranch": "Filter by branch",
  "catechists.filterByBranch.all": "All branches",
  "catechists.actions.create": "Add Catechist",
  "catechists.delete.title": "Delete Catechist?",
  "catechists.delete.description": "Are you sure you want to delete \"{name}\"? This action cannot be undone.",
  "catechists.delete.confirm": "Delete Catechist",
  "catechists.deleted": "Catechist deleted successfully",
  "catechists.deleteError": "Failed to delete catechist"
}
```

**vi.json:** mirror with Vietnamese translations.

**Copy pattern from:** `branches.*` keys in `src/locales/en.json` and `src/locales/vi.json`.

**Verification:** `grep -n '"catechists\.' src/locales/en.json` shows all keys present.

---

## Phase 3: Sidebar Navigation

**What:** Add catechists nav item to sidebar (admin-gated).

**File:** `src/components/app-sidebar.tsx`

**Pattern (copy from branches/academic-years nav items):**

- Import `Users` from `lucide-react`
- Add item with `title: t('catechists.title')`, `url: '/catechists'`, `icon: Users`
- Gate behind `isAdmin(user)` check (same as other admin nav items)

**Verification:** Nav item appears in sidebar when logged in as admin.

---

## Phase 4: Route File — List Page

**What:** Create `src/routes/_authenticated/catechists.tsx`.

**Copy base from:** `src/routes/_authenticated/branches.tsx` (entire file structure).

**Columns to render:**

| Column     | Key          | Notes                                      |
| ---------- | ------------ | ------------------------------------------ |
| Member ID  | `memberId`   | Plain text, link to detail                 |
| Full Name  | `fullName`   | Primary link column                        |
| Saint Name | `saintName`  | Optional, dash if absent                   |
| Gender     | `gender`     | Badge (male/female/other)                  |
| App Role   | `role`       | Badge (admin=destructive, user=secondary)  |
| Status     | `isActive`   | Badge (Active=success, Inactive=outline)   |
| Joined     | `joinedDate` | Formatted date                             |
| Actions    | —            | Edit + Delete in DropdownMenu (admin only) |

**Branch filter UI:**

- Fetch branches: `useQuery(api.branches.list, requesterId ? { requesterId } : 'skip')`
- Fetch current academic year: `useQuery(api.academicYears.getCurrent, ...)` (check if exists, else list all years and pick latest)
- Add `Select` shadcn component above DataTable for branch filter
- Selected branchId + academicYearId passed to `api.catechists.list`

**Route definition:**

```typescript
export const Route = createFileRoute('/_authenticated/catechists')({
  component: CatechistsPage,
  staticData: { crumb: 'catechists.title' },
})
```

**Search:** `searchColumnKey="fullName"` on DataTable — built-in client-side search.

**Group-by dropdown:** DataTable has built-in column visibility toggle. CLAUDE.md requires group-by dropdown when data can be grouped. Group candidates: `role` (admin/user), `isActive` (active/inactive). Add group-by select that uses TanStack table `grouping` state.

**Loading state:** Copy skeleton pattern from branches.tsx (5x `h-10 bg-muted animate-pulse`).

**Delete confirmation:** AlertDialog — same pattern as branches.tsx. Wire to `api.catechists.softDelete`.

**File structure:**

```
src/routes/_authenticated/catechists.tsx       ← list (Phase 4)
src/routes/_authenticated/catechists_.create.tsx   ← future
src/routes/_authenticated/catechists_.$id.tsx      ← future
src/routes/_authenticated/catechists_.$id_.edit.tsx ← future
```

**Verification:**

- `npx tsc --noEmit` passes
- Page renders with data, search filters rows, branch dropdown filters by branch assignment

---

## Phase 5: Tests

Delegate to `unit-test-writer` agent after Phases 1–4 are complete.

**Files to test:**

1. **`convex/catechists.test.ts`** — add tests for updated `list` query:
   - Returns all catechists when no branchId/academicYearId provided
   - Returns only branch-assigned catechists when branchId+academicYearId provided
   - Excludes soft-deleted assignments
   - Excludes soft-deleted catechists even if assignment exists

2. **`src/routes/_authenticated/catechists.test.tsx`** — component tests:
   - Renders page header, table, search input
   - Shows skeleton when data loading
   - Search filters rows by fullName
   - Branch dropdown calls list with branchId
   - Admin sees action menu; non-admin does not
   - Delete confirmation dialog opens and confirms

**Coverage target:** ≥85% statements, branches, functions, lines.

---

## Phase 6: Verification

```bash
# TypeScript
npx tsc --noEmit

# Tests + coverage
npm test -- --coverage

# Check anti-patterns
grep -rn "ctx.db.filter" convex/
grep -rn "hard.*delete\|\.delete(" convex/catechists.ts

# Spot-check i18n
grep -n '"catechists\.' src/locales/en.json | wc -l   # should be ~17+
grep -n '"catechists\.' src/locales/vi.json | wc -l
```

**Done when:**

- All 4 coverage metrics ≥85%
- Page loads, search works, branch filter scopes results
- Breadcrumb shows "Catechists"
- Sidebar link navigates to page
