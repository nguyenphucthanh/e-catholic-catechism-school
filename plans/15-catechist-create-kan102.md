# KAN-102 (Part 2): Catechist Create Page `/catechists/create`

## Phase 0: Discovery (Complete)

### Confirmed APIs (convex/catechists.ts — no changes needed)

| Function                     | Type     | Key Args                                                                                                              | Return                    |
| ---------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `catechists.create`          | mutation | `requesterId`, `fullName`_, `saintName?`, `dateOfBirth?`, `gender?`, `role`_ (`admin\|user`), `joinedDate?`, `notes?` | `Id<'catechists'>`        |
| `catechists.upsertMyAddress` | mutation | `catechistId`, `country`*, optional address fields                                                                    | void                      |
| `catechists.addContact`      | mutation | `catechistId`, `label`_, `contactType`_, `value`* (E.164 for phone), `isPrimary`*, `notes?`                           | `Id<'catechistContacts'>` |

### Copy-From References

| Pattern                                 | Source File                                      | Lines                                  |
| --------------------------------------- | ------------------------------------------------ | -------------------------------------- |
| Personal info form fields               | `src/routes/_authenticated/profile.tsx`          | 118–275                                |
| Address form fields                     | `src/routes/_authenticated/profile.tsx`          | 355–487                                |
| ContactDialogForm (add/edit dialog)     | `src/routes/_authenticated/profile.tsx`          | 534–801                                |
| Contact list UI (read items + dropdown) | `src/routes/_authenticated/profile.tsx`          | 840–903                                |
| E.164 phone normalisation               | `src/routes/_authenticated/profile.tsx`          | 573–580                                |
| Create page shell                       | `src/routes/_authenticated/branches_.create.tsx` | full file                              |
| `formDirty` unsaved-changes guard       | `src/components/forms/branch-form.tsx`           | 61–70, 200–226                         |
| `DEFAULT_COUNTRY` import                | `src/lib/locale.ts`                              | (grep: `export const DEFAULT_COUNTRY`) |

### Key Design Decision: Staged Contacts

Contacts need `catechistId` (FK) — which doesn't exist until after `catechists.create` resolves.
Strategy: hold contacts in **local React state** (`StagedContact[]`), flush to Convex on final submit after catechist doc is created.

### Submit Sequence

```
1. createMutation({ requesterId, fullName, saintName?, ... }) → newId
2. if any address field non-empty:
     upsertMyAddressMutation({ catechistId: newId, country: DEFAULT_COUNTRY, ... })
3. for each stagedContact:
     addContactMutation({ catechistId: newId, ...contact })
4. navigate({ to: '/catechists/$id', params: { id: newId } })
```

All steps run sequentially (`await` each). On any error, show `toast.error(...)` and stop — catechist doc already created at that point, so user lands on edit page to retry address/contacts.

### Unsaved Changes Guard

Project convention (confirmed from `branch-form.tsx`): manual `formDirty` boolean + AlertDialog.
No `useBlocker` from TanStack Router.

### Anti-Patterns to Avoid

- Do NOT call `addContact` during contact dialog save — push to local state only
- Do NOT use `staticData: { crumb: '...' }` — use `crumbs` array for `_.$` routes
- Do NOT default `role` to any value — field must be required with no default (admin picks explicitly)
- Do NOT use `updateMyProfile` — wrong mutation for admin create flow
- Do NOT forget `country: DEFAULT_COUNTRY` in upsertMyAddress (required arg)

---

## Phase 1: i18n Translation Keys

**Files:** `src/locales/en.json`, `src/locales/vi.json`

Add after the existing `catechists.*` block (keys from plan-14 Phase 1 may already be present — skip duplicates):

```json
"catechists.create.title": "Add Catechist",
"catechists.create.subtitle": "Create a new catechist profile with personal info, address, and contacts.",
"catechists.created": "Catechist created successfully",
"catechists.role.placeholder": "Select role",
"catechists.create.contacts.empty": "No contacts added yet.",
"catechists.create.contacts.add": "Add Contact"
```

Vietnamese (`vi.json`) equivalents:

```json
"catechists.create.title": "Thêm Giáo Lý Viên",
"catechists.create.subtitle": "Tạo hồ sơ giáo lý viên mới với thông tin cá nhân, địa chỉ và liên lạc.",
"catechists.created": "Tạo giáo lý viên thành công",
"catechists.role.placeholder": "Chọn vai trò",
"catechists.create.contacts.empty": "Chưa có liên lạc nào.",
"catechists.create.contacts.add": "Thêm liên lạc"
```

Reuse existing keys (no need to add):

- `catechists.confirmLeave.*` — added in plan-14 Phase 1
- `catechists.edit.address.*` — reused for address section header/description
- `catechists.edit.contacts.title` — reused for contacts card title
- `profile.contacts.*` — reused for contact dialog fields
- `profile.personal.gender.*` — reused for gender select

**Verification:**

```bash
grep "catechists.create.title" src/locales/en.json   # → 1 match
grep "catechists.create.title" src/locales/vi.json   # → 1 match
grep "catechists.created" src/locales/en.json        # → 1 match
```

---

## Phase 2: Create Page — Personal Info + Role Section

**File to create:** `src/routes/_authenticated/catechists_.create.tsx`

### Route Definition

```ts
export const Route = createFileRoute('/_authenticated/catechists_/create')({
  component: CreateCatechistPage,
  staticData: {
    crumbs: [
      { label: 'catechists.title', path: '/catechists' },
      { label: 'catechists.create.title' },
    ],
  },
})
```

### Admin Guard

```ts
function CreateCatechistPage() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const canManage = isAdmin(user)
  const requesterId = user?.userDocId as Id<'catechists'> | undefined

  if (!canManage || !requesterId) {
    return (
      <div className="p-4 text-destructive flex items-center justify-center h-full">
        {t('common.contactAdmin')}
      </div>
    )
  }

  return <CreateCatechistForm requesterId={requesterId} />
}
```

### StagedContact Type (top of file)

```ts
type ContactType = 'phone' | 'email' | 'zalo' | 'other'

type StagedContact = {
  id: string
  label: string
  contactType: ContactType
  value: string // already normalised to E.164 for phone
  isPrimary: boolean
  notes?: string
}
```

### TanStack Form Setup (Personal Info + Role)

**Copy fields from** `profile.tsx:118–275`, adding `role` field:

```ts
const form = useForm({
  defaultValues: {
    saintName: '',
    fullName: '',
    dateOfBirth: '',
    gender: '' as '' | 'male' | 'female' | 'other',
    role: '' as '' | 'admin' | 'user',
    joinedDate: '',
    notes: '',
  },
  onSubmit: async ({ value }) => {
    /* Phase 4 */
  },
})
```

### Personal Info Card

```tsx
<Card>
  <CardHeader>
    <CardTitle>{t('catechists.edit.personal.title')}</CardTitle>
    <CardDescription>
      {t('catechists.edit.personal.description')}
    </CardDescription>
  </CardHeader>
  <CardContent className="flex flex-col gap-4">
    {/* Copy fields from profile.tsx:118–264 */}
    {/* saintName, fullName (required), dateOfBirth+gender grid, joinedDate, notes */}

    {/* Role field — new, not in profile.tsx */}
    <form.Field
      name="role"
      validators={{
        onBlur: ({ value }) => (!value ? t('common.required') : undefined),
        onSubmit: ({ value }) => (!value ? t('common.required') : undefined),
      }}
      children={(field) => {
        const isInvalid =
          field.state.meta.isTouched && field.state.meta.errors.length > 0
        return (
          <Field data-invalid={isInvalid}>
            <FieldLabel>
              {t('catechists.col.role')}{' '}
              <span className="text-destructive">*</span>
            </FieldLabel>
            <Select
              value={field.state.value}
              onValueChange={(val) => {
                field.handleChange(val as 'admin' | 'user')
                setFormDirty(true)
              }}
              items={[
                { value: 'admin', label: t('catechists.role.admin') },
                { value: 'user', label: t('catechists.role.user') },
              ]}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('catechists.role.placeholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">
                  {t('catechists.role.admin')}
                </SelectItem>
                <SelectItem value="user">
                  {t('catechists.role.user')}
                </SelectItem>
              </SelectContent>
            </Select>
            {isInvalid && <FieldError errors={field.state.meta.errors} />}
          </Field>
        )
      }}
    />
  </CardContent>
</Card>
```

