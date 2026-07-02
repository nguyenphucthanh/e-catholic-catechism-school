# 19. Shared Student Form Component (Create & Edit)

This plan outlines the implementation of a shared student form component used for both creating and editing students. It includes the backend mutations for sacraments and class enrollment, helper queries for inline guardian search-and-link, the UI design matching the existing design system, and route integration.

---

## Phase 0: Documentation Discovery

### 1. Existing Patterns & Allowed APIs

**Form Validation & Design**:
- Form library: `@tanstack/react-form`
- Form fields styling: `@base-ui/react` (wrapped in components like `Field`, `FieldLabel`, `FieldError` from `~/components/ui/field`)
- Inputs: `Input` from `~/components/ui/input`, `PhoneInput` from `~/components/custom/inputs/phone-input` (using E.164 verification via `libphonenumber-js`), and `Select` from `~/components/ui/select`
- Layout: Stacked sections inside `Card` elements, matching the catechist form layout seen in `src/routes/_authenticated/catechists_.create.tsx`
- Cancel & Dirty Checks: Use local states (`formDirty`, `confirmLeaveOpen`) and `AlertDialog` for page exits when the form has unstaged changes.

**Convex Database APIs**:
- Students: `students`, `studentAddresses`, `studentSacraments`, `guardians`, `guardianContacts`, `studentGuardians`, `studentClasses`
- Key lookup index on `guardianContacts`: `.withIndex('by_value', q => q.eq('value', phone))`
- Unique constraints:
  - `studentGuardians`: `(studentId, guardianId)` and `(studentId, contactPriority)`
  - `studentSacraments`: `(studentId, sacramentType)`
  - `studentClasses`: `(studentId, classYearId)`

### 2. Anti-patterns to Avoid
- Do NOT run nested/chained mutations on the frontend without proper error handling or rollback flags. Show clear toast alerts if one of the sequential mutations fails.
- Do NOT duplicate guardian profiles. If a guardian's primary phone already exists, reuse and link the existing record.
- Do NOT hardcode localized strings or select labels; define them in `src/locales/vi.json` and `src/locales/en.json`.
- Do NOT skip E.164 format enforcement for phone numbers (e.g. `+84901234567`).

---

## Phase 1: Backend Mutations & Queries (Convex)

We need to add helper functions in the backend to support sacraments, class listing/enrollment, and smart guardian lookup.

### 1a. Sacraments Upsert & Delete Mutations
Add mutations to `convex/students.ts` to manage sacraments.

```typescript
// File: convex/students.ts
// Add imports for sacrament types if not present

export const upsertStudentSacrament = mutation({
  args: {
    requesterId: v.id('catechists'),
    studentId: v.id('students'),
    sacramentType: v.union(
      v.literal('baptism'),
      v.literal('first_confession'),
      v.literal('first_communion'),
      v.literal('confirmation'),
    ),
    receivedDate: v.optional(v.string()), // YYYY-MM-DD
    receivedPlace: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx, args.requesterId)
    const { requesterId, studentId, sacramentType, ...fields } = args

    const existing = await ctx.db
      .query('studentSacraments')
      .withIndex('by_student_id_and_sacrament_type', (q) =>
        q.eq('studentId', studentId).eq('sacramentType', sacramentType),
      )
      .unique()

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...fields,
        isDeleted: false,
      })
      return existing._id
    } else {
      return await ctx.db.insert('studentSacraments', {
        studentId,
        sacramentType,
        ...fields,
        isDeleted: false,
      })
    }
  },
})

export const softDeleteStudentSacrament = mutation({
  args: {
    requesterId: v.id('catechists'),
    studentId: v.id('students'),
    sacramentType: v.union(
      v.literal('baptism'),
      v.literal('first_confession'),
      v.literal('first_communion'),
      v.literal('confirmation'),
    ),
  },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx, args.requesterId)
    const { studentId, sacramentType } = args

    const existing = await ctx.db
      .query('studentSacraments')
      .withIndex('by_student_id_and_sacrament_type', (q) =>
        q.eq('studentId', studentId).eq('sacramentType', sacramentType),
      )
      .unique()

    if (existing && !existing.isDeleted) {
      await ctx.db.patch(existing._id, { isDeleted: true })
    }
  },
})
```

