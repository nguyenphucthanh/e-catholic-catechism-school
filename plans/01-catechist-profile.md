# Plan: Catechist Profile Page

Catechist can view and edit their own personal data: basic info, address, and contact methods.

---

## Allowed APIs (verified from codebase)

- **Router:** `createFileRoute('/_authenticated/profile')` — matches pattern in `src/routes/_authenticated/dashboard.tsx`
- **Form:** `useForm` from `@tanstack/react-form` — matches `src/routes/login.tsx`
- **Convex client:** `useMutation`, `useQuery` from `convex/react`; `convexQuery` from `@convex-dev/react-query` + `useSuspenseQuery` from `@tanstack/react-query`
- **shadcn:** Base UI style — `render` prop, NOT `asChild`. Already installed: Card, Input, Label, Separator, Avatar, DropdownMenu, Sidebar components.
- **Auth:** `useAuth()` from `~/lib/auth` → `{ user: AuthUser }` where `AuthUser = { memberId, fullName, accountType, role }`

## Anti-Patterns

- Do NOT use `asChild` — this project uses Base UI shadcn (v4), which uses `render` prop
- Do NOT store `weighted_average` or `diligence_score`
- Do NOT use react-hook-form — project uses `@tanstack/react-form`
- Do NOT invent Convex APIs — follow guidelines in `convex/_generated/ai/guidelines.md`
- Catechist can only edit own profile — never another catechist's data

---

## Phase 0: Prerequisites — Auth Context Fix

**Problem:** `useAuth()` returns `memberId` (string) but Convex queries need `_id` (Convex Id). Profile queries must look up by `memberId`, which requires an extra query round-trip on every page load.

**Fix:** Extend `AuthUser` and the `login` mutation to also return the Convex doc `_id` as `userDocId`.

### Files to change

**`convex/auth.ts`** — add `userDocId` to both return branches:

```ts
// catechist branch:
return {
  accountType: 'catechist' as const,
  userDocId: catechistId, // add this
  memberId: catechist.memberId,
  fullName: catechist.fullName,
  role: catechist.role,
}
// student branch:
return {
  accountType: 'student' as const,
  userDocId: account.userRefId, // add this
  memberId: student.studentCode,
  fullName: student.fullName,
  role: null,
}
```

**`src/lib/auth.tsx`** — extend `AuthUser` type:

```ts
export type AuthUser = {
  userDocId: string // Convex _id string
  memberId: string
  fullName: string
  accountType: 'catechist' | 'student'
  role: string | null
}
```

### Verification

- `npx tsc --noEmit` passes
- `npx convex dev --once` passes

---

## Phase 1: Convex Backend — Profile Queries & Mutations

**File:** `convex/catechists.ts`

### Queries

```ts
// Get own full profile (personal fields only)
export const getMyProfile = query({
  args: { catechistId: v.id('catechists') },
  handler: async (ctx, { catechistId }) => {
    return ctx.db.get(catechistId)
  },
})
```

```ts
// Get own address (may be null if not yet created)
export const getMyAddress = query({
  args: { catechistId: v.id('catechists') },
  handler: async (ctx, { catechistId }) => {
    return ctx.db
      .query('catechistAddresses')
      .withIndex('by_catechist_id', (q) => q.eq('catechistId', catechistId))
      .unique()
  },
})
```

```ts
// Get own contacts list
export const getMyContacts = query({
  args: { catechistId: v.id('catechists') },
  handler: async (ctx, { catechistId }) => {
    return ctx.db
      .query('catechistContacts')
      .withIndex('by_catechist_id', (q) => q.eq('catechistId', catechistId))
      .collect()
  },
})
```

> Check `convex/schema.ts` for exact index names on `catechistAddresses` (`by_catechist_id`) and `catechistContacts` (`by_catechist_id`).

### Mutations

```ts
// Update personal info (non-role, non-active fields only)
export const updateMyProfile = mutation({
  args: {
    catechistId: v.id('catechists'),
    fullName: v.string(),
    saintName: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    gender: v.optional(
      v.union(v.literal('male'), v.literal('female'), v.literal('other')),
    ),
    joinedDate: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { catechistId, ...fields }) => {
    await ctx.db.patch(catechistId, fields)
  },
})
```

```ts
// Upsert address (create or update)
export const upsertMyAddress = mutation({
  args: {
    catechistId: v.id('catechists'),
    country: v.string(),
    addressLine1: v.optional(v.string()),
    addressLine2: v.optional(v.string()),
    city: v.optional(v.string()),
    stateProvince: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    hamlet: v.optional(v.string()),
    subHamlet: v.optional(v.string()),
  },
  handler: async (ctx, { catechistId, ...fields }) => {
    const existing = await ctx.db
      .query('catechistAddresses')
      .withIndex('by_catechist_id', (q) => q.eq('catechistId', catechistId))
      .unique()
    if (existing) {
      await ctx.db.patch(existing._id, fields)
    } else {
      await ctx.db.insert('catechistAddresses', { catechistId, ...fields })
    }
  },
})
```

```ts
// Add contact
export const addContact = mutation({
  args: {
    catechistId: v.id('catechists'),
    label: v.string(),
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
  handler: async (ctx, args) => {
    await ctx.db.insert('catechistContacts', args)
  },
})
```

```ts
// Update contact
export const updateContact = mutation({
  args: {
    contactId: v.id('catechistContacts'),
    label: v.string(),
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
  handler: async (ctx, { contactId, ...fields }) => {
    await ctx.db.patch(contactId, fields)
  },
})
```

