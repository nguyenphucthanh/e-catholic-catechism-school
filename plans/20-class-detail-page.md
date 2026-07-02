# 20: Class Detail Page Enhancement

Enhance the class detail page (`src/routes/_authenticated/classes_.$id.tsx`) to show details relevant to the currently selected academic year:
- Section showing assigned catechists (Homeroom teacher and Co-teachers) and the number of students.
- Three tabs: Students list (using `DataTable`), Exams and points (placeholder), Attendance (placeholder).
- If the class is not activated/assigned for the selected academic year, show a year alert.

---

## Phase 0: Documentation Discovery ✓

### Database Schema (convex/schema.ts)

- **`classes`**:
  - `name: string`
  - `branchId: Id<'branches'>`
  - `description?: string`
  - `isDeleted: boolean`
- **`classYears`**:
  - `classId: Id<'classes'>`
  - `academicYearId: Id<'academicYears'>`
  - `isDeleted: boolean`
  - Index: `by_class_id_and_academic_year_id` -> `['classId', 'academicYearId']`
- **`classCatechists`**:
  - `catechistId: Id<'catechists'>`
  - `classYearId: Id<'classYears'>`
  - `academicYearId: Id<'academicYears'>`
  - `role: 'homeroom' | 'co_teacher'`
  - `isDeleted: boolean`
  - Index: `by_class_year_id` -> `['classYearId']`
- **`studentClasses`**:
  - `studentId: Id<'students'>`
  - `classYearId: Id<'classYears'>`
  - `isPrimaryClass: boolean`
  - `status: 'active' | 'on_leave' | 'withdrawn'`
  - `isDeleted: boolean`
  - Index: `by_class_year_id` -> `['classYearId']`

### Copy-From References

- **Convex queries**: `convex/classes.ts:70-78` (class query) and `convex/assignments.ts:76-116` (class catechist listing and mapping).
- **Tabs Component**: `src/routes/_authenticated/assignments.tsx:69-77` showing tabs usage with `@base-ui/react/tabs` primitives.
- **DataTable Component**: `src/routes/_authenticated/classes.tsx:182-188` showing usage of the `DataTable` custom component.
- **Card and Avatar Layout**: `src/routes/_authenticated/assignments.tsx:89-115` and `src/routes/_authenticated/students_.$id.tsx:99-150` for formatting cards, profile names, and values.

### Anti-Patterns to Avoid

- ❌ **Do NOT perform queries within loops**: Fetch all related `classCatechists` and `studentClasses` by `classYearId` in a single query index-scan, then perform get fetches for corresponding entities.
- ❌ **Do NOT mix client/server state for calculations**: Fetch and count the students on the backend, and supply the fully computed list and count.
- ❌ **Do NOT ignore the selected academic year**: Ensure the page listens to changes from `useSelectedAcademicYear()`.
- ❌ **Do NOT hardcode texts**: Always fetch translation strings from `vi.json` and `en.json` via the `t()` function.

---

## Phase 1: Convex Backend & Localization

### Convex query

Add a new query `getClassDetails` to `convex/classes.ts`:

- **Args**:
  - `requesterId`: `v.id('catechists')`
  - `classId`: `v.id('classes')`
  - `academicYearId`: `v.id('academicYears')`
- **Handler**:
  1. Call `await assertValidCatechist(ctx, args.requesterId)` to ensure authorization.
  2. Query `classes` using `args.classId`. If it doesn't exist or is soft-deleted, return `null`.
  3. Query `branches` using the class's `branchId` to get the branch name.
  4. Query `classYears` with index `by_class_id_and_academic_year_id` using `args.classId` and `args.academicYearId`.
  5. If no active `classYear` is found, return the class and branch, but set `classYear: null`, `assignedCatechists: []`, `students: []`, and `studentCount: 0`.
  6. If active `classYear` exists:
     - Fetch all `classCatechists` matching `classYearId`. Filter `!isDeleted`.
     - Fetch the corresponding `catechists` records.
     - Fetch all `studentClasses` matching `classYearId`. Filter `!isDeleted`.
     - Fetch the corresponding `students` records.
  7. Return:
     ```ts
     {
       class: Doc<'classes'>,
       branch: Doc<'branches'> | null,
       classYear: Doc<'classYears'> | null,
       assignedCatechists: Array<{
         role: 'homeroom' | 'co_teacher',
         catechist: Doc<'catechists'>
       }>,
       students: Array<{
         enrollment: {
           _id: Id<'studentClasses'>,
           status: 'active' | 'on_leave' | 'withdrawn',
           enrolledDate: string
         },
         student: Doc<'students'>
       }>,
       studentCount: number
     }
     ```