### 1b. Class Enrollment Mutation
Add a mutation to `convex/students.ts` to enroll a student in a class.

```typescript
// File: convex/students.ts

export const enrollStudentInClass = mutation({
  args: {
    requesterId: v.id('catechists'),
    studentId: v.id('students'),
    classYearId: v.id('classYears'),
    enrolledDate: v.string(), // YYYY-MM-DD
  },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx, args.requesterId)
    const { studentId, classYearId, enrolledDate } = args

    const existing = await ctx.db
      .query('studentClasses')
      .withIndex('by_student_id_and_class_year_id', (q) =>
        q.eq('studentId', studentId).eq('classYearId', classYearId),
      )
      .unique()

    if (existing) {
      if (existing.isDeleted || existing.status !== 'active') {
        await ctx.db.patch(existing._id, {
          status: 'active',
          enrolledDate,
          isDeleted: false,
        })
        return existing._id
      }
      throw new Error('Already enrolled in this class for the academic year')
    }

    const classYear = await ctx.db.get('classYears', classYearId)
    if (!classYear || classYear.isDeleted) {
      throw new Error('Class year not found')
    }

    // Check if there is already a primary enrollment for the same academic year
    const currentEnrollments = await ctx.db
      .query('studentClasses')
      .withIndex('by_student_id', (q) => q.eq('studentId', studentId))
      .collect()

    for (const e of currentEnrollments) {
      if (!e.isDeleted && e.isPrimaryClass && e.status === 'active') {
        const cy = await ctx.db.get('classYears', e.classYearId)
        if (cy && !cy.isDeleted && cy.academicYearId === classYear.academicYearId) {
          throw new Error('Student already has a primary class enrollment for this academic year')
        }
      }
    }

    return await ctx.db.insert('studentClasses', {
      studentId,
      classYearId,
      enrolledDate,
      isPrimaryClass: true,
      status: 'active',
      isDeleted: false,
    })
  },
})
```

### 1c. Guardian Phone Lookup Query
Add a query to `convex/guardians.ts` to find a guardian by phone number.

```typescript
// File: convex/guardians.ts

export const findByPhone = query({
  args: {
    requesterId: v.id('catechists'),
    phone: v.string(),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)
    
    // Look up primary contact phone
    const contact = await ctx.db
      .query('guardianContacts')
      .withIndex('by_value', (q) => q.eq('value', args.phone))
      .unique()

    if (!contact || contact.isDeleted || contact.contactType !== 'phone') {
      return null
    }

    const guardian = await ctx.db.get('guardians', contact.guardianId)
    if (!guardian || guardian.isDeleted) {
      return null
    }

    return {
      _id: guardian._id,
      fullName: guardian.fullName,
      saintName: guardian.saintName,
      notes: guardian.notes,
    }
  },
})
```

### 1d. Class Years List Query
Add a query to `convex/classes.ts` to list class years with names for an academic year (for selection dropdown).

```typescript
// File: convex/classes.ts

export const listClassYears = query({
  args: {
    requesterId: v.id('catechists'),
    academicYearId: v.id('academicYears'),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)

    const classYears = await ctx.db
      .query('classYears')
      .withIndex('by_academic_year_id', (q) =>
        q.eq('academicYearId', args.academicYearId),
      )
      .collect()

    const activeClassYears = classYears.filter((cy) => !cy.isDeleted)

    const results = await Promise.all(
      activeClassYears.map(async (cy) => {
        const classRecord = await ctx.db.get('classes', cy.classId)
        return {
          classYearId: cy._id,
          classId: cy.classId,
          className: classRecord?.name ?? '—',
        }
      }),
    )

    return results.filter((r) => r.className !== '—')
  },
})
```

