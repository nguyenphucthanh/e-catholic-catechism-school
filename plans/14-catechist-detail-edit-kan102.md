# KAN-102: Catechist Detail & Edit Forms

## Phase 0: Discovery (Complete)

### APIs Available (convex/catechists.ts)

| Function                     | Type     | Purpose                                                                                                                                   |
| ---------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `catechists.get`             | query    | Returns `{ ...catechist, address, contacts }` — full hydrated                                                                             |
| `catechists.update`          | mutation | Admin-only; updates fullName/saintName/dob/gender/role/isActive/joinedDate/notes. Args: `requesterId`, `catechistId`, all fields optional |
| `catechists.upsertMyAddress` | mutation | No admin check; upsert address by catechistId                                                                                             |
| `catechists.addContact`      | mutation | Add contact (E.164 phone validation)                                                                                                      |
| `catechists.updateContact`   | mutation | Update contact by contactId                                                                                                               |
| `catechists.deleteContact`   | mutation | Soft-delete contact by contactId                                                                                                          |

No new backend needed.

### Copy-From References

| Pattern                             | Source                                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------------------------- |
| PersonalInfoForm                    | `src/routes/_authenticated/profile.tsx:77-275`                                              |
| AddressForm                         | `src/routes/_authenticated/profile.tsx:311-488`                                             |
| ContactsSection + ContactDialogForm | `src/routes/_authenticated/profile.tsx:515-986`                                             |
| Detail page shell                   | `src/routes/_authenticated/branches_.$id.tsx`                                               |
| Edit page shell                     | `src/routes/_authenticated/branches_.$id_.edit.tsx`                                         |
| Unsaved changes guard               | `src/components/forms/branch-form.tsx:61-70` — `formDirty` + AlertDialog (NOT `useBlocker`) |
| Breadcrumb `crumbs` array           | `src/routes/_authenticated/branches_.$id.tsx:13-17`                                         |

### Key Differences from profile.tsx

- `catechists.update` (not `updateMyProfile`) — takes `requesterId` + `catechistId`
- `catechists.get` loads full data in one call (not separate `getMyProfile` + `getMyAddress` + `getMyContacts`)
- `role` field: Select `admin | user`, **admin-only** (hide from user role)
- `isActive` field: Checkbox/Switch, **admin-only**
- Each section still saves independently (separate submit per card — same UX as profile.tsx)
- No `useBlocker` — use `formDirty` boolean state + AlertDialog (project convention)

### Routing Convention

- Underscore segments = flat path: `catechists_.$id.tsx` → `/catechists/$id`
- `catechists_.$id_.edit.tsx` → `/catechists/$id/edit`
- Breadcrumbs use `staticData: { crumbs: [...] }` array (not `crumb` string)

### Auth Pattern

```ts
const { user } = useAuth()
const requesterId = user?.userDocId as Id<'catechists'> | undefined
const canManage = isAdmin(user)
```

### Anti-Patterns to Avoid

- Do NOT use `useBlocker` — project uses manual `formDirty` + AlertDialog
- Do NOT use `staticData: { crumb: '...' }` (single string) for `$id` routes — use `crumbs` array
- Do NOT call `getMyProfile`/`getMyAddress`/`getMyContacts` from admin pages — use `catechists.get`
- Do NOT remove `@ts-expect-error` in catechists.tsx until routes exist (Phase 5)

---

## Phase 1: i18n Translation Keys

**Files:** `src/locales/en.json`, `src/locales/vi.json`

Add the following keys (insert after existing `catechists.*` block):

```json
"catechists.notFound": "Catechist not found",
"catechists.detail.title": "Catechist Details",
"catechists.edit.title": "Edit Catechist",
"catechists.edit.subtitle": "Update catechist profile, address, and contact information",
"catechists.edit.saved": "Catechist saved",
"catechists.edit.personal.title": "Basic Information",
"catechists.edit.personal.description": "Name, saint name, date of birth, gender, and joining date",
"catechists.edit.account.title": "Account Settings",
"catechists.edit.account.description": "App role and account status",
"catechists.edit.address.title": "Address",
"catechists.edit.address.description": "Home address details",
"catechists.edit.contacts.title": "Contact Information",
"catechists.role.admin": "Admin",
"catechists.role.user": "User",
"catechists.confirmLeave.title": "Discard unsaved changes?",
"catechists.confirmLeave.description": "You have unsaved changes that will be lost.",
"catechists.confirmLeave.discard": "Discard"
```

**Vietnamese equivalents** (`vi.json`) — same keys, translated values.

**Verification:**

```bash
grep -c "catechists.edit.title" src/locales/en.json   # → 1
grep -c "catechists.edit.title" src/locales/vi.json   # → 1
```