**Verification:**

- Form renders all personal info fields
- Role Select shows no default value (placeholder visible)
- Submitting without fullName or role shows inline errors
- `formDirty` set to `true` on any field change

---

## Phase 3: Create Page — Address Section

**Within `CreateCatechistForm`**, add address state alongside the TanStack form:

```ts
const [address, setAddress] = React.useState({
  addressLine1: '',
  addressLine2: '',
  city: '',
  stateProvince: '',
  postalCode: '',
  hamlet: '',
  subHamlet: '',
})

const handleAddressChange =
  (field: keyof typeof address) => (value: string) => {
    setAddress((prev) => ({ ...prev, [field]: value }))
    setFormDirty(true)
  }
```

> Note: Address is NOT part of the TanStack form — it's plain React state.
> This keeps the submit handler simple (read from `address` state directly).
> Alternative: add address fields to the TanStack form. Either approach is valid — pick the one that feels cleaner. The reference implementation in profile.tsx uses a separate `useForm` per section; here we consolidate into one submit, so plain state is simpler.

### Address Card

**Copy field layout from** `profile.tsx:355–487`. Replace `field.state.value` / `field.handleChange` with direct `address.*` state:

```tsx
<Card>
  <CardHeader>
    <CardTitle>{t('catechists.edit.address.title')}</CardTitle>
    <CardDescription>
      {t('catechists.edit.address.description')}
    </CardDescription>
  </CardHeader>
  <CardContent className="flex flex-col gap-4">
    {/* addressLine1, addressLine2 */}
    {/* city + postalCode grid */}
    {/* hamlet + subHamlet grid */}
    {/* Each: <Input value={address.fieldName} onChange={e => handleAddressChange('fieldName')(e.target.value)} /> */}
  </CardContent>
</Card>
```

**Verification:**

- Address fields render with empty defaults
- Typing in any address field sets `formDirty = true`
- Address values flow into submit handler in Phase 4

---

## Phase 4: Staged Contacts + Final Submit Logic

### Staged Contacts State

```ts
const [stagedContacts, setStagedContacts] = React.useState<StagedContact[]>([])
type ContactDialogState =
  | { mode: 'closed' }
  | { mode: 'add' }
  | { mode: 'edit'; contact: StagedContact }
const [contactDialog, setContactDialog] = React.useState<ContactDialogState>({
  mode: 'closed',
})
const [deleteContactTarget, setDeleteContactTarget] =
  React.useState<StagedContact | null>(null)
```

### Contact Dialog Save Handler (local only — no Convex)

**Copy ContactDialogForm from** `profile.tsx:534–801`. Change `onSuccess` signature:

```ts
// Instead of calling addContact/updateContact mutations directly,
// pass onSave callback that updates local state:

const handleContactSave = (data: Omit<StagedContact, 'id'>) => {
  if (contactDialog.mode === 'edit') {
    setStagedContacts((prev) =>
      prev.map((c) =>
        c.id === contactDialog.contact.id ? { ...data, id: c.id } : c,
      ),
    )
  } else {
    setStagedContacts((prev) => [...prev, { ...data, id: crypto.randomUUID() }])
  }
  setFormDirty(true)
  setContactDialog({ mode: 'closed' })
}
```

E.164 normalisation on phone must still happen **inside** the dialog form before calling `onSave` (copy from `profile.tsx:573–580`).

### isPrimary Enforcement (local)

When adding/editing a contact with `isPrimary: true`, clear `isPrimary` on any existing staged contact of the same `contactType`:

```ts
const handleContactSave = (data: Omit<StagedContact, 'id'>) => {
  let contacts =
    contactDialog.mode === 'edit'
      ? stagedContacts.map((c) =>
          c.id === contactDialog.contact.id ? { ...data, id: c.id } : c,
        )
      : [...stagedContacts, { ...data, id: crypto.randomUUID() }]

  if (data.isPrimary) {
    contacts = contacts.map((c) =>
      c.contactType === data.contactType &&
      c.id !==
        (contactDialog.mode === 'edit' ? contactDialog.contact.id : data.id)
        ? { ...c, isPrimary: false }
        : c,
    )
  }
  setStagedContacts(contacts)
  setFormDirty(true)
  setContactDialog({ mode: 'closed' })
}
```

### Contacts Card

**Copy visual layout from** `profile.tsx:840–903`. Replace Convex-backed actions with local state:

```tsx
<Card>
  <CardHeader className="flex flex-row items-center justify-between">
    <CardTitle>{t('catechists.edit.contacts.title')}</CardTitle>
    <Button size="sm" variant="outline" onClick={() => setContactDialog({ mode: 'add' })}>
      <Plus className="mr-1 size-4" />
      {t('catechists.create.contacts.add')}
    </Button>
  </CardHeader>
  <CardContent>
    {stagedContacts.length === 0 ? (
      <p className="text-sm text-muted-foreground">{t('catechists.create.contacts.empty')}</p>
    ) : (
      <ul className="flex flex-col">
        {stagedContacts.map((contact) => (
          <li key={contact.id} ...>
            {/* Same layout as profile.tsx:846–903 */}
            {/* DropdownMenu: Edit → setContactDialog({ mode: 'edit', contact }) */}
            {/*              Delete → setDeleteContactTarget(contact) */}
          </li>
        ))}
      </ul>
    )}
  </CardContent>
</Card>
```

Delete is local — no AlertDialog needed (no server call to confirm). Just `setStagedContacts(prev => prev.filter(c => c.id !== target.id))`.

### Final Submit Logic

```ts
const createMutation = useMutation(api.catechists.create)
const upsertAddressMutation = useMutation(api.catechists.upsertMyAddress)
const addContactMutation = useMutation(api.catechists.addContact)
const navigate = useNavigate()

// Inside form.onSubmit:
onSubmit: async ({ value }) => {
  const newId = await createMutation({
    requesterId,
    fullName: value.fullName,
    saintName: value.saintName || undefined,
    dateOfBirth: value.dateOfBirth || undefined,
    gender: (value.gender || undefined) as 'male' | 'female' | 'other' | undefined,
    role: value.role as 'admin' | 'user',
    joinedDate: value.joinedDate || undefined,
    notes: value.notes || undefined,
  })

  const hasAddress = Object.values(address).some(Boolean)
  if (hasAddress) {
    await upsertAddressMutation({
      catechistId: newId,
      country: DEFAULT_COUNTRY,
      addressLine1: address.addressLine1 || undefined,
      addressLine2: address.addressLine2 || undefined,
      city: address.city || undefined,
      stateProvince: address.stateProvince || undefined,
      postalCode: address.postalCode || undefined,
      hamlet: address.hamlet || undefined,
      subHamlet: address.subHamlet || undefined,
    })
  }

  for (const contact of stagedContacts) {
    await addContactMutation({
      catechistId: newId,
      label: contact.label,
      contactType: contact.contactType,
      value: contact.value,
      isPrimary: contact.isPrimary,
      notes: contact.notes,
    })
  }

  toast.success(t('catechists.created'))
  setFormDirty(false)
  void navigate({ to: '/catechists/$id', params: { id: newId } })
},
```

### Single Submit Button + Cancel

Below all three cards:

```tsx
<div className="flex justify-end gap-2">
  <Button type="button" variant="outline" onClick={handleCancel}>
    {t('common.cancel')}
  </Button>
  <form.Subscribe
    selector={(s) => ({ isSubmitting: s.isSubmitting })}
    children={({ isSubmitting }) => (
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? t('common.saving') : t('catechists.create.title')}
      </Button>
    )}
  />
</div>
```

### Unsaved Changes AlertDialog

**Copy from** `src/components/forms/branch-form.tsx:200–226`. Use `catechists.confirmLeave.*` keys:

```ts
const [confirmLeaveOpen, setConfirmLeaveOpen] = React.useState(false)
const [formDirty, setFormDirty] = React.useState(false)

const handleCancel = () => {
  if (formDirty) setConfirmLeaveOpen(true)
  else void navigate({ to: '/catechists' })
}
```

**Verification:**

- Submitting valid form creates catechist, upserts address if filled, adds all staged contacts, navigates to detail
- Submitting with no address → skips `upsertMyAddress` call
- Submitting with no staged contacts → skips `addContact` loop
- Cancel with dirty form → shows AlertDialog
- Cancel with clean form → navigates to `/catechists`
- Phone contacts saved as E.164 in staged state (verify by checking `contact.value` before submit)

---

## Phase 5: Clean Up List Page

**File:** `src/routes/_authenticated/catechists.tsx`

Remove remaining `@ts-expect-error` for `/catechists/create` route now that the file exists.

```bash
grep -n "@ts-expect-error" src/routes/_authenticated/catechists.tsx
```

Remove the comment on the line above `to: '/catechists/create'`. Leave any other `@ts-expect-error` lines (if any remain for routes still not created).

**Verification:**

```bash
npx tsc --noEmit   # No new type errors introduced
grep "@ts-expect-error" src/routes/_authenticated/catechists.tsx   # Ideally 0 matches
```

---

## Phase 6: Unit Tests

**Delegate to `unit-test-writer` agent.**

**Files to test:**

- `src/routes/_authenticated/catechists_.create.tsx`

**Coverage target:** ≥ 85% statements / branches / functions / lines

| Scenario                                                 | Notes                                         |
| -------------------------------------------------------- | --------------------------------------------- |
| Non-admin sees "contact admin" message                   | Mock `isAdmin` → false                        |
| Form renders all personal info fields                    | Snapshot or role/fullName present             |
| Role Select has no default (placeholder shown)           | Check no `value` pre-selected                 |
| Submitting without fullName shows error                  | Blur + submit                                 |
| Submitting without role shows error                      | Blur + submit                                 |
| Valid submit calls `catechists.create` with correct args | Mock mutation                                 |
| Address skipped when all fields empty                    | Verify `upsertMyAddress` not called           |
| Address submitted when any field non-empty               | Verify `upsertMyAddress` called               |
| Staged contact added to list                             | Click Add → fill dialog → save → check list   |
| Staged contact edited in list                            | Click Edit → change label → save → check list |
| Staged contact deleted from list                         | Click Delete → check list shrinks             |
| isPrimary cleared on same-type conflict                  | Add 2 phone contacts both isPrimary           |
| All staged contacts submitted via `addContact`           | 2 contacts → mutation called twice            |
| Phone contact stored as E.164                            | Input `0901234567` → stored as `+84901234567` |
| Navigate to detail page after success                    | Check `navigate` called with new ID           |
| Dirty form shows AlertDialog on cancel                   | Change a field → click Cancel                 |
| Clean form navigates directly on cancel                  | No changes → click Cancel                     |

Run:

```bash
npm test -- --coverage
# All 4 metrics ≥ 85%
```

---

## Phase 7: Code Review

**Delegate to `ts-react-reviewer` agent.**

**Files to review:**

- `src/routes/_authenticated/catechists_.create.tsx`

**Review checklist:**

- No `any` types — `StagedContact`, `ContactType`, `Gender` fully typed
- `role` field enforces `'admin' | 'user'` union (no loose string)
- `catechistId` passed correctly to address/contact mutations (new ID, not `user.userDocId`)
- `DEFAULT_COUNTRY` used for `country` arg in `upsertMyAddress` (not hardcoded string)
- E.164 normalisation runs before pushing to `stagedContacts` (not raw phone value stored)
- `formDirty` set on all three sections (fields, address, contact add/edit/delete)
- `setFormDirty(false)` before navigate (prevent guard triggering after success)
- No `useBlocker` (project uses manual guard)
- Breadcrumb uses `crumbs` array format (not `crumb` string)
- `catechists.create` mutation return value captured and used (not discarded)
