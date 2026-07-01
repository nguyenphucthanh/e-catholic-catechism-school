# KAN-83: Student CRUD Backend (Convex)

**Ticket**: Implement Student CRUD backend — queries/mutations for list, get, create, update, soft-delete with `studentCode` auto-generation via counters table.

**Scope**: `students` table only. Guardian/address/sacrament/class operations are separate tickets.

---

## Phase 0: Documentation Discovery (Completed)

### Allowed APIs & Patterns

**Counter auto-generation** (`convex/lib/counter.ts`):

```ts
import { nextCounter } from './lib/counter'
const seq = await nextCounter(ctx, 'student')
const studentCode = String(seq) // no zero-padding, matches catechist precedent
```

**CRUD pattern** — copy from `convex/branches.ts`:

- `list`: `assertValidCatechist` + paginated query
- `get`: `assertValidCatechist` + `ctx.db.get()` + isDeleted check
- `create`: `assertAdminRole` + nextCounter for studentCode + insert
- `update`: `assertAdminRole` + not-found check + `ctx.db.patch()`
- `softDelete`: `assertAdminRole` + referential integrity check + patch `{ isDeleted: true }`

**Auth** (`convex/lib/authz.ts`):

- `assertValidCatechist(ctx, requesterId)` — any active catechist
- `assertAdminRole(ctx, requesterId)` — admin only

**Error constants** (`convex/lib/errors.ts`): add `STUDENT_ERRORS` alongside existing constants.

**Guidelines key rules**:

- Use `withIndex` not query `.filter()` for DB-level filtering
- Use `paginationOptsValidator` + `.paginate()` for list (students can be large)
- Always include argument validators on public functions
- Use `.unique()` for single-doc index lookups

**Schema** (`convex/schema.ts` lines 238–254):

```
students: { studentCode, fullName, saintName?, dateOfBirth?, gender?, previousParish?, previousDiocese?, isActive, createdAt, isDeleted }
indexes: by_student_code, by_is_active, by_is_deleted
```

**Soft-delete guard**: check `studentClasses` for active enrollments before soft-deleting a student.

### Anti-Patterns to Avoid

- Do NOT use Convex `.filter()` in queries — filter `isDeleted` in JS after `.collect()` / post-paginate
- Do NOT hard-delete any record
- Do NOT store `studentCode` as padded/formatted string — plain `String(counter)` only
- Do NOT skip argument validators on public functions
- Do NOT use `ctx.db.filter()` — only `withIndex`

---

## Phase 1: Add STUDENT_ERRORS Constants

**File**: `convex/lib/errors.ts`

**Task**: Add `STUDENT_ERRORS` export after existing constants. Copy the structure of `BRANCH_ERRORS`.

```ts
export const STUDENT_ERRORS = {
  NOT_FOUND: 'STUDENT_NOT_FOUND',
  IN_USE_BY_ENROLLMENT: 'STUDENT_IN_USE_BY_ENROLLMENT',
} as const
```

**Verification**:

- `grep -n 'STUDENT_ERRORS' convex/lib/errors.ts` returns the block
- `npx tsc --noEmit` passes

---

## Phase 2: Create `convex/students.ts`

**File**: `convex/students.ts` (new file)

**Imports needed**:

```ts
import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { assertAdminRole, assertValidCatechist } from './lib/authz'
import { nextCounter } from './lib/counter'
import { STUDENT_ERRORS } from './lib/errors'
```

### 2a. `list` query (paginated)

```ts
export const list = query({
  args: {
    requesterId: v.id('catechists'),
    paginationOpts: paginationOptsValidator,
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)

    let dbQuery = ctx.db
      .query('students')
      .withIndex('by_is_deleted', (q) => q.eq('isDeleted', false))

    const page = await dbQuery.order('desc').paginate(args.paginationOpts)

    const filtered =
      args.isActive !== undefined
        ? {
            ...page,
            page: page.page.filter((s) => s.isActive === args.isActive),
          }
        : page

    return filtered
  },
})
```

### 2b. `get` query

```ts
export const get = query({
  args: { requesterId: v.id('catechists'), id: v.id('students') },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)
    const student = await ctx.db.get('students', args.id)
    if (!student || student.isDeleted) return null
    return student
  },
})
```

### 2c. `create` mutation

```ts
export const create = mutation({
  args: {
    requesterId: v.id('catechists'),
    fullName: v.string(),
    saintName: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()), // ISO: YYYY-MM-DD
    gender: v.optional(
      v.union(v.literal('male'), v.literal('female'), v.literal('other')),
    ),
    previousParish: v.optional(v.string()),
    previousDiocese: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx, args.requesterId)

    const seq = await nextCounter(ctx, 'student')
    const studentCode = String(seq)

    const { requesterId, ...fields } = args
    return await ctx.db.insert('students', {
      ...fields,
      studentCode,
      isActive: true,
      isDeleted: false,
      createdAt: Date.now(),
    })
  },
})
```

### 2d. `update` mutation

```ts
export const update = mutation({
  args: {
    requesterId: v.id('catechists'),
    studentId: v.id('students'),
    fullName: v.optional(v.string()),
    saintName: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    gender: v.optional(
      v.union(v.literal('male'), v.literal('female'), v.literal('other')),
    ),
    previousParish: v.optional(v.string()),
    previousDiocese: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx, args.requesterId)

    const student = await ctx.db.get('students', args.studentId)
    if (!student || student.isDeleted) {
      throw new Error(STUDENT_ERRORS.NOT_FOUND)
    }

    const { requesterId, studentId, ...fields } = args
    await ctx.db.patch('students', studentId, fields)
  },
})
```

### 2e. `softDelete` mutation

```ts
export const softDelete = mutation({
  args: {
    requesterId: v.id('catechists'),
    studentId: v.id('students'),
  },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx, args.requesterId)

    const student = await ctx.db.get('students', args.studentId)
    if (!student || student.isDeleted) {
      throw new Error(STUDENT_ERRORS.NOT_FOUND)
    }

    // Guard: cannot delete student enrolled in active classes
    const enrollments = await ctx.db
      .query('studentClasses')
      .withIndex('by_student_id', (q) => q.eq('studentId', args.studentId))
      .collect()

    if (enrollments.some((e) => !e.isDeleted && e.status === 'active')) {
      throw new Error(STUDENT_ERRORS.IN_USE_BY_ENROLLMENT)
    }

    await ctx.db.patch('students', args.studentId, { isDeleted: true })
  },
})
```

**Verification**:

- `npx tsc --noEmit` passes
- `grep -n 'export const' convex/students.ts` shows: list, get, create, update, softDelete
- No `ctx.db.delete()` calls in the file
- No `ctx.db.filter()` calls in the file

---

## Phase 3: Tests in `convex/students.test.ts`

**File**: `convex/students.test.ts` (new file)

**Reference test pattern**: copy setup from `convex/catechists.test.ts` (module glob, `convexTest()`, `api.students.*`).

**Test cases to cover**:

### list

- Returns paginated students (isDeleted=false) for valid catechist
- Filters by `isActive` when provided
- Does NOT return soft-deleted students
- Throws when requesterId is invalid/deleted catechist

### get

- Returns student for valid id
- Returns null for non-existent id
- Returns null for soft-deleted student
- Throws for invalid requesterId

### create

- Creates student with auto-generated `studentCode = "1"` for first student
- Sequential creates produce `studentCode = "1"`, `"2"`, `"3"`
- Sets `isActive: true`, `isDeleted: false`, `createdAt` (timestamp)
- Throws when requesterId is non-admin catechist
- Throws when requesterId is invalid

### update

- Updates specified fields only (partial update)
- Throws `STUDENT_NOT_FOUND` for non-existent student
- Throws `STUDENT_NOT_FOUND` for soft-deleted student
- Throws for non-admin requester

### softDelete

- Sets `isDeleted: true`
- Throws `STUDENT_NOT_FOUND` for non-existent student
- Throws `STUDENT_IN_USE_BY_ENROLLMENT` when student has active class enrollment
- Allows soft-delete when all enrollments are withdrawn/on_leave or also soft-deleted
- Throws for non-admin requester

**Verification**:

- `npm test -- --coverage convex/students.test.ts` passes
- All four coverage metrics ≥ 85%: statements, branches, functions, lines

---

## Phase 4: Final Verification

Run in sequence:

```bash
# 1. Type check
npx tsc --noEmit

# 2. Full test suite with coverage
npm test -- --coverage

# 3. Spot checks
grep -n 'ctx.db.delete' convex/students.ts        # must return nothing
grep -n 'ctx.db.filter' convex/students.ts         # must return nothing
grep -n 'export const' convex/students.ts           # must show 5 exports
grep -n 'STUDENT_ERRORS' convex/lib/errors.ts      # must show the block
```

**Pass criteria**:

- Zero TypeScript errors
- All 4 coverage metrics ≥ 85%
- No hard-deletes in students.ts
- No DB-level `.filter()` calls
- 5 exported functions present