---

## Phase 2: Detail Page (`catechists_.$id.tsx`)

**File to create:** `src/routes/_authenticated/catechists_.$id.tsx`

**Copy shell from:** `src/routes/_authenticated/branches_.$id.tsx`

### Route Definition

```ts
export const Route = createFileRoute('/_authenticated/catechists_/$id')({
  component: CatechistDetailPage,
  staticData: {
    crumbs: [
      { label: 'catechists.title', path: '/catechists' },
      { label: 'catechists.detail.title' },
    ],
  },
})
```

### Page Structure

```
<div className="flex flex-col gap-6">
  <PageHeader icon={Users} title={catechist?.fullName ?? t('catechists.detail.title')} />

  {/* Personal Info card — read-only */}
  <Card>
    <CardHeader>
      <CardTitle>{t('catechists.edit.personal.title')}</CardTitle>
    </CardHeader>
    <CardContent>
      {/* Key-value rows: fullName, saintName, dob, gender (Badge), joinedDate, notes */}
      {/* Admin-only rows: role (Badge), isActive (Badge) */}
    </CardContent>
  </Card>

  {/* Address card — read-only */}
  <Card>...</Card>

  {/* Contacts card — read-only list (same visual as profile ContactsSection but no add/edit/delete) */}
  <Card>...</Card>
</div>
```

### Data Loading

```ts
const { id } = useParams({ strict: false })
const data = useQuery(
  api.catechists.get,
  requesterId ? { requesterId, catechistId: id as Id<'catechists'> } : 'skip',
)
// data = { ...catechist, address: Doc<'catechistAddresses'> | null, contacts: Doc<'catechistContacts'>[] }
```

### Actions (admin only)

- "Edit" button in PageHeader `actions` prop → `navigate({ to: '/catechists/$id/edit', params: { id } })`

### Skeleton States

- Show `<Skeleton>` rows while `data === undefined`
- Show `t('catechists.notFound')` if `data === null`

**Verification:**

```bash
# Navigate to /catechists/<valid-id> in browser
# Check breadcrumb shows: Home > Catechists > Catechist Details
# Check Edit button visible for admin, hidden for user role
```

---

## Phase 3: Edit Page — Personal Info + Account Settings

**File to create:** `src/routes/_authenticated/catechists_.$id_.edit.tsx`

### Route Definition

```ts
export const Route = createFileRoute('/_authenticated/catechists_/$id_/edit')({
  component: EditCatechistPage,
  staticData: {
    crumbs: [
      { label: 'catechists.title', path: '/catechists' },
      { label: 'catechists.edit.title' },
    ],
  },
})
```

### Guard (admin only)

```ts
if (!canManage || !requesterId) {
  return <div className="text-destructive">{t('common.contactAdmin')}</div>
}
```

### PersonalInfoSection (Card)

**Copy from:** `profile.tsx:77-307` — adapt to use `catechists.update`:

```ts
// Form fields: saintName, fullName (required), dateOfBirth, gender (Select), joinedDate, notes
// onSubmit:
await updateMutation({
  requesterId,
  catechistId: id as Id<'catechists'>,
  fullName: value.fullName,
  saintName: value.saintName || undefined,
  // ...etc
})
toast.success(t('catechists.edit.saved'))
```

### AccountSettingsSection (Card — admin only, `canManage` guard)

New section not in profile.tsx. Fields:

- `role` — `Select` with items `admin` | `user`. Use `catechists.role.admin` / `catechists.role.user` labels.
- `isActive` — `Checkbox` (copy pattern from `profile.tsx:763-780` isPrimary checkbox)

```ts
// onSubmit calls catechists.update with role + isActive only
await updateMutation({
  requesterId,
  catechistId: id as Id<'catechists'>,
  role: value.role as 'admin' | 'user',
  isActive: value.isActive,
})
toast.success(t('catechists.edit.saved'))
```

### Unsaved Changes Guard

Pattern from `src/components/forms/branch-form.tsx:61-70`:

```ts
const [formDirty, setFormDirty] = React.useState(false)
const handleCancel = () => {
  if (formDirty) setConfirmLeaveOpen(true)
  else navigate({ to: '/catechists/$id', params: { id } })
}
```

Mark `formDirty = true` in `onChange` of any field (inside `field.handleChange` wrappers).

Add AlertDialog at bottom using keys:

- `catechists.confirmLeave.title`
- `catechists.confirmLeave.description`
- `catechists.confirmLeave.discard`

**Verification:**

- Personal info form saves successfully, toast appears
- Account settings card only renders when `canManage === true`
- Cancel with dirty form → shows AlertDialog
- Cancel with clean form → navigates directly to detail page