```ts
// Delete contact
export const deleteContact = mutation({
  args: { contactId: v.id('catechistContacts') },
  handler: async (ctx, { contactId }) => {
    await ctx.db.delete(contactId)
  },
})
```

### Verification

- `npx convex dev --once` passes
- All indexes used in queries must exist in `schema.ts` — check before writing

---

## Phase 2: Profile Route — Personal Info Section

**File:** `src/routes/_authenticated/profile.tsx`
**URL:** `/profile`

### Page layout (shadcn Card sections)

```
<page>
  <h1>Hồ Sơ Cá Nhân</h1>

  <Card> ← Personal Info section
    <CardHeader>Thông tin cơ bản</CardHeader>
    <CardContent>
      <form> ← TanStack Form
        fullName (required)
        saintName (optional)
        dateOfBirth (optional, date input)
        gender (optional, select: Nam / Nữ / Khác)
        joinedDate (optional, date input)
        notes (optional, textarea)
        <Button type="submit">Lưu thay đổi</Button>
      </form>
    </CardContent>
  </Card>
</page>
```

### Zod schema

```ts
const personalInfoSchema = z.object({
  fullName: z.string().min(1, 'Vui lòng nhập họ tên'),
  saintName: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  joinedDate: z.string().optional(),
  notes: z.string().optional(),
})
```

### Data loading

```ts
// Get catechistId from auth context
const { user } = useAuth()
const catechistId = user.userDocId as Id<'catechists'>

// Load profile
const { data: profile } = useSuspenseQuery(
  convexQuery(api.catechists.getMyProfile, { catechistId }),
)
```

### Add profile link to sidebar

In `src/components/app-sidebar.tsx`, add to `navItems`:

```ts
{ title: 'Hồ sơ', url: '/profile', icon: UserCircle }
```

### Verification

- Route renders at `/profile`
- Form pre-fills with existing data
- Save calls `updateMyProfile` and shows success state
- `npx tsc --noEmit` passes

---

## Phase 3: Address Section

Add a second `<Card>` to `profile.tsx` below the personal info card.

### Zod schema

```ts
const addressSchema = z.object({
  country: z.string().min(1, 'Vui lòng chọn quốc gia'),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  stateProvince: z.string().optional(),
  postalCode: z.string().optional(),
  hamlet: z.string().optional(), // Giáo Họ
  subHamlet: z.string().optional(), // Giáo Xóm
})
```

### Data loading

```ts
const { data: address } = useSuspenseQuery(
  convexQuery(api.catechists.getMyAddress, { catechistId }),
)
// address may be null — form defaults to { country: 'VN' }
```

### Fields

| Field           | Label            | Notes                                     |
| --------------- | ---------------- | ----------------------------------------- |
| `country`       | Quốc gia         | Default `VN`. Dropdown: VN / US / AU / CA |
| `addressLine1`  | Địa chỉ          |                                           |
| `addressLine2`  | Địa chỉ (tiếp)   |                                           |
| `city`          | Thành phố / Tỉnh |                                           |
| `stateProvince` | Bang / Tỉnh      |                                           |
| `postalCode`    | Mã bưu chính     |                                           |
| `hamlet`        | Giáo Họ          | Show only when country = VN               |
| `subHamlet`     | Giáo Xóm         | Show only when country = VN               |

### Verification

- Form pre-fills when address exists
- Form submits empty defaults when no address yet (create path)
- VN-only fields hide when country ≠ VN

---

## Phase 4: Contacts Section

Add a third `<Card>` to `profile.tsx`. Contacts are a short list (rarely more than 3), so use a simple table (not full data-table) with inline add/edit/delete.

### Layout

```
<Card>
  <CardHeader>
    Thông tin liên hệ
    <Button size="sm">+ Thêm</Button>
  </CardHeader>
  <CardContent>
    <table>
      <thead>Loại | Nhãn | Giá trị | Chính | Ghi chú | Actions</thead>
      <tbody>
        {contacts.map(c => <ContactRow />)}
      </tbody>
    </table>
  </CardContent>
</Card>
```

### ContactRow

- Display mode: shows label, type badge, value, primary indicator, edit/delete buttons
- Edit mode: inline TanStack Form row (label, contactType select, value, isPrimary checkbox, notes)

### Add contact

- "Thêm" button shows an inline form row at bottom of table
- On save: calls `addContact` mutation
- On cancel: removes inline row

### Phone validation

```ts
// When contactType = 'phone', validate E.164 format
value: z.string().refine(
  (val) => contactType !== 'phone' || /^\+[1-9]\d{6,14}$/.test(val),
  'Số điện thoại phải theo định dạng E.164: +84901234567',
)
```

### Verification

- Can add contact → appears in list
- Can edit contact → values update
- Can delete contact → row disappears
- Phone E.164 validation fires on blur

---

## Phase 5: Final Verification

```bash
npx tsc --noEmit       # zero errors
npx convex dev --once  # zero errors
npm run lint           # zero warnings
```

Manual checks:

- [ ] `/profile` requires auth (redirects to `/login` if not logged in)
- [ ] Personal info form pre-fills, saves correctly
- [ ] Address form pre-fills (or shows blank for new), saves correctly
- [ ] VN-only fields toggle on country change
- [ ] Contact add/edit/delete all work
- [ ] Sidebar shows "Hồ sơ" link
- [ ] `role` and `isActive` fields are NOT editable on this page
