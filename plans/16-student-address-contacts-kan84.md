# KAN-84: Student Address and Student Contact CRUD (Backend)

## Ticket

**Summary**: Implement StudentAddress (1-to-1) and student contacts backend.
**Description**: Create backend support for StudentAddress (1-to-1) and any direct contacts. Follow E.164 phone validation.
**Labels**: backend, convex, students, addresses

## Phase 0: Documentation Discovery (DONE)

### Schema tables already defined (`convex/schema.ts`)

**`studentAddresses`** (lines 260–273)

```
studentId:      v.id('students')           [required, FK]
country:        v.string()                  [required, ISO 3166-1 alpha-2]
addressLine1–addressLine2: v.optional(v.string())
city, stateProvince, postalCode:            v.optional(v.string())
hamlet:         v.optional(v.string())      [Giáo Họ]
subHamlet:      v.optional(v.string())      [Giáo Xóm]
isDeleted:      v.boolean()
indexes: by_student_id(['studentId']), by_is_deleted(['isDeleted'])
```

**`guardians`** (lines 279–284)

```
fullName:       v.string()                  [required]
saintName:      v.optional(v.string())      [Tên Thánh]
notes:          v.optional(v.string())
isDeleted:      v.boolean()
indexes: by_is_deleted(['isDeleted'])
```

**`guardianContacts`** (lines 292–307) — NOTE: no `label` field (unlike catechistContacts)

```
guardianId:     v.id('guardians')           [required, FK]
contactType:    v.union('phone'|'email'|'zalo'|'other')
value:          v.string()                  [E.164 for phone]
isPrimary:      v.boolean()
notes:          v.optional(v.string())
isDeleted:      v.boolean()
indexes: by_guardian_id, by_value, by_is_deleted
```

**`studentGuardians`** (lines 315–330) — many-to-many junction

```
studentId:      v.id('students')            [required]
guardianId:     v.id('guardians')           [required]
relationship:   v.string()                  [e.g. "father"/"mother"/"guardian"/free text]
contactPriority: v.number()                 [1 = first to contact; unique per studentId]
notes:          v.optional(v.string())
isDeleted:      v.boolean()
indexes: by_student_id, by_guardian_id, by_student_id_and_guardian_id,
         by_student_id_and_contact_priority, by_is_deleted
```

### Reference implementation

- Catechist address mutations: `convex/catechists.ts` lines 152–181 (`upsertMyAddress`), 325–344 (`softDeleteAddress`)
- Catechist contact mutations: lines 183–255 (`addContact`, `updateContact`, `deleteContact`)
- E.164 regex: `convex/catechists.ts` line 9 — `/^\+[1-9]\d{6,14}$/`
- clearPrimaryContacts helper: lines 17–34
- Error constants: `convex/lib/errors.ts`
- Auth pattern: `assertAdminRole(ctx, requesterId)` (all student mutations require admin — students have no auth accounts)

### Key architectural difference vs catechists

Students have **no direct contact table**. Contacts flow through:
`students` → `studentGuardians` → `guardians` → `guardianContacts`

This requires implementing three layers:

1. StudentAddress (1-to-1)
2. Guardian CRUD (independent entity, reusable across siblings)
3. GuardianContact CRUD (phone/email/zalo/other on a guardian)
4. StudentGuardian link mutations (junction: relationship + contactPriority)

### Existing student mutations (`convex/students.ts`)

- `list`, `get`, `create`, `update`, `softDelete` — all implemented
- `get` currently returns only student fields; needs enhancement to include address + guardians + contacts
- Auth: `assertAdminRole` on `create`, `update`, `softDelete`; `assertValidCatechist` on `list`, `get`

### Test patterns (`convex/catechists.test.ts`)

- Address upsert: lines 46–90
- Contact CRUD + soft-delete verify: lines 92–149
- E.164 rejection: lines 151–172
- Primary-clearing: lines 197–233
- Soft-delete verification via `t.run()` checking `isDeleted === true`: lines 430–431

---

## Phase 1: Error Constants

**File**: `convex/lib/errors.ts`

Add new error constant groups:

```typescript
export const STUDENT_ERRORS = {
  NOT_FOUND: 'STUDENT_NOT_FOUND',
  IN_USE_BY_ENROLLMENT: 'STUDENT_IN_USE_BY_ENROLLMENT',
  ADDRESS_NOT_FOUND: 'STUDENT_ADDRESS_NOT_FOUND', // ADD
} as const

export const GUARDIAN_ERRORS = {
  NOT_FOUND: 'GUARDIAN_NOT_FOUND',
  CONTACT_NOT_FOUND: 'GUARDIAN_CONTACT_NOT_FOUND',
  INVALID_PHONE: 'GUARDIAN_INVALID_PHONE',
  LINK_NOT_FOUND: 'GUARDIAN_LINK_NOT_FOUND', // studentGuardians row not found
  DUPLICATE_LINK: 'GUARDIAN_DUPLICATE_LINK', // same (studentId, guardianId) already active
  DUPLICATE_PRIORITY: 'GUARDIAN_DUPLICATE_PRIORITY', // same contactPriority already active for this student
} as const
```

**Verification**: `grep -n 'GUARDIAN_ERRORS\|ADDRESS_NOT_FOUND' convex/lib/errors.ts` — should return 7+ lines.

---

## Phase 2: StudentAddress Mutations

**File**: `convex/students.ts`

Import `STUDENT_ERRORS` is already imported. Add `assertAdminRole` import if missing.

### 2.1 `getStudentAddress` query

```typescript
export const getStudentAddress = query({
  args: {
    requesterId: v.id('catechists'),
    studentId: v.id('students'),
  },
  handler: async (ctx, { requesterId, studentId }) => {
    await assertValidCatechist(ctx, requesterId)
    return await ctx.db
      .query('studentAddresses')
      .withIndex('by_student_id', (q) => q.eq('studentId', studentId))
      .filter((q) => q.eq(q.field('isDeleted'), false))
      .unique()
  },
})
```

> **Anti-pattern guard**: Do NOT use `.collect()` on unbounded tables. Here `.unique()` is safe because studentAddresses is 1-to-1.

### 2.2 `upsertStudentAddress` mutation

Copy pattern from `catechists.ts:152–181`. Adapt:

- Replace `catechistId: v.id('catechists')` → `studentId: v.id('students')`
- Replace table name `'catechistAddresses'` → `'studentAddresses'`
- Add auth: `await assertAdminRole(ctx, requesterId)` (catechists.upsertMyAddress has no auth — students are admin-managed)
- Add `requesterId: v.id('catechists')` arg

```typescript
export const upsertStudentAddress = mutation({
  args: {
    requesterId: v.id('catechists'),
    studentId: v.id('students'),
    country: v.string(),
    addressLine1: v.optional(v.string()),
    addressLine2: v.optional(v.string()),
    city: v.optional(v.string()),
    stateProvince: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    hamlet: v.optional(v.string()),
    subHamlet: v.optional(v.string()),
  },
  handler: async (ctx, { requesterId, studentId, ...fields }) => {
    await assertAdminRole(ctx, requesterId)
    const existing = await ctx.db
      .query('studentAddresses')
      .withIndex('by_student_id', (q) => q.eq('studentId', studentId))
      .unique()
    if (existing !== null) {
      await ctx.db.patch(existing._id, fields)
    } else {
      await ctx.db.insert('studentAddresses', {
        studentId,
        ...fields,
        isDeleted: false,
      })
    }
  },
})
```

### 2.3 `softDeleteStudentAddress` mutation

Copy pattern from `catechists.ts:325–344`. Adapt for `studentId`, table `'studentAddresses'`, error `STUDENT_ERRORS.ADDRESS_NOT_FOUND`.

```typescript
export const softDeleteStudentAddress = mutation({
  args: {
    requesterId: v.id('catechists'),
    studentId: v.id('students'),
  },
  handler: async (ctx, { requesterId, studentId }) => {
    await assertAdminRole(ctx, requesterId)
    const address = await ctx.db
      .query('studentAddresses')
      .withIndex('by_student_id', (q) => q.eq('studentId', studentId))
      .unique()
    if (!address || address.isDeleted) {
      throw new Error(STUDENT_ERRORS.ADDRESS_NOT_FOUND)
    }
    await ctx.db.patch(address._id, { isDeleted: true })
  },
})
```