### Verification Checklist — Phase 1
- [ ] Run `npx tsc --noEmit` and confirm zero errors.
- [ ] Run Convex tests: `npm test` and ensure all tests pass.
- [ ] Create unit tests in `convex/students.test.ts` and `convex/guardians.test.ts` for the new queries/mutations.

---

## Phase 2: Form Layout & Zod Form Schema (Frontend)

We will build the shared form component at `src/components/forms/student-form.tsx`.

### 2a. Form Values Interface & Zod Schema
Define the type interface for the form inputs.

```typescript
export interface StudentFormValues {
  // Student Personal Info
  fullName: string
  saintName?: string
  dateOfBirth?: string
  gender: 'male' | 'female' | ''
  previousParish?: string
  previousDiocese?: string
  isActive: boolean

  // Address
  addressLine1?: string
  addressLine2?: string
  city?: string
  stateProvince?: string
  postalCode?: string
  hamlet?: string
  subHamlet?: string
  country: string

  // Sacraments (toggled via checklist)
  sacraments: {
    baptism: { received: boolean; date?: string; place?: string; notes?: string }
    first_confession: { received: boolean; date?: string; place?: string; notes?: string }
    first_communion: { received: boolean; date?: string; place?: string; notes?: string }
    confirmation: { received: boolean; date?: string; place?: string; notes?: string }
  }

  // Guardians (inline array)
  guardians: Array<{
    id?: string // local key or link ID
    guardianId?: string // Convex ID if linked
    fullName: string
    saintName?: string
    relationship: 'father' | 'mother' | 'guardian' | string
    contactPriority: number
    notes?: string
    phone: string
    email?: string
    isLinked: boolean // flag to lock name fields in UI
  }>

  // Optional Class Enrollment
  enrollment?: {
    classYearId: string
    enrolledDate: string
  }
}
```

### 2b. UI Structure (Long Scrollable Option A Layout)
Create `src/components/forms/student-form.tsx` with:
- **Card 1: Personal Information**
  - Text fields: Full Name (required), Saint Name, Previous Parish, Previous Diocese.
  - Select fields: Gender, Active status.
  - Date picker: Date of Birth.
- **Card 2: Address Details**
  - Text fields: Address Line 1/2, City, State/Province, Postal Code, Hamlet (Giáo Họ), Sub-Hamlet (Giáo Xóm).
  - Country selection (defaults to VN).
- **Card 3: Sacraments Checklist**
  - Renders 4 rows (Baptism, First Confession, First Communion, Confirmation).
  - Each has a checkbox labeled with the sacrament name.
  - Checking the box expands the row (smooth CSS transition) to show: Date Received, Place Received, and Notes.
- **Card 4: Guardians (Inline Option B)**
  - Dynamic array where the admin can add/remove parents.
  - For each guardian:
    - Primary Phone input (E.164 format with country-code selector).
    - Under the hood, on typing/blur, trigger the background lookup: `const existing = useQuery(api.guardians.findByPhone, { phone })`.
    - If `existing` resolves a record:
      - Display a badge: "Liên kết với phụ huynh hiện có" (Linked to existing guardian).
      - Auto-fill and disable the Saint Name and Full Name fields. Set `isLinked: true` and store `guardianId: existing._id`.
      - If the user changes or clears the phone number, unlock the fields and reset `isLinked: false`.
    - Text fields: Full Name, Saint Name, Email (stored in contacts), Relationship (father, mother, guardian dropdown), Contact Priority (auto-increments, editable), Link Notes.
- **Card 5: Class Enrollment (Optional)**
  - Only visible in `mode === 'create'` (collapsible or checkbox-toggled).
  - Shows academic year class selection dropdown (populated via `classes.listClassYears` with the active year ID) and an Enrolled Date picker.

### Verification Checklist — Phase 2
- [ ] Shared component compiles without TypeScript errors.
- [ ] Text inputs, dropdowns, and checkboxes render correctly.
- [ ] Phone input formats input values and performs validation.

