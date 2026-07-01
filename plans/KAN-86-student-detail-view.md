# KAN-86: Student Detail View Page

## Goal

Build `/students/$studentId` view-only dashboard showing all student data: personal info, sacraments history, enrollment history. Include edit button linking to `/students/$id/edit`.

## User Requirements

- **Layout**: Stacked cards (scrollable sections)
- **Sections**: Personal info, Sacraments record, Enrollment history
- **Edit button**: Link to separate edit page (`/students/$id/edit`)
- **Type**: View-only dashboard (no inline editing)

---

## Phase 0: Documentation Discovery ✓

**Schema** (convex/schema.ts):

- Students: studentCode, fullName, saintName, dateOfBirth, gender, previousParish, isActive, isDeleted
- StudentAddresses: country, addressLine1, addressLine2, city, stateProvince, postalCode, hamlet, subHamlet
- StudentSacraments: studentId, sacramentType (baptism|first_confession|first_communion|confirmation), receivedDate, receivedPlace, notes
- StudentClasses (enrollments): studentId, classYearId, enrolledDate, status (active|on_leave|withdrawn), leftDate

**Pattern** (existing detail pages):

- Route file: `src/routes/_authenticated/[resource]_.$id.tsx`
- Breadcrumbs: `staticData: { crumbs: [{label, path}, {label}] }` (catechists_.$id.tsx:16-24)
- Layout: `<div className="flex flex-col gap-6">` → PageHeader → Card sections (catechists_.$id.tsx:77-277)
- Card structure: CardHeader/CardTitle + CardContent with 2-column grid (gap-4 sm:grid-cols-2)
- Loading: Skeleton pattern with `[...Array(5)].map()`
- Backend: Enriched query returning student + address + related data

**UI Components**:

- Card, CardHeader, CardTitle, CardContent from `src/components/ui/card.tsx`
- PageHeader component for title + actions
- Badge for status indicators
- Skeleton for loading states

**Query Pattern** (convex/students.ts):

- `getStudentDetail(studentId, requesterId)` — returns enriched object
- Auth: `await assertValidCatechist(ctx, requesterId)`

---

## Phase 1: Setup Route & Query

**Tasks:**

1. Create `src/routes/_authenticated/students_.$id.tsx`
   - Copy breadcrumb structure from `catechists_.$id.tsx:16-24`
   - Route path: `/_authenticated/students_.$id`
   - Crumbs: `[{ label: 'students.title', path: '/students' }, { label: 'students.detail.title' }]`

2. Create/enhance Convex query `convex/students.ts`:
   - Function: `getStudentDetail(studentId, requesterId)`
   - Returns: `{ ...student, address, sacraments, enrollments }`
   - Include query expansion for classYear data in enrollments
   - Auth check: `await assertValidCatechist(ctx, requesterId)`

3. Frontend component skeleton:
   - Hook: `const student = useQuery('getStudentDetail', { studentId: params.id })`
   - Container: `<div className="flex flex-col gap-6">`
   - PageHeader with title (student name), edit button (Button → `/students/$id/edit`)

**Verification:**

- [ ] Route file exists at `src/routes/_authenticated/students_.$id.tsx`
- [ ] Query returns full data shape (student + address + sacraments + enrollments)
- [ ] Breadcrumb renders correctly
- [ ] Edit button is clickable Button → `/students/$id/edit`
- [ ] No TypeScript errors

**Anti-patterns:**

- ❌ Don't inline sacrament/enrollment fetching in component — use backend enrichment
- ❌ Don't hardcode route paths — use Link/useNavigate

---

## Phase 2: Personal Info Card

**Layout:**

```
Card
├── CardHeader
│   └── CardTitle: "students.detail.personal.title"
└── CardContent
    └── Grid (gap-4 sm:grid-cols-2)
        ├── Field: Student Code
        ├── Field: Full Name
        ├── Field: Saint Name
        ├── Field: Date of Birth
        ├── Field: Gender (badge or text)
        ├── Field: Previous Parish
        ├── Field: Country
        ├── Field: City
        ├── Field: Address Line 1
        ├── Field: Hamlet (Giáo Họ)
        └── Field: Sub-Hamlet (Giáo Xóm)
```

**Tasks:**

1. Create Card with CardHeader + CardTitle
2. Build grid display (2-col responsive)
3. For each field:
   - Label (text-sm font-medium text-muted-foreground)
   - Value (or `-` if null)
4. Format Date of Birth as localized date (use formatter)
5. Skeleton: 5 `<Skeleton className="h-4 w-full">` while loading

**Verification:**

- [ ] Card renders with all fields visible
- [ ] 2-column grid collapses on mobile (sm:grid-cols-2)
- [ ] Null values display as `-`
- [ ] Date formatted correctly
- [ ] Skeleton shows while `student === undefined`

**Anti-patterns:**

- ❌ Don't compute derived fields (e.g., age from DOB) — send from backend if needed
- ❌ Don't hardcode field labels — use i18n keys

---

## Phase 3: Sacraments Card

**Layout:**