### Convex Unit Tests

Add tests to `convex/classes.test.ts`:
- Assert the query correctly returns details for a class year including catechists and students.
- Assert the query returns `classYear: null` when a class has not been created or activated for that academic year.

### i18n Locales

Add following translation keys:

**`src/locales/vi.json`**:
```json
  "classes.detail.catechists.title": "Giáo Lý Viên Phụ Trách",
  "classes.detail.catechists.empty": "Chưa xếp lớp Giáo Lý Viên cho năm học này",
  "classes.detail.catechists.homeroom": "Chủ nhiệm",
  "classes.detail.catechists.coTeacher": "Đồng giảng",
  "classes.detail.students.count": "Sĩ số Lớp",
  "classes.detail.students.countDesc": "Học viên đang học năm học này",
  "classes.detail.students.unit": "học viên",
  "classes.detail.tabs.students": "Danh sách học viên",
  "classes.detail.tabs.exams": "Điểm & Khảo hạch",
  "classes.detail.tabs.attendance": "Điểm danh",
  "classes.detail.notActivated": "Lớp học này chưa được kích hoạt hoặc xếp lịch cho năm học được chọn ({{year}}).",
  "classes.detail.placeholder.comingSoon": "Tính năng đang phát triển",
  "classes.detail.placeholder.desc": "Phần này sẽ sớm hiển thị sau khi cấu trúc điểm số và điểm danh được hoàn thành."
```

**`src/locales/en.json`**:
```json
  "classes.detail.catechists.title": "Assigned Catechists",
  "classes.detail.catechists.empty": "No catechists assigned for this academic year",
  "classes.detail.catechists.homeroom": "Homeroom",
  "classes.detail.catechists.coTeacher": "Co-teacher",
  "classes.detail.students.count": "Student Count",
  "classes.detail.students.countDesc": "Enrolled students in this academic year",
  "classes.detail.students.unit": "students",
  "classes.detail.tabs.students": "Students List",
  "classes.detail.tabs.exams": "Exams & Points",
  "classes.detail.tabs.attendance": "Attendance",
  "classes.detail.notActivated": "This class has not been activated or scheduled for the selected academic year ({{year}}).",
  "classes.detail.placeholder.comingSoon": "Feature Coming Soon",
  "classes.detail.placeholder.desc": "This section will be available once the grading and attendance setups are complete."
```

### Verification Checklist

- Run Convex test suite: `npx vitest run convex/classes.test.ts`

---

## Phase 2: Frontend Integration & Unit Tests

### Frontend UI Changes

Modify `src/routes/_authenticated/classes_.$id.tsx`:
- Use `useSelectedAcademicYear()` to retrieve `selectedYearId`.
- Query `getClassDetails` using the active academic year.
- Render skeleton loaders while details are loading.
- If data is loaded but `classYear` is null:
  - Display the PageHeader.
  - Display an Alert / AlertDescription block informing that the class is not activated for the selected academic year.
- If class details are successfully loaded:
  - Render details inside a two-column grid layout using `Card` components:
    - **Card 1: Assigned Catechists**: Homeroom teacher (listed first with an avatar, role badge, and full name) and Co-teachers listed next. If none, show the empty message.
    - **Card 2: Sĩ số Lớp (Student Count)**: Large stat text representing the total student count.
  - Render a `Tabs` container with:
    - **Students List Tab**: Render a `DataTable` component. Columns include:
      - Student Code (linked to `/students/$id`)
      - Saint Name
      - Full Name
      - Gender (localized badge)
      - Date of Birth (formatted)
      - Status (badge mapping `active`, `on_leave`, `withdrawn`)
    - **Exams and Points Tab**: Render a placeholder card with `classes.detail.placeholder.comingSoon`.
    - **Attendance Tab**: Render a placeholder card with `classes.detail.placeholder.comingSoon`.

### Frontend Routing Unit Tests

Modify `src/routes/_authenticated/-classes_.$id.test.tsx`:
- Update mocks for `useSelectedAcademicYear` and mock `api.classes.getClassDetails`.
- Verify loader is shown when data is undefined.
- Verify warning message is shown when `classYear` is null.
- Verify assigned catechists, student count, and tabs are rendered when class details exist.

### Verification Checklist

- Run frontend tests: `npx vitest run src/routes/_authenticated/-classes_.$id.test.tsx`
- Verify test coverage is above 75%: `npm test -- --coverage`
- Verify locally in browser with academic year changes.