---

## Phase 3: Create Student Route Integration

Create the route component at `src/routes/_authenticated/students_.create.tsx`.

### 3a. Saving Logic (Separated Mutations Chain)
When the form submits:
1. Call `api.students.create` -> returns `studentId`.
2. If address values are entered: call `api.students.upsertStudentAddress`.
3. For each checked sacrament:
   - Call `api.students.upsertStudentSacrament`.
4. For each guardian in the list:
   - If `isLinked` is true (existing guardian found by phone):
     - Call `api.guardians.linkGuardianToStudent` to create the link with priority & relationship.
   - If `isLinked` is false:
     - Call `api.guardians.createGuardian` -> returns `guardianId`.
     - Call `api.guardians.addGuardianContact` for the Phone (and Email if provided).
     - Call `api.guardians.linkGuardianToStudent` to create the link.
5. If Class Enrollment is toggled and valid:
   - Call `api.students.enrollStudentInClass`.
6. Show `toast.success(t('students.created'))`.
7. Navigate to `/students/$id` (the detail page).

*If any step in the sequence fails, catch the error, show a toast, and log the state. (Since mutations are separate, we will execute them in a structured `try/catch` chain).*

### Verification Checklist — Phase 3
- [ ] Submitting a complete form successfully creates the student record, address, sacraments, guardians, contacts, and class enrollment.
- [ ] Form warns before leaving page if dirty.
- [ ] Error states are cleanly handled with toasts.

---

## Phase 4: Edit Student Route Integration

Create the route component at `src/routes/_authenticated/students_.$id_.edit.tsx`.

### 4a. Initial Values Fetching & Mapping
We need to populate the form:
1. Fetch student details using the enhanced query (student, address, sacraments, and guardians with contacts).
2. Map the data into the form structure (`StudentFormValues`).

### 4b. Update Logic (Diffing & Save Sequence)
When the form is submitted:
1. Call `api.students.update` to patch personal fields.
2. Call `api.students.upsertStudentAddress` to update address fields.
3. Diff Sacraments:
   - If a sacrament received state is now false but previously had a record: call `api.students.softDeleteStudentSacrament`.
   - If received state is true: call `api.students.upsertStudentSacrament`.
4. Diff Guardians:
   - Identify deleted links: call `api.guardians.unlinkGuardianFromStudent` for links in the initial state that are missing from the submitted list.
   - For added links:
     - If existing guardian (by phone lookup): call `api.guardians.linkGuardianToStudent`.
     - If new guardian: create guardian, add contacts, link.
   - For modified links (relationship, priority changes): call `api.guardians.updateStudentGuardianLink`.
5. Show `toast.success(t('students.updated'))` and navigate back to the detail page.

### Verification Checklist — Phase 4
- [ ] Route `/students/$id/edit` fetches and populates the form correctly.
- [ ] Updates to student info, address, sacraments, and guardians save successfully.
- [ ] Removed guardians are unlinked correctly.

---

## Phase 5: Verification & Unit Tests

### 5a. Locales Additions
Add translation values in `src/locales/vi.json` and `src/locales/en.json` for:
- Form section titles (Personal, Address, Sacraments, Guardians, Enrollment)
- Field labels (Relationship, Priority, Received Place, etc.)
- Toast success/failure messages
- Form validation errors

### 5b. Automated Tests
Run unit tests for the frontend component:
- Create `src/components/forms/student-form.test.tsx` using `vitest`.
- Test rendering, input validation (required fields, phone formats).
- Test mock submits for both Create and Edit flows.
- Run tests: `npm test src/components/forms/student-form.test.tsx`.

---

## Phase 6: Final Audit

Run the full codebase verification suite:
- `npx tsc --noEmit`
- `npm test -- --coverage` (Verify coverage exceeds **75%**)
- Manual sanity checks on the frontend layout (mobile responsiveness, input fields align).
