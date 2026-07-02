# Plan: Catechist Form Refactor

## Goal

Extract duplicated form components from route files into shared `src/components/forms/` directory. Three route files share 3 duplicated form patterns:
- `PersonalInfoForm` (profile.tsx, edit.tsx, create.tsx)
- `AddressForm` (profile.tsx, edit.tsx, create.tsx)
- `ContactDialogForm/ContactsSection` (profile.tsx, edit.tsx, create.tsx)

## Files to Create

### Component 1: `src/components/forms/catechist-personal-info-form.tsx`

Extract from profile.tsx:82-280 (PersonalInfoForm) + edit.tsx:89-321 (PersonalInfoSection) + create.tsx:493-693.

**Props:**
```ts
interface CatechistPersonalInfoFormProps {
  initialValues: {
    fullName: string
    saintName: string
    dateOfBirth: string
    gender: string
    joinedDate: string
    notes: string
  }
  onSubmit: (values: {
    fullName: string
    saintName?: string
    dateOfBirth?: string
    gender?: 'male' | 'female' | 'other'
    joinedDate?: string
    notes?: string
  }) => Promise<void>
  onDirtyChange?: (dirty: boolean) => void
}
```

- Follow `branch-form.tsx` pattern (tanstack-form, zod validation, shadcn Field/Input/Select)
- FullName required validation via `z.string().min(1)`
- Gender select: male/female/other with i18n keys `profile.personal.gender.*`
- Submit button with `form.Subscribe` for isSubmitting state
- **No Card wrapper** — Card is rendered by the consumer (profile needs "Basic Information" title, edit needs different title/description, create needs CardHeader + CardDescription)

### Component 2: `src/components/forms/catechist-address-form.tsx`

Extract from profile.tsx:316-493 (AddressForm) + edit.tsx:438-646 (AddressSection) + create.tsx:697-797.

**Props:**
```ts
interface CatechistAddressFormProps {
  initialValues: {
    addressLine1: string
    addressLine2: string
    city: string
    stateProvince: string
    postalCode: string
    hamlet: string
    subHamlet: string
  }
  onSubmit: (values: {
    country: string
    addressLine1?: string
    addressLine2?: string
    city?: string
    stateProvince?: string
    postalCode?: string
    hamlet?: string
    subHamlet?: string
  }) => Promise<void>
  onDirtyChange?: (dirty: boolean) => void
}
```

- No validators needed (all optional fields)
- POSTAL_CODE / hamlet / subHamlet grid patterns as in existing code
- Submit button with `DEFAULT_COUNTRY` hardcoded in submit handler

### Component 3: `src/components/forms/catechist-contact-dialog-form.tsx`

Extract from profile.tsx:539-812 + edit.tsx:666-904. These are nearly identical — merge them with the combined feature set (required label validation from profile + email validation from edit).

**Props:**
```ts
interface CatechistContactDialogFormProps {
  initialValues?: {
    label: string
    contactType: ContactType
    value: string
    isPrimary: boolean
    notes: string
  }
  onSubmit: (values: {
    label: string
    contactType: ContactType
    value: string
    isPrimary: boolean
    notes?: string
  }) => Promise<void>
}
```

- combines profile's `validateRequired` for label + edit/create's email validation for value
- Conditional PhoneInput vs Input based on contactType
- isPrimary checkbox with horizontal Field
- Submit button with isSubmitting state
- **No Dialog wrapping** — consumer handles Dialog open/close

### Component 4: `src/components/forms/catechist-contacts-section.tsx`

Extract from profile.tsx:814-996 + edit.tsx:906-1086. These are nearly identical (different section titles / add button labels).

**Props:**
```ts
interface CatechistContactsSectionProps {
  catechistId: Id<'catechists'>
  contacts: Array<Doc<'catechistContacts'>>
  addContact: (args: { catechistId: Id<'catechists'>; label: string; contactType: ContactType; value: string; isPrimary: boolean; notes?: string }) => Promise<unknown>
  updateContact: (args: { contactId: Id<'catechistContacts'>; label: string; contactType: ContactType; value: string; isPrimary: boolean; notes?: string }) => Promise<unknown>
  deleteContact: (args: { contactId: Id<'catechistContacts'> }) => Promise<unknown>
  sectionTitle: string  // i18n key for "catechists.edit.contacts.title" or "profile.contacts.title"
  addButtonLabel: string  // i18n key for add button
  emptyMessage: string  // i18n key for empty state
}
```