```
Card
├── CardHeader
│   └── CardTitle: "students.detail.sacraments.title"
└── CardContent
    └── If sacraments.length > 0:
        └── Table or List
            ├── Col: Sacrament Type (badge)
            ├── Col: Received Date
            ├── Col: Place
            └── Col: Notes
       Else:
        └── Text: "No sacraments recorded"
```

**Tasks:**

1. Create Card with CardHeader + CardTitle
2. Check if sacraments array exists & non-empty
3. Render as list or table rows:
   - Sacrament Type: Badge (use variant based on type)
   - Received Date: formatted date (or `-`)
   - Place: text (or `-`)
   - Notes: text (or `-`)
4. Empty state: `<p className="text-sm text-muted-foreground">No sacraments recorded</p>`
5. Skeleton: 4 `<Skeleton>` rows (one per sacrament type)

**Field Mapping:**

- `baptism` → Baptism
- `first_confession` → First Confession
- `first_communion` → First Communion
- `confirmation` → Confirmation

**Verification:**

- [ ] Card renders with all 4 sacrament types (even if null)
- [ ] Dates formatted correctly
- [ ] Empty state shows if no sacraments
- [ ] Badge styling applied per sacrament type
- [ ] Skeleton rows show while loading

**Anti-patterns:**

- ❌ Don't hardcode sacrament type labels — use i18n keys `students.sacraments.{type}`
- ❌ Don't assume only one sacrament per type — query may return multiple

---

## Phase 4: Enrollment History Card

**Layout:**

```
Card
├── CardHeader
│   └── CardTitle: "students.detail.enrollments.title"
└── CardContent
    └── If enrollments.length > 0:
        └── List (flex flex-col)
            ├── Item (flex items-start gap-3 py-3 border-t)
            │   ├── Class Name (font-medium)
            │   ├── Year
            │   ├── Enrolled Date
            │   ├── Status (badge)
            │   └── Left Date (if withdrawn)
       Else:
        └── Text: "No enrollments recorded"
```

**Tasks:**

1. Create Card with CardHeader + CardTitle
2. Check if enrollments array exists & non-empty
3. Sort by enrolledDate DESC (newest first)
4. Render as list items:
   - Class Name: text (font-medium) — from `classYear.className` or similar
   - Year: text — from `classYear.year`
   - Enrolled Date: formatted date
   - Status: Badge (active=green, on_leave=yellow, withdrawn=red)
   - Left Date: shown only if `status === 'withdrawn'`
5. Empty state: `<p className="text-sm text-muted-foreground">No enrollments recorded</p>`
6. Skeleton: 3 `<Skeleton>` rows

**Verification:**

- [ ] Card renders with enrollments sorted by date (newest first)
- [ ] Status badges display with correct colors
- [ ] Left Date only shown for withdrawn status
- [ ] Empty state if no enrollments
- [ ] Class Year details linked/resolved
- [ ] Skeleton rows show while loading

**Anti-patterns:**

- ❌ Don't compute semester/grade from enrolledDate — use backend classYear data
- ❌ Don't filter enrollments by status — show all (user can filter on list view)

---

## Phase 5: Loading & Error States

**Tasks:**

1. **Loading state:**
   - While `student === undefined`: render Skeleton cards
   - Show 3 Card placeholders (Personal, Sacraments, Enrollments)
   - Each with multiple `<Skeleton>` lines

2. **Error state:**
   - If query throws error: show error Card with message
   - Include retry button

3. **Not found state:**
   - If `student === null` (no result): show "Student not found" message
   - Include back button to `/students`

4. **Refetch logic:**
   - Use TanStack Query retry/refetch on error

**Verification:**

- [ ] Skeleton appears on first load (500ms debounce acceptable)
- [ ] Error message displays on query failure
- [ ] Not-found state renders when student ID invalid
- [ ] All sections load in parallel (no waterfall)
- [ ] Refetch works on retry

---

## Phase 6: Verify & Polish

**Checklist:**

- [ ] Route exists: `src/routes/_authenticated/students_.$id.tsx`
- [ ] Query function complete: `convex/students.ts` → `getStudentDetail(...)`
- [ ] 3 Cards render: Personal Info, Sacraments, Enrollments
- [ ] PageHeader with student name + edit button
- [ ] Edit button links to `/students/$id/edit`
- [ ] All text keys in `en.json` (students.detail.* namespace)
- [ ] Skeleton loading states on all cards
- [ ] Empty states for Sacraments & Enrollments sections
- [ ] Responsive design: 2-col grid → 1-col on mobile
- [ ] No TypeScript errors
- [ ] No Convex validation errors
- [ ] Dates formatted consistently (locale-aware)
- [ ] Test on real student record (create test data if needed)

**Final checks:**

- Breadcrumb navigates correctly
- Back link from detail → list view works
- Edit link opens `/students/$id/edit` (even if edit page not done yet)
- Loading/error states all functional

---

## Implementation Order

1. **Phase 1** (Route + Query setup)
2. **Phase 2** (Personal Info Card)
3. **Phase 3** (Sacraments Card)
4. **Phase 4** (Enrollment History Card)
5. **Phase 5** (Loading/Error states)
6. **Phase 6** (Verify & Polish)

Each phase can be implemented independently once Phase 1 is complete.