**Verification checklist**:

- [ ] `grep -n 'upsertStudentAddress\|getStudentAddress\|softDeleteStudentAddress' convex/students.ts` returns 3 hits
- [ ] TypeScript compiles: `npx tsc --noEmit`

---

## Phase 3: Guardian CRUD

**File**: `convex/guardians.ts` (new file)

Imports needed:

```typescript
import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { assertAdminRole, assertValidCatechist } from './lib/auth'
import { GUARDIAN_ERRORS } from './lib/errors'
```

### 3.1 E.164 validator + clearPrimaryGuardianContacts helper

Copy `E164_REGEX` and `validatePhone` from `catechists.ts:9–15`. Rename to avoid confusion:

```typescript
const E164_REGEX = /^\+[1-9]\d{6,14}$/

function validatePhone(value: string): void {
  if (!E164_REGEX.test(value)) {
    throw new Error(GUARDIAN_ERRORS.INVALID_PHONE)
  }
}
```

Copy `clearPrimaryContacts` pattern from `catechists.ts:17–34`. Adapt for `guardianContacts` and `guardianId`:

```typescript
async function clearPrimaryGuardianContacts(
  ctx: ...,
  guardianId: Id<'guardians'>,
  contactType: ContactType,
  excludeId?: Id<'guardianContacts'>,
) {
  const contacts = await ctx.db
    .query('guardianContacts')
    .withIndex('by_guardian_id', (q) => q.eq('guardianId', guardianId))
    .collect()
  for (const c of contacts) {
    if (!c.isDeleted && c.contactType === contactType && c._id !== excludeId) {
      await ctx.db.patch(c._id, { isPrimary: false })
    }
  }
}
```

> **Anti-pattern guard**: `.collect()` is acceptable here (bounded by guardian's contacts, not an unbounded table).

### 3.2 `createGuardian` mutation

```typescript
export const createGuardian = mutation({
  args: {
    requesterId: v.id('catechists'),
    fullName: v.string(),
    saintName: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { requesterId, ...fields }) => {
    await assertAdminRole(ctx, requesterId)
    return await ctx.db.insert('guardians', { ...fields, isDeleted: false })
  },
})
```

### 3.3 `updateGuardian` mutation

```typescript
export const updateGuardian = mutation({
  args: {
    requesterId: v.id('catechists'),
    guardianId: v.id('guardians'),
    fullName: v.string(),
    saintName: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { requesterId, guardianId, ...fields }) => {
    await assertAdminRole(ctx, requesterId)
    const guardian = await ctx.db.get(guardianId)
    if (!guardian || guardian.isDeleted) {
      throw new Error(GUARDIAN_ERRORS.NOT_FOUND)
    }
    await ctx.db.patch(guardianId, fields)
  },
})
```

### 3.4 `softDeleteGuardian` mutation

Guard: cannot soft-delete if guardian has active `studentGuardians` links.

```typescript
export const softDeleteGuardian = mutation({
  args: {
    requesterId: v.id('catechists'),
    guardianId: v.id('guardians'),
  },
  handler: async (ctx, { requesterId, guardianId }) => {
    await assertAdminRole(ctx, requesterId)
    const guardian = await ctx.db.get(guardianId)
    if (!guardian || guardian.isDeleted) {
      throw new Error(GUARDIAN_ERRORS.NOT_FOUND)
    }
    const activeLinks = await ctx.db
      .query('studentGuardians')
      .withIndex('by_guardian_id', (q) => q.eq('guardianId', guardianId))
      .filter((q) => q.eq(q.field('isDeleted'), false))
      .take(1)
    if (activeLinks.length > 0) {
      throw new Error(GUARDIAN_ERRORS.IN_USE_BY_STUDENT)
      // NOTE: add IN_USE_BY_STUDENT to GUARDIAN_ERRORS in errors.ts
    }
    await ctx.db.patch(guardianId, { isDeleted: true })
  },
})
```

> **Note**: Add `IN_USE_BY_STUDENT: 'GUARDIAN_IN_USE_BY_STUDENT'` to `GUARDIAN_ERRORS` in Phase 1.

### 3.5 `getGuardian` query

```typescript
export const getGuardian = query({
  args: {
    requesterId: v.id('catechists'),
    guardianId: v.id('guardians'),
  },
  handler: async (ctx, { requesterId, guardianId }) => {
    await assertValidCatechist(ctx, requesterId)
    const guardian = await ctx.db.get(guardianId)
    if (!guardian || guardian.isDeleted) return null
    const contacts = await ctx.db
      .query('guardianContacts')
      .withIndex('by_guardian_id', (q) => q.eq('guardianId', guardianId))
      .collect()
    return { ...guardian, contacts: contacts.filter((c) => !c.isDeleted) }
  },
})
```

**Verification checklist**:

- [ ] `grep -n 'export const' convex/guardians.ts` returns createGuardian, updateGuardian, softDeleteGuardian, getGuardian
- [ ] TypeScript compiles: `npx tsc --noEmit`

---

## Phase 4: GuardianContact CRUD

**File**: `convex/guardians.ts` (same file, append)

### 4.1 `addGuardianContact` mutation

Copy pattern from `catechists.ts:183–209`. Key difference: `guardianContacts` has no `label` field.

```typescript
export const addGuardianContact = mutation({
  args: {
    requesterId: v.id('catechists'),
    guardianId: v.id('guardians'),
    contactType: v.union(
      v.literal('phone'),
      v.literal('email'),
      v.literal('zalo'),
      v.literal('other'),
    ),
    value: v.string(),
    isPrimary: v.boolean(),
    notes: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { requesterId, guardianId, contactType, value, isPrimary, notes },
  ) => {
    await assertAdminRole(ctx, requesterId)
    const guardian = await ctx.db.get(guardianId)
    if (!guardian || guardian.isDeleted)
      throw new Error(GUARDIAN_ERRORS.NOT_FOUND)
    if (contactType === 'phone') validatePhone(value)
    if (isPrimary)
      await clearPrimaryGuardianContacts(ctx, guardianId, contactType)
    return await ctx.db.insert('guardianContacts', {
      guardianId,
      contactType,
      value,
      isPrimary,
      notes,
      isDeleted: false,
    })
  },
})
```

### 4.2 `updateGuardianContact` mutation

Copy pattern from `catechists.ts:211–244`. Adapt for `guardianContacts` table (no `label` arg).

```typescript
export const updateGuardianContact = mutation({
  args: {
    requesterId: v.id('catechists'),
    contactId: v.id('guardianContacts'),
    contactType: v.union(
      v.literal('phone'),
      v.literal('email'),
      v.literal('zalo'),
      v.literal('other'),
    ),
    value: v.string(),
    isPrimary: v.boolean(),
    notes: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { requesterId, contactId, contactType, value, isPrimary, notes },
  ) => {
    await assertAdminRole(ctx, requesterId)
    const contact = await ctx.db.get(contactId)
    if (!contact || contact.isDeleted)
      throw new Error(GUARDIAN_ERRORS.CONTACT_NOT_FOUND)
    if (contactType === 'phone') validatePhone(value)
    if (isPrimary)
      await clearPrimaryGuardianContacts(
        ctx,
        contact.guardianId,
        contactType,
        contactId,
      )
    await ctx.db.patch(contactId, { contactType, value, isPrimary, notes })
  },
})
```

### 4.3 `deleteGuardianContact` mutation

Soft delete. Copy pattern from `catechists.ts:246–255`.

```typescript
export const deleteGuardianContact = mutation({
  args: {
    requesterId: v.id('catechists'),
    contactId: v.id('guardianContacts'),
  },
  handler: async (ctx, { requesterId, contactId }) => {
    await assertAdminRole(ctx, requesterId)
    const contact = await ctx.db.get(contactId)
    if (!contact || contact.isDeleted)
      throw new Error(GUARDIAN_ERRORS.CONTACT_NOT_FOUND)
    await ctx.db.patch(contactId, { isDeleted: true })
  },
})
```

**Verification checklist**:

- [ ] `grep -n 'export const' convex/guardians.ts` returns 7 exports (getGuardian, createGuardian, updateGuardian, softDeleteGuardian, addGuardianContact, updateGuardianContact, deleteGuardianContact)
- [ ] Phone rejection: invalid phone → throws `GUARDIAN_INVALID_PHONE`
- [ ] TypeScript compiles

---

## Phase 5: StudentGuardian Link Mutations

**File**: `convex/guardians.ts` (same file, append) OR `convex/studentGuardians.ts` (new file — choose based on size)

### 5.1 `linkGuardianToStudent` mutation

Guards: no duplicate active (studentId, guardianId); no duplicate active contactPriority for this student.

```typescript
export const linkGuardianToStudent = mutation({
  args: {
    requesterId: v.id('catechists'),
    studentId: v.id('students'),
    guardianId: v.id('guardians'),
    relationship: v.string(),
    contactPriority: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (
    ctx,
    {
      requesterId,
      studentId,
      guardianId,
      relationship,
      contactPriority,
      notes,
    },
  ) => {
    await assertAdminRole(ctx, requesterId)
    // Guard: guardian exists
    const guardian = await ctx.db.get(guardianId)
    if (!guardian || guardian.isDeleted)
      throw new Error(GUARDIAN_ERRORS.NOT_FOUND)
    // Guard: no duplicate link
    const existingLink = await ctx.db
      .query('studentGuardians')
      .withIndex('by_student_id_and_guardian_id', (q) =>
        q.eq('studentId', studentId).eq('guardianId', guardianId),
      )
      .filter((q) => q.eq(q.field('isDeleted'), false))
      .unique()
    if (existingLink) throw new Error(GUARDIAN_ERRORS.DUPLICATE_LINK)
    // Guard: no duplicate priority for this student
    const priorityConflict = await ctx.db
      .query('studentGuardians')
      .withIndex('by_student_id_and_contact_priority', (q) =>
        q.eq('studentId', studentId).eq('contactPriority', contactPriority),
      )
      .filter((q) => q.eq(q.field('isDeleted'), false))
      .unique()
    if (priorityConflict) throw new Error(GUARDIAN_ERRORS.DUPLICATE_PRIORITY)

    return await ctx.db.insert('studentGuardians', {
      studentId,
      guardianId,
      relationship,
      contactPriority,
      notes,
      isDeleted: false,
    })
  },
})
```

### 5.2 `updateStudentGuardianLink` mutation

Update relationship, contactPriority, notes on a `studentGuardians` row.

```typescript
export const updateStudentGuardianLink = mutation({
  args: {
    requesterId: v.id('catechists'),
    linkId: v.id('studentGuardians'),
    relationship: v.string(),
    contactPriority: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { requesterId, linkId, relationship, contactPriority, notes },
  ) => {
    await assertAdminRole(ctx, requesterId)
    const link = await ctx.db.get(linkId)
    if (!link || link.isDeleted) throw new Error(GUARDIAN_ERRORS.LINK_NOT_FOUND)
    // Guard: no other active link for same student has same priority
    const priorityConflict = await ctx.db
      .query('studentGuardians')
      .withIndex('by_student_id_and_contact_priority', (q) =>
        q
          .eq('studentId', link.studentId)
          .eq('contactPriority', contactPriority),
      )
      .filter((q) => q.eq(q.field('isDeleted'), false))
      .unique()
    if (priorityConflict && priorityConflict._id !== linkId) {
      throw new Error(GUARDIAN_ERRORS.DUPLICATE_PRIORITY)
    }
    await ctx.db.patch(linkId, { relationship, contactPriority, notes })
  },
})
```

### 5.3 `unlinkGuardianFromStudent` mutation

Soft-delete the `studentGuardians` row.

```typescript
export const unlinkGuardianFromStudent = mutation({
  args: {
    requesterId: v.id('catechists'),
    linkId: v.id('studentGuardians'),
  },
  handler: async (ctx, { requesterId, linkId }) => {
    await assertAdminRole(ctx, requesterId)
    const link = await ctx.db.get(linkId)
    if (!link || link.isDeleted) throw new Error(GUARDIAN_ERRORS.LINK_NOT_FOUND)
    await ctx.db.patch(linkId, { isDeleted: true })
  },
})
```

### 5.4 `getStudentGuardians` query

Return all active guardian links for a student, each with the guardian record and their active contacts.

```typescript
export const getStudentGuardians = query({
  args: {
    requesterId: v.id('catechists'),
    studentId: v.id('students'),
  },
  handler: async (ctx, { requesterId, studentId }) => {
    await assertValidCatechist(ctx, requesterId)
    const links = await ctx.db
      .query('studentGuardians')
      .withIndex('by_student_id', (q) => q.eq('studentId', studentId))
      .filter((q) => q.eq(q.field('isDeleted'), false))
      .collect()
    return await Promise.all(
      links.map(async (link) => {
        const guardian = await ctx.db.get(link.guardianId)
        const contacts = guardian
          ? (
              await ctx.db
                .query('guardianContacts')
                .withIndex('by_guardian_id', (q) =>
                  q.eq('guardianId', link.guardianId),
                )
                .collect()
            ).filter((c) => !c.isDeleted)
          : []
        return { ...link, guardian, contacts }
      }),
    )
  },
})
```

**Verification checklist**:

- [ ] `grep -n 'export const' convex/guardians.ts` returns 11 exports (including 3 link mutations + getStudentGuardians)
- [ ] TypeScript compiles

---

## Phase 6: Enhance `students.get` to include address + guardians

**File**: `convex/students.ts`

Update the `get` query handler to also fetch and return:

- `address`: the active `studentAddresses` row (or null)
- `guardians`: result of `getStudentGuardians` inline logic (array of link+guardian+contacts)

```typescript
export const get = query({
  args: {
    requesterId: v.id('catechists'),
    studentId: v.id('students'),
  },
  handler: async (ctx, { requesterId, studentId }) => {
    await assertValidCatechist(ctx, requesterId)
    const student = await ctx.db.get(studentId)
    if (!student || student.isDeleted) return null

    const address = await ctx.db
      .query('studentAddresses')
      .withIndex('by_student_id', (q) => q.eq('studentId', studentId))
      .unique()

    const links = await ctx.db
      .query('studentGuardians')
      .withIndex('by_student_id', (q) => q.eq('studentId', studentId))
      .filter((q) => q.eq(q.field('isDeleted'), false))
      .collect()

    const guardians = await Promise.all(
      links.map(async (link) => {
        const guardian = await ctx.db.get(link.guardianId)
        const contacts = guardian
          ? (
              await ctx.db
                .query('guardianContacts')
                .withIndex('by_guardian_id', (q) =>
                  q.eq('guardianId', link.guardianId),
                )
                .collect()
            ).filter((c) => !c.isDeleted)
          : []
        return { ...link, guardian, contacts }
      }),
    )

    return {
      ...student,
      address: address?.isDeleted ? null : (address ?? null),
      guardians,
    }
  },
})
```

**Verification checklist**:

- [ ] Existing `students.test.ts` get tests still pass (null for deleted/missing student)
- [ ] `get` for existing student now includes `address: null` and `guardians: []` in returned shape
- [ ] TypeScript compiles

---

## Phase 7: Tests

**Delegate to `unit-test-writer` agent** with these instructions:

### Test file structure

- StudentAddress tests → append to `convex/students.test.ts`
- Guardian/GuardianContact/StudentGuardian tests → new file `convex/guardians.test.ts`

Both files must start with:

```typescript
/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'

const modules = import.meta.glob('./**/*.ts')
```

### Required test scenarios

**StudentAddress** (copy structure from `catechists.test.ts:46-90`):

1. `getStudentAddress` returns null when no address
2. `upsertStudentAddress` creates address — verify all fields
3. `upsertStudentAddress` again — verifies update (same studentId → patch)
4. `softDeleteStudentAddress` sets `isDeleted: true` (verify via `t.run()`)
5. `softDeleteStudentAddress` on already-deleted/missing → throws `STUDENT_ADDRESS_NOT_FOUND`
6. Non-admin calling `upsertStudentAddress` → throws `'Unauthorized'`

**Guardian CRUD**: 7. `createGuardian` inserts guardian, returns id 8. `updateGuardian` patches fullName/saintName/notes 9. `updateGuardian` on deleted guardian → throws `GUARDIAN_NOT_FOUND` 10. `softDeleteGuardian` with active link → throws `GUARDIAN_IN_USE_BY_STUDENT` 11. `softDeleteGuardian` after unlinking → sets `isDeleted: true` 12. Non-admin → throws `'Unauthorized'`

**GuardianContact CRUD** (copy structure from `catechists.test.ts:92-233`): 13. `addGuardianContact` phone (valid E.164) — verify fields 14. `addGuardianContact` invalid phone (e.g. `'0912345678'`) → throws `GUARDIAN_INVALID_PHONE` 15. `addGuardianContact` email — no E.164 check 16. `addGuardianContact` isPrimary:true twice same type → first cleared 17. `updateGuardianContact` patches value/isPrimary 18. `deleteGuardianContact` sets `isDeleted: true` via `t.run()` check 19. `deleteGuardianContact` on missing/deleted → throws `GUARDIAN_CONTACT_NOT_FOUND`

**StudentGuardian links**: 20. `linkGuardianToStudent` — verify link fields 21. Duplicate `linkGuardianToStudent` same (studentId, guardianId) → throws `GUARDIAN_DUPLICATE_LINK` 22. Duplicate contactPriority for same student → throws `GUARDIAN_DUPLICATE_PRIORITY` 23. `updateStudentGuardianLink` patches relationship/priority 24. Priority conflict on update → throws `GUARDIAN_DUPLICATE_PRIORITY` 25. `unlinkGuardianFromStudent` sets `isDeleted: true` 26. `unlinkGuardianFromStudent` on already-deleted → throws `GUARDIAN_LINK_NOT_FOUND` 27. `getStudentGuardians` returns links with nested guardian + contacts

**students.get enhanced shape**: 28. `get` returns `{ ...student, address: null, guardians: [] }` before any address/guardian mutations 29. `get` returns `address` after `upsertStudentAddress` 30. `get` returns `guardians` array after `linkGuardianToStudent`

### Coverage target

`npm test -- --coverage` must report **≥ 85%** on all four metrics (statements, branches, functions, lines) for `convex/students.ts` and `convex/guardians.ts`.

---

## Phase 8: Code Review

**Delegate to `ts-react-reviewer` agent** on the diff of:

- `convex/lib/errors.ts`
- `convex/students.ts`
- `convex/guardians.ts`
- `convex/students.test.ts`
- `convex/guardians.test.ts`

Review checklist:

- [ ] All mutations have `args` validators (no missing validators)
- [ ] No hard deletes (`ctx.db.delete`) — only soft deletes via `ctx.db.patch({ isDeleted: true })`
- [ ] Auth present on every mutation (`assertAdminRole`)
- [ ] E.164 validated on phone contacts
- [ ] No `.collect()` on unbounded tables (only bounded guardian/address child queries)
- [ ] Index usage on all queries (no `.filter()` as primary filter on large tables)
- [ ] Error codes use constants from `errors.ts`, not inline strings
- [ ] `clearPrimaryGuardianContacts` correctly excludes `excludeId` during update
- [ ] `softDeleteGuardian` guard checks active links before deleting
- [ ] `linkGuardianToStudent` checks both duplicate link AND duplicate priority

---

## Implementation Order

```
Phase 1 (errors.ts)          — 5 min
Phase 2 (student address)    — 20 min
Phase 3 (guardian CRUD)      — 20 min
Phase 4 (guardian contacts)  — 20 min
Phase 5 (link mutations)     — 25 min
Phase 6 (enhance students.get) — 15 min
Phase 7 (tests)              — delegate to unit-test-writer
Phase 8 (review)             — delegate to ts-react-reviewer
```

## Files to Create/Modify

| File                       | Action                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| `convex/lib/errors.ts`     | Add `STUDENT_ERRORS.ADDRESS_NOT_FOUND` + full `GUARDIAN_ERRORS` block                      |
| `convex/students.ts`       | Add `getStudentAddress`, `upsertStudentAddress`, `softDeleteStudentAddress`; enhance `get` |
| `convex/guardians.ts`      | NEW — all guardian + guardian contact + link mutations                                     |
| `convex/students.test.ts`  | Add address test scenarios (30-scenario coverage)                                          |
| `convex/guardians.test.ts` | NEW — guardian/contact/link tests                                                          |