---

## Phase 4: Address + Contacts on Edit Page

### AddressSection (Card)

**Copy from:** `profile.tsx:311-513` — change mutation call:

```ts
// Instead of: upsertAddress({ catechistId: loggedInUser, ... })
// Use: upsertAddress({ catechistId: id as Id<'catechists'>, ... })
// (Same mutation — upsertMyAddress has no admin check)
```

Initial data from `data.address` (already loaded via `catechists.get`).

Card title: `t('catechists.edit.address.title')`
Card description below title: `t('catechists.edit.address.description')` (add as `CardDescription`)

### ContactsSection (Card)

**Copy from:** `profile.tsx:515-986` — same mutations, different catechistId source:

```ts
// catechistId = id as Id<'catechists'>  (from URL param, not from auth user)
```

Card title: `t('catechists.edit.contacts.title')`

Initial contacts from `data.contacts` (already loaded). Note: contacts section re-queries via `getMyContacts`... actually no — profile.tsx calls `useQuery(api.catechists.getMyContacts, { catechistId })` reactively. Copy this pattern exactly, passing `catechistId` from the URL param.

**Verification:**

- Address form shows pre-filled data from existing address record
- Adding/editing/deleting contacts works (no page reload needed — Convex reactivity)
- Empty contacts → shows empty state message

---

## Phase 5: Clean Up List Page

**File:** `src/routes/_authenticated/catechists.tsx`

Remove `@ts-expect-error` comments now that routes exist:

Lines to fix (approximate, verify with grep):

```ts
// Line ~123: Link to="/catechists/$id"
// Line ~222: navigate to "/catechists/$id/edit"
// Line ~252: navigate to "/catechists/create" (leave — route not yet created)
```

```bash
grep -n "@ts-expect-error" src/routes/_authenticated/catechists.tsx
```

Remove only the two `@ts-expect-error` comments for `$id` and `$id/edit` routes. Leave any remaining ones for routes not yet created (e.g. `/catechists/create`).

**Verification:**

```bash
npx tsc --noEmit  # No new type errors
```

---

## Phase 6: Unit Tests

**Delegate to `unit-test-writer` agent.**

Files to test:

- `src/routes/_authenticated/catechists_.$id.tsx`
- `src/routes/_authenticated/catechists_.$id_.edit.tsx`

Coverage targets (85%+ statements/branches/functions/lines):

| Scenario                                               | Target file                 |
| ------------------------------------------------------ | --------------------------- |
| Detail page renders skeleton while loading             | `catechists_.$id.tsx`       |
| Detail page renders not-found when data is null        | `catechists_.$id.tsx`       |
| Detail page renders catechist fields correctly         | `catechists_.$id.tsx`       |
| Edit button visible to admin, hidden to user           | `catechists_.$id.tsx`       |
| Edit page redirects non-admin                          | `catechists_.$id_.edit.tsx` |
| Personal info form validates fullName required         | `catechists_.$id_.edit.tsx` |
| Personal info form submits with correct args           | `catechists_.$id_.edit.tsx` |
| Account settings card hidden for non-admin             | `catechists_.$id_.edit.tsx` |
| Role select updates on change                          | `catechists_.$id_.edit.tsx` |
| Dirty form shows AlertDialog on cancel                 | `catechists_.$id_.edit.tsx` |
| Clean form navigates directly on cancel                | `catechists_.$id_.edit.tsx` |
| Address form submits with correct args                 | `catechists_.$id_.edit.tsx` |
| Add contact dialog opens and submits                   | `catechists_.$id_.edit.tsx` |
| Delete contact shows AlertDialog + calls deleteContact | `catechists_.$id_.edit.tsx` |

Run with:

```bash
npm test -- --coverage
```

All four metrics (statements/branches/functions/lines) must be ≥ 85%.

---

## Phase 7: Code Review

**Delegate to `ts-react-reviewer` agent.**

Files to review:

- `src/routes/_authenticated/catechists_.$id.tsx`
- `src/routes/_authenticated/catechists_.$id_.edit.tsx`

Review checklist:

- TypeScript strictness — no `any`, no unnecessary `as` casts
- `requesterId` guard before queries (no unintended `'skip'` leaks)
- `canManage` guard on account settings renders
- No `updateMyProfile` (must use `catechists.update`)
- Correct `catechistId` source (URL param, not `user.userDocId`)
- E.164 phone validation on contact add/edit (copied from profile.tsx)
- Unsaved changes guard wired in all three sections (personal, account, address)
- Breadcrumb `crumbs` array format (not `crumb` string)
