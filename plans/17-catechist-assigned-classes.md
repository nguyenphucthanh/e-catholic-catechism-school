# 17: Catechist Assigned Classes Section

Display a list of all class assignments (teaching history) for a catechist, grouped by academic year, on their profile/details page.

## User Requirements

- **Goal**: Show all classes the catechist was assigned to across all academic years.
- **Grouping**: Grouped by Academic Year, with the latest academic year first.
- **UI Design**: A new Card section matching the details page style, displaying role badges (`homeroom` vs `co_teacher`) and class details.
- **Actions**: Clickable class names that navigate to `/classes/$id` (no direct management/editing capabilities on this page).

---

## Phase 0: Documentation Discovery ✓

### Database Schema (convex/schema.ts)

- **`classCatechists`**:
  - `catechistId: Id<'catechists'>`
  - `classYearId: Id<'classYears'>`
  - `academicYearId: Id<'academicYears'>`
  - `role: 'homeroom' | 'co_teacher'`
  - `isDeleted: boolean`
  - Index: `by_catechist_id` -> `['catechistId']`
- **`classYears`**:
  - `classId: Id<'classes'>`
  - `academicYearId: Id<'academicYears'>`
  - `isDeleted: boolean`
- **`classes`**:
  - `name: string`
  - `branchId: Id<'branches'>`
- **`academicYears`**:
  - `name: string` (e.g., "2024-2025")
- **`branches`**:
  - `name: string` (e.g., "Ấu Nhi")

### Copy-From References

- **Convex query check**: `convex/lib/authz.ts:181-189` demonstrates querying `classCatechists` by `catechistId` and filtering active academic year.
- **Frontend Card Styling**: `src/routes/_authenticated/catechists_.$id.tsx:232-276` (Contacts Card style: card headers, content grid/list, badges, skeleton load).
- **Navigation/Link**: `src/routes/_authenticated/classes.tsx:85-93` shows link to `/classes/$id`.
- **Breadcrumbs/Crumbs**: `src/routes/_authenticated/catechists_.$id.tsx:16-24`.
- **Testing**: `convex/catechists.test.ts:12-44` (Vitest run on Convex queries) and `src/routes/_authenticated/-catechists_.$id.test.tsx:85-102` (testing page components).

### Anti-Patterns to Avoid

- ❌ **Do NOT use database filters in Convex queries**: Use `.withIndex('by_catechist_id')` to fetch assignments.
- ❌ **Do NOT perform joins/fetches in React components**: Resolve relations (AcademicYear name, Class name, Branch name) on the backend and return a fully resolved list in the query response.
- ❌ **Do NOT handcode route URLs**: Always use TanStack Router `Link` or `useNavigate` with typed routes.
- ❌ **Do NOT ignore localization**: Use the i18n localization framework (`en.json`, `vi.json`) for teaching roles and section titles.

---

## Phase 1: Convex Backend & Localization

### Convex query

Add `getClassAssignments` query to `convex/catechists.ts`:

- **Args**:
  - `requesterId`: `v.id('catechists')`
  - `catechistId`: `v.id('catechists')`
- **Handler**:
  1. Call `await assertValidCatechist(ctx, args.requesterId)` to ensure authorization.
  2. Query `classCatechists` using `by_catechist_id` index matching `args.catechistId`.
  3. Filter out soft-deleted assignments (`isDeleted: true`).
  4. For each active assignment:
     - Fetch the `classYears` record. Ensure it exists and is not soft-deleted.
     - Fetch the `classes` record using `classId`. Ensure it is active.
     - Fetch the `academicYears` record using `academicYearId`.
     - Fetch the `branches` record using `branchId` from the class object.
  5. Map to:
     ```ts
     {
       _id: Id<'classCatechists'>,
       role: 'homeroom' | 'co_teacher',
       classYearId: Id<'classYears'>,
       classId: Id<'classes'>,
       className: string,
       branchId: Id<'branches'>,
       branchName: string,
       academicYearId: Id<'academicYears'>,
       academicYearName: string,
     }
     ```
  6. Return the mapped assignments array.

### Convex Unit Tests

Add a new test inside `convex/catechists.test.ts`:

- Seed a dummy academic year, branch, class, classYear, and classCatechist assignment.
- Invoke `api.catechists.getClassAssignments`.
- Assert that the returned array is populated with the correct class names, roles, and academic year details.

### i18n Locales

Add the following keys to `src/locales/en.json`:

```json
"catechists.detail.classes.title": "Teaching Assignments",
"catechists.detail.classes.empty": "No teaching assignments found.",
"catechists.detail.classes.role.homeroom": "Homeroom Teacher",
"catechists.detail.classes.role.co_teacher": "Co-teacher"
```

Add the corresponding keys to `src/locales/vi.json`:

```json
"catechists.detail.classes.title": "Phân Công Giảng Dạy",
"catechists.detail.classes.empty": "Chưa có phân công giảng dạy.",
"catechists.detail.classes.role.homeroom": "Chủ nhiệm",
"catechists.detail.classes.role.co_teacher": "Đồng giảng"
```

### Verification Checklist

- Run tests: `npx vitest run convex/catechists.test.ts`
- Grep locales to verify keys exist.

---

## Phase 2: Frontend Integration & Unit Tests

### Frontend UI Changes

Modify `src/routes/_authenticated/catechists_.$id.tsx`:

- Fetch the assignments using `useQuery(api.catechists.getClassAssignments, requesterId ? { requesterId, catechistId: id } : 'skip')`.
- Render a new `Card` below the "Contact Information" Card.
- **Grouping**: Group the assignments array by `academicYearName` (sorting academic year groups chronologically descending, and sorting classes within a group alphabetically or by ID).
- **Layout**:
  - CardHeader with CardTitle: `{t('catechists.detail.classes.title')}`
  - CardContent:
    - If loading, show Skeletons.
    - If empty, show `-` or empty state message.
    - If populated, render groups. Each group has:
      - Academic Year sub-header (e.g. `Năm học 2024-2025` or `Academic Year: 2024-2025`).
      - A list of assignments under this year.
      - Each list item displays:
        - Class Name as a Link to `/classes/$id` (passing `params: { id: assignment.classId }`).
        - Badge for role: `homeroom` (primary/default variant) vs `co_teacher` (secondary variant).
        - Branch name text next to class name or below it.
        - Separation lines between items.

### Frontend Unit Tests

Modify `src/routes/_authenticated/-catechists_.$id.test.tsx`:

- Mock `api.catechists.getClassAssignments` to return a sample assignment list.
- Assert that the section header, academic years, class name link, and role badges render correctly.
- Add a loading mock test assertion ensuring skeletons render when the query is loading.

### Verification Checklist

- Run frontend tests: `npx vitest run src/routes/_authenticated/-catechists_.$id.test.tsx`
- Run all tests with coverage to ensure >=75%: `npm test -- --coverage`
- Verify locally in the browser with `npm run dev`.
