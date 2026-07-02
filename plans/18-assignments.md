# 18: Assignments View & Edit Pages

Create view and edit pages for managing three types of assignments per academic year: Program Leadership (Board Members), Branch Leaders, and Class Catechists (teaching assignments).

## User Requirements

- **Routing**:
  - View page: `/assignments`
  - Edit page: `/assignments/edit`
  - Scoped to the currently selected academic year via `useSelectedAcademicYear()`.
- **Access Control**:
  - Viewing is open to all authenticated catechists.
  - Editing is authorized only for System Admins (`role === 'admin'`) and Board Members of the selected academic year.
  - If a non-authorized user tries to navigate to `/assignments/edit`, they are redirected to `/assignments`.
  - Past (inactive) academic years are read-only. When an inactive year is selected:
    - Hide the "Edit" button on the `/assignments` page.
    - Redirect any direct access to `/assignments/edit` back to `/assignments` with a warning toast.
- **UI Tabs**:
  - Implement a tabs component wrapping `@base-ui/react/tabs` (under `src/components/ui/tabs.tsx`).
  - Render 3 tabs: "Board assignment", "Branch assignment", "Class assignment".
- **Edit Flow & Actions**:
  - Each tab in the Edit page will have its own individual **Save** button to commit changes incrementally.
  - **Board assignment tab**: Multi-select Combobox Chips of all active catechists.
  - **Branch assignment tab**: List the 6 branches (Chiên Con, Ấu Nhi, etc.), each with a multi-select Combobox Chips of active catechists.
  - **Class assignment tab**: List the classes in the current academic year. For each class, show:
    - Homeroom: Single-select `Select` dropdown of active catechists.
    - Co-teachers: Multi-select Combobox Chips of active catechists.
    - Constraint: Automatically exclude the chosen Homeroom teacher from the Co-teachers options for that class to avoid duplicate assignments.

---

## Phase 0: Documentation Discovery

### Database Schema (convex/schema.ts)

- **`academicYearAssignments`**:
  - `academicYearId: Id<'academicYears'>`
  - `catechistId: Id<'catechists'>`
  - `assignmentType: 'board_member'`
  - `isDeleted: boolean`
- **`branchAssignments`**:
  - `academicYearId: Id<'academicYears'>`
  - `catechistId: Id<'catechists'>`
  - `branchId: Id<'branches'>`
  - `isDeleted: boolean`
- **`classCatechists`**:
  - `catechistId: Id<'catechists'>`
  - `classYearId: Id<'classYears'>`
  - `academicYearId: Id<'academicYears'>`
  - `role: 'homeroom' | 'co_teacher'`
  - `isDeleted: boolean`

### Copy-From References

- **Combobox Chips Multi-Select**: [combobox.tsx](file:///Users/thanhnguyen/Projects/Personal/e-catholic-catechism-school/src/components/ui/combobox.tsx#L215-L274) provides the necessary elements: `<ComboboxChips>`, `<ComboboxChip>`, `<ComboboxChipsInput>`.
- **Form Discard Warn Dialog**: [class-form.tsx:263-289](file:///Users/thanhnguyen/Projects/Personal/e-catholic-catechism-school/src/components/forms/class-form.tsx#L263-L289) provides an example `AlertDialog` for discarding unsaved edits.
- **Tabs component structure**: Base UI Tabs uses `@base-ui/react/tabs` with `Tabs.Root`, `Tabs.List`, `Tabs.Tab`, and `Tabs.Panel`.

### Anti-Patterns to Avoid

- ❌ **Do NOT use database deletes**: All assignments must use soft-deletes (`isDeleted: true`).
- ❌ **Do NOT edit inactive year data**: Check if the academic year is active before allowing mutations to write.

---

## Phase 1: Convex Backend & Localization

### Convex endpoints (`convex/assignments.ts`)

Create a new Convex API file to query and modify assignments:

- **Query**: `listYearAssignments`
  - Args: `{ requesterId: Id<'catechists'>, academicYearId: Id<'academicYears'> }`
  - Returns: Resolved board members, branch heads, and class teaching assignments, as well as the list of active catechists, classes, and branches for the selected year.
- **Mutation**: `updateBoardAssignments`
  - Args: `{ requesterId: Id<'catechists'>, academicYearId: Id<'academicYears'>, catechistIds: Array<Id<'catechists'>> }`
  - Replaces all board assignments for the year.
- **Mutation**: `updateBranchAssignments`
  - Args: `{ requesterId: Id<'catechists'>, academicYearId: Id<'academicYears'>, branchId: Id<'branches'>, catechistIds: Array<Id<'catechists'>> }`
  - Replaces branch heads for the specified branch and academic year.
- **Mutation**: `updateClassAssignments`
  - Args: `{ requesterId: Id<'catechists'>, academicYearId: Id<'academicYears'>, classYearId: Id<'classYears'>, homeroomCatechistId: Id<'catechists'> | null, coTeacherCatechistIds: Array<Id<'catechists'>> }`
  - Replaces teaching roles for the class year.

### Localization (`src/locales/vi.json` & `src/locales/en.json`)

Add translations for:

- Nav menu: `"nav.assignments": "Phân công" / "Assignments"`
- Tab names: `"assignments.tabs.board"`, `"assignments.tabs.branch"`, `"assignments.tabs.class"`
- Breadcrumbs: `"assignments.title"`, `"assignments.edit.title"`
- Success messages: `"assignments.saved.board"`, `"assignments.saved.branch"`, `"assignments.saved.class"`

---

## Phase 2: Frontend Base UI Tabs Component

Create the Tabs component in `src/components/ui/tabs.tsx` wrapping `@base-ui/react/tabs`:

```tsx
import { Tabs as TabsPrimitive } from '@base-ui/react/tabs'
// Wrap TabsPrimitive.Root, TabsPrimitive.List, TabsPrimitive.Tab, TabsPrimitive.Panel
```

---

## Phase 3: Frontend View Page (`src/routes/_authenticated/assignments.tsx`)

- Implement `/assignments` route with crumbs: `[{ label: 'assignments.title' }]`.
- Fetch data using `api.assignments.listYearAssignments` and context using `useSelectedAcademicYear()`.
- Display a header with title, subtitle, and an "Edit" button (hidden if selected year is inactive).
- Display a card container with the 3 tabs:
  - **Board Tab**: Simple grid of board member profiles.
  - **Branch Tab**: Cards for each of the 6 branches listing their leaders.
  - **Class Tab**: A DataTable showing classes, homerooms, and co-teachers.

---

## Phase 4: Frontend Edit Page (`src/routes/_authenticated/assignments_.edit.tsx`)

- Implement `/assignments/edit` route.
- If selected year is inactive, redirect to `/assignments` with a toast.
- Display form sections per tab:
  - **Board Tab**: Multi-select Combobox Chip with save button.
  - **Branch Tab**: For each branch, show a Combobox Chip. Add a save button below the list.
  - **Class Tab**: Table showing classes. For each class, show a homeroom Select dropdown and a co-teachers Combobox Chips (filtering out the selected homeroom teacher). Add a save button at the bottom of the table.
- Implement tab-specific dirty states to trigger leave confirmation if any tab has unsaved changes.

---

## Phase 5: Verification

- **Automated Tests**:
  - Write test file `convex/assignments.test.ts` to test queries and mutations (active/inactive year guards, soft-delete replacement logic).
  - Write Vitest file `src/routes/_authenticated/-assignments.test.tsx` and `src/routes/_authenticated/-assignments_.edit.test.tsx` to verify component rendering, selection changes, and page redirection.
- **Coverage**: Verify test coverage is at least 75%.