- Wraps internal state for dialog + delete confirmation
- Uses `CatechistContactDialogForm` internally
- Renders Card (since layout varies by page)

Actually, looking at this more carefully, the contacts sections are really very similar - they just differ in:
1. Section title translation key
2. Add button translation key  
3. The create page has a different contact dialog form (staged)

So component 4 should accept these as i18n key props.

## Files to Modify

### `src/routes/_authenticated/profile.tsx`
- Remove `PersonalInfoForm` → import `CatechistPersonalInfoForm`
- Remove `AddressForm` → import `CatechistAddressForm`
- Remove `ContactDialogForm` + `ContactsSection` → import `CatechistContactsSection`
- Keep `PersonalInfoSection`, `AddressSection` as thin wrappers (Cards + query + shared component)
- Keep `ProfilePage` as-is

### `src/routes/_authenticated/catechists_.$id_.edit.tsx`
- Remove `PersonalInfoSection` → import `CatechistPersonalInfoForm`
- Remove `AddressSection` → import `CatechistAddressForm`
- Remove `ContactDialogForm` + `ContactsSection` → import `CatechistContactsSection`
- Remove duplicated `ContactType` type, `CONTACT_TYPE_ICONS`, `ContactTypeIcon` (duplicated in profile.tsx too)
- Rewrite sections as thin Card wrappers

### `src/routes/_authenticated/catechists_.create.tsx`
- Replace inline personal info fields with `CatechistPersonalInfoForm`
- Replace inline address fields with `CatechistAddressForm`
- Keep its own `ContactDialogForm` (staged contacts pattern is fundamentally different)
- Remove duplicated `ContactType` type, `CONTACT_TYPE_ICONS`, `ContactTypeIcon`

### Translation Keys

Shared components use existing i18n keys:
- `profile.personal.*` — personal info fields
- `profile.address.*` — address fields
- `profile.contacts.*` — contact fields
- `common.*` — common actions

No new keys needed.

## Tests

### New test files
1. `src/components/forms/catechist-personal-info-form.test.tsx` — test field rendering, fullName validation, gender select, submit behavior, dirty state tracking
2. `src/components/forms/catechist-address-form.test.tsx` — test field rendering, submit, dirty state
3. `src/components/forms/catechist-contact-dialog-form.test.tsx` — test contact type switch (phone → input changes), phone validation, email validation, required label, submit
4. `src/components/forms/catechist-contacts-section.test.tsx` — test contact list rendering, empty state, open dialog, delete confirmation, add/edit flows

### Update existing route tests
- `-profile.test.tsx` — should still pass since route components are thin wrappers; verify by running
- `-catechists_.$id_.edit.test.tsx` — should still pass; verify by running
- `-catechists_.create.test.tsx` — should still pass since create page structure unchanged; verify by running

### Test approach (follow existing patterns)
- Use `vi.mock('react-i18next')` → `{ t: (key: string) => key }`
- Use `vi.mock('convex/react')` for useMutation/useQuery
- Use `@testing-library/react` (render, screen, fireEvent, waitFor)
- Direct component import (no route mount)

## Phases

### Phase 1: Create shared components
1. `catechist-personal-info-form.tsx` + test
2. `catechist-address-form.tsx` + test
3. `catechist-contact-dialog-form.tsx` + test
4. `catechist-contacts-section.tsx` + test

### Phase 2: Update route files
1. `profile.tsx` — import shared components, remove inline forms
2. `catechists_.$id_.edit.tsx` — import shared components, remove inline forms
3. `catechists_.create.tsx` — import personal info and address forms, remove inline fields

### Phase 3: Verify
1. Run `npm test` — all existing tests pass
2. Run `npm run typecheck` — no type errors
3. Run `npm run lint` — no lint errors

## Anti-pattern Guards

- DO NOT wrap shared forms in `Card` — consumers wrap their own Card
- DO NOT include mutation logic in shared components — pass `onSubmit` callback
- DO NOT break i18n key structure — keys must match existing translations
- DO NOT change DOM structure that existing tests rely on (labels, placeholders, button text)
- DO NOT create circular imports — shared components import from `~/components/ui/*`, not from routes