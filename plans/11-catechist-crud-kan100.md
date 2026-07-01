# KAN-100 — Enhance Catechist CRUD Backend (Addresses + Contacts)

**Ticket**: KAN-100  
**Scope**: Convex backend only — `convex/catechists.ts`, `convex/lib/errors.ts`, `convex/catechists.test.ts`

---

## Phase 0 — Discovery Summary

### Current state of `convex/catechists.ts`

| Function          | Type     | Issue                                                                   |
| ----------------- | -------- | ----------------------------------------------------------------------- |
| `getMyProfile`    | query    | OK                                                                      |
| `getMyAddress`    | query    | **Bug**: no `isDeleted` filter — returns soft-deleted address           |
| `getMyContacts`   | query    | **Bug**: no `isDeleted` filter — returns soft-deleted contacts          |
| `updateMyProfile` | mutation | OK                                                                      |
| `upsertMyAddress` | mutation | OK                                                                      |
| `addContact`      | mutation | **Missing**: no E.164 validation, no `isPrimary` uniqueness enforcement |
| `updateContact`   | mutation | **Missing**: no E.164 validation, no `isPrimary` uniqueness enforcement |
| `deleteContact`   | mutation | **Bug**: uses `ctx.db.delete` (hard delete) — must be soft delete       |

### Missing functions (needed for admin CRUD)

- `list` — list all non-deleted catechists
- `get` — get single catechist (profile + address + contacts) by id
- `create` — create catechist with auto-generated `memberId` via `nextCounter`
- `update` — admin update (role, isActive, profile fields)
- `softDelete` — soft-delete catechist
- `softDeleteAddress` — soft-delete a catechist's address

### Key patterns from codebase

- Auth: `assertAdminRole(ctx, requesterId)` / `assertValidCatechist(ctx, requesterId)` from `./lib/authz`
- Errors: stable string constants in `convex/lib/errors.ts` — e.g. `BRANCH_ERRORS.NOT_FOUND`
- memberId generation: `nextCounter(ctx, 'catechist')` from `./lib/counter` → `.toString()`
- Soft delete: `ctx.db.patch(table, id, { isDeleted: true })` — never `ctx.db.delete`
- Index queries: always `.withIndex(...)` — never `.filter()` on indexed fields
- E.164 regex: `/^\+[1-9]\d{6,14}$/` (no extra npm dep needed in Convex runtime)

### Reference files

- Pattern to copy: `convex/branches.ts` — `list`, `get`, `create`, `update`, `softDelete`
- Auth utilities: `convex/lib/authz.ts`
- Error constants: `convex/lib/errors.ts`
- Counter: `convex/lib/counter.ts`
- Schema: `convex/schema.ts` lines 95–151 (catechists, catechistAddresses, catechistContacts)
- Existing tests: `convex/catechists.test.ts`

---

## Phase 1 — Error Constants

**File**: `convex/lib/errors.ts`

Add `CATECHIST_ERRORS` constant block:

```typescript
export const CATECHIST_ERRORS = {
  NOT_FOUND: 'CATECHIST_NOT_FOUND',
  DUPLICATE_MEMBER_ID: 'CATECHIST_DUPLICATE_MEMBER_ID',
  CONTACT_NOT_FOUND: 'CATECHIST_CONTACT_NOT_FOUND',
  ADDRESS_NOT_FOUND: 'CATECHIST_ADDRESS_NOT_FOUND',
  INVALID_PHONE: 'CATECHIST_INVALID_PHONE',
} as const
```

**Verification**: `grep -n "CATECHIST_ERRORS" convex/lib/errors.ts` returns the block.

---

## Phase 2 — Fix Existing Functions

**File**: `convex/catechists.ts`

### 2a. Fix `getMyAddress` — add `isDeleted` filter

Current:

```typescript
.withIndex('by_catechist_id', (q) => q.eq('catechistId', args.catechistId))
.unique()
```

Fix — use `.filter()` post-index to exclude deleted:

```typescript
.withIndex('by_catechist_id', (q) => q.eq('catechistId', args.catechistId))
.filter((q) => q.eq(q.field('isDeleted'), false))
.unique()
```

### 2b. Fix `getMyContacts` — add `isDeleted` filter

Add after `.withIndex(...)`:

```typescript
.filter((q) => q.eq(q.field('isDeleted'), false))
```

### 2c. Fix `deleteContact` — soft delete instead of hard delete

Current:

```typescript
await ctx.db.delete('catechistContacts', args.contactId)
```

Fix:

```typescript
const contact = await ctx.db.get('catechistContacts', args.contactId)
if (!contact || contact.isDeleted) {
  throw new Error(CATECHIST_ERRORS.CONTACT_NOT_FOUND)
}
await ctx.db.patch('catechistContacts', args.contactId, { isDeleted: true })
```

**Verification**:

- Existing test at `catechists.test.ts:137` calls `deleteContact` then expects `postDeleteContacts` length 0. This still passes because `getMyContacts` now filters `isDeleted: false`.
- Run `npm test convex/catechists.test.ts` — all 3 existing tests pass.

---

## Phase 3 — E.164 Validation + isPrimary Enforcement

**File**: `convex/catechists.ts`

### 3a. Add phone validation helper (file-top, not exported)

```typescript
const E164_REGEX = /^\+[1-9]\d{6,14}$/

function validatePhone(value: string): void {
  if (!E164_REGEX.test(value)) {
    throw new Error(CATECHIST_ERRORS.INVALID_PHONE)
  }
}
```

### 3b. Add `isPrimary` enforcement helper

When a contact is added or updated with `isPrimary: true`, unset any existing primary of the same `contactType` for the same catechist:

```typescript
async function clearPrimaryContacts(
  ctx: MutationCtx,
  catechistId: Id<'catechists'>,
  contactType: string,
  excludeId?: Id<'catechistContacts'>,
): Promise<void> {
  const existing = await ctx.db
    .query('catechistContacts')
    .withIndex('by_catechist_id', (q) => q.eq('catechistId', catechistId))
    .filter((q) => q.eq(q.field('isDeleted'), false))
    .collect()

  for (const c of existing) {
    if (c.contactType === contactType && c.isPrimary && c._id !== excludeId) {
      await ctx.db.patch('catechistContacts', c._id, { isPrimary: false })
    }
  }
}
```

### 3c. Update `addContact` — validate + enforce isPrimary

In `addContact` handler, before insert:

1. If `contactType === 'phone'`, call `validatePhone(args.value)`
2. If `isPrimary === true`, call `await clearPrimaryContacts(ctx, args.catechistId, args.contactType)`

### 3d. Update `updateContact` — validate + enforce isPrimary

In `updateContact` handler:

1. Fetch contact; throw `CATECHIST_ERRORS.CONTACT_NOT_FOUND` if not found/deleted
2. Determine effective `catechistId` from the fetched contact
3. If `contactType === 'phone'`, call `validatePhone(args.value)`
4. If `isPrimary === true`, call `await clearPrimaryContacts(ctx, contact.catechistId, args.contactType, args.contactId)`

**Verification**:

- `npm test convex/catechists.test.ts` — all existing tests pass (E.164 values in existing tests are already valid).

---

## Phase 4 — Admin CRUD Functions

**File**: `convex/catechists.ts`

Copy the `list/get/create/update/softDelete` pattern from `convex/branches.ts`.

### 4a. `list` query

```typescript
export const list = query({
  args: { requesterId: v.id('catechists') },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)
    const catechists = await ctx.db
      .query('catechists')
      .withIndex('by_is_deleted', (q) => q.eq('isDeleted', false))
      .collect()
    return catechists
  },
})
```

### 4b. `get` query

Returns catechist profile + address + contacts in one call:

```typescript
export const get = query({
  args: { requesterId: v.id('catechists'), catechistId: v.id('catechists') },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)
    const catechist = await ctx.db.get('catechists', args.catechistId)
    if (!catechist || catechist.isDeleted) return null

    const address = await ctx.db
      .query('catechistAddresses')
      .withIndex('by_catechist_id', (q) =>
        q.eq('catechistId', args.catechistId),
      )
      .filter((q) => q.eq(q.field('isDeleted'), false))
      .unique()

    const contacts = await ctx.db
      .query('catechistContacts')
      .withIndex('by_catechist_id', (q) =>
        q.eq('catechistId', args.catechistId),
      )
      .filter((q) => q.eq(q.field('isDeleted'), false))
      .collect()

    return { ...catechist, address, contacts }
  },
})
```

### 4c. `create` mutation

Admin-only. Generates `memberId` via `nextCounter`:

```typescript
export const create = mutation({
  args: {
    requesterId: v.id('catechists'),
    fullName: v.string(),
    saintName: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    gender: v.optional(
      v.union(v.literal('male'), v.literal('female'), v.literal('other')),
    ),
    role: v.union(v.literal('admin'), v.literal('user')),
    joinedDate: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx, args.requesterId)
    const memberIdNum = await nextCounter(ctx, 'catechist')
    const memberId = memberIdNum.toString()
    const { requesterId, ...fields } = args
    return await ctx.db.insert('catechists', {
      ...fields,
      memberId,
      isActive: true,
      isDeleted: false,
    })
  },
})
```

### 4d. `update` mutation

Admin-only. Updates profile fields + role + isActive:

```typescript
export const update = mutation({
  args: {
    requesterId: v.id('catechists'),
    catechistId: v.id('catechists'),
    fullName: v.optional(v.string()),
    saintName: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    gender: v.optional(
      v.union(v.literal('male'), v.literal('female'), v.literal('other')),
    ),
    role: v.optional(v.union(v.literal('admin'), v.literal('user'))),
    isActive: v.optional(v.boolean()),
    joinedDate: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx, args.requesterId)
    const catechist = await ctx.db.get('catechists', args.catechistId)
    if (!catechist || catechist.isDeleted) {
      throw new Error(CATECHIST_ERRORS.NOT_FOUND)
    }
    const { requesterId, catechistId, ...fields } = args
    await ctx.db.patch('catechists', catechistId, fields)
  },
})
```

### 4e. `softDelete` mutation

Admin-only:

```typescript
export const softDelete = mutation({
  args: {
    requesterId: v.id('catechists'),
    catechistId: v.id('catechists'),
  },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx, args.requesterId)
    const catechist = await ctx.db.get('catechists', args.catechistId)
    if (!catechist || catechist.isDeleted) {
      throw new Error(CATECHIST_ERRORS.NOT_FOUND)
    }
    await ctx.db.patch('catechists', args.catechistId, { isDeleted: true })
  },
})
```

### 4f. `softDeleteAddress` mutation

```typescript
export const softDeleteAddress = mutation({
  args: {
    requesterId: v.id('catechists'),
    catechistId: v.id('catechists'),
  },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx, args.requesterId)
    const address = await ctx.db
      .query('catechistAddresses')
      .withIndex('by_catechist_id', (q) =>
        q.eq('catechistId', args.catechistId),
      )
      .filter((q) => q.eq(q.field('isDeleted'), false))
      .unique()
    if (!address) {
      throw new Error(CATECHIST_ERRORS.ADDRESS_NOT_FOUND)
    }
    await ctx.db.patch('catechistAddresses', address._id, { isDeleted: true })
  },
})
```

**Verification**:

- `grep -n "export const" convex/catechists.ts` lists all 13 functions.
- `npm run typecheck` passes.

---

## Phase 5 — Update Tests

**File**: `convex/catechists.test.ts`

### 5a. Update existing `deleteContact` test

The test at line 137 calls `deleteContact` and then expects `getMyContacts` to return length 0.  
After Phase 2c fix, soft delete + `isDeleted` filter means this still works — **no change needed** to that assertion.

Add additional assertion to verify soft-delete semantics (contact still exists in DB but filtered):

```typescript
// verify contact is soft-deleted, not hard-deleted
const rawContact = await t.run(async (ctx) =>
  ctx.db.get('catechistContacts', contactId),
)
expect(rawContact?.isDeleted).toBe(true)
```

### 5b. Add E.164 validation tests

```typescript
test('addContact rejects invalid phone E.164', async () => {
  const t = convexTest(schema, modules)
  // ... setup catechistId ...
  await expect(
    t.mutation(api.catechists.addContact, {
      catechistId,
      label: 'Bad Phone',
      contactType: 'phone',
      value: '0912345678', // missing country code prefix
      isPrimary: false,
    }),
  ).rejects.toThrow('CATECHIST_INVALID_PHONE')
})

test('addContact allows non-phone without E.164', async () => {
  // email contactType with an email value should succeed
})
```

### 5c. Add isPrimary uniqueness tests

```typescript
test('addContact clears previous primary of same type', async () => {
  // Add phone contact1 isPrimary:true
  // Add phone contact2 isPrimary:true
  // Expect contact1.isPrimary === false
  // Expect contact2.isPrimary === true
})
```

### 5d. Add admin CRUD tests

```typescript
describe('admin CRUD', () => {
  test('create generates memberId and returns id', ...)
  test('list returns only non-deleted catechists', ...)
  test('get returns profile + address + contacts', ...)
  test('update patches fields', ...)
  test('softDelete sets isDeleted true', ...)
  test('softDeleteAddress sets isDeleted true', ...)
  test('non-admin cannot create/update/softDelete', ...)
})
```

**Coverage target**: All four metrics ≥ 85% (`npm test -- --coverage`).

---

## Phase 6 — Final Verification

```bash
# Type check
npm run typecheck

# All tests pass + coverage ≥ 85%
npm test -- --coverage

# Grep confirm soft-delete (no hard-delete) in catechists.ts
grep -n "ctx.db.delete" convex/catechists.ts   # must return 0 results

# Grep confirm all exports present
grep -n "^export const" convex/catechists.ts
# Expected: getMyProfile, getMyAddress, getMyContacts,
#           updateMyProfile, upsertMyAddress,
#           addContact, updateContact, deleteContact,
#           list, get, create, update, softDelete, softDeleteAddress
```

---

## Anti-patterns to Avoid

- **Never** `ctx.db.delete` — always `ctx.db.patch(..., { isDeleted: true })`
- **Never** `.filter()` on an indexed field as primary filter — always `.withIndex()` first, then `.filter()` for secondary conditions
- **Never** invent Convex API methods — use only `ctx.db.get`, `ctx.db.insert`, `ctx.db.patch`, `ctx.db.query().withIndex().collect()/.unique()/.first()`
- **No** computed values stored (weighted_average, diligence_score)
- `ctx.db.get(table, id)` — two args, not one object

---

## File Change Summary

| File                        | Change                                                                              |
| --------------------------- | ----------------------------------------------------------------------------------- |
| `convex/lib/errors.ts`      | Add `CATECHIST_ERRORS` block                                                        |
| `convex/catechists.ts`      | Fix 3 bugs + add E.164 helper + add isPrimary helper + add 6 new exported functions |
| `convex/catechists.test.ts` | Update 1 existing test + add ~8 new test cases                                      |
