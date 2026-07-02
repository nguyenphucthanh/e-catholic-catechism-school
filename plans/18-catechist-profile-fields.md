# Catechist Profile — New Fields (title, community, level, photo)

## Phase 0: Discovery (Complete)

### Sources Consulted

| Path                                                         | What It Tells Us                                                                                                                                |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/schema/02-catechists.md`                               | Current `Catechist` table: `memberId`, `fullName`, `saintName`, `dateOfBirth`, `gender`, `role`, `isActive`, `joinedDate`, `notes`, `isDeleted` |
| `convex/schema.ts:95-110`                                    | Exact Convex schema for `catechists` table                                                                                                      |
| `convex/catechists.ts`                                       | All queries/mutations; `updateMyProfile` takes `fullName`, `saintName?`, `dateOfBirth?`, `gender?`, `joinedDate?`, `notes?`                     |
| `convex/catechists.ts`                                       | `update` (admin) — same optional fields; `create`/`createWithDetails` — same + `role`; `insertCatechistRecord` helper                           |
| `src/components/forms/catechist-personal-info-form.tsx`      | Reusable form component fields: `fullName`, `saintName`, `dateOfBirth`, `gender`, `joinedDate`, `notes`                                         |
| `src/routes/_authenticated/catechists_.$id_.edit.tsx`        | Edit page uses `PersonalInfoSection` → `CatechistPersonalInfoForm`                                                                              |
| `src/routes/_authenticated/catechists_.$id.tsx`              | Detail page displays profile fields in Card                                                                                                     |
| `src/routes/_authenticated/catechists_.create.tsx`           | Create page inline form fields                                                                                                                  |
| `convex/_generated/ai/guidelines.md:339-368`                 | File storage: `ctx.storage.getUrl()`, query `_storage` via `ctx.db.system.get`                                                                  |
| `src/components/ui/avatar.tsx`                               | Base UI Avatar component with `Avatar`, `AvatarImage`, `AvatarFallback`                                                                         |
| `src/locales/en.json:279-327`                                | Existing i18n keys for catechist profile                                                                                                        |
| `src/locales/vi.json:279-327`                                | Vietnamese translations                                                                                                                         |
| `convex/catechists.test.ts`                                  | Existing test patterns for backend                                                                                                              |
| `src/components/forms/catechist-personal-info-form.test.tsx` | Existing form component test patterns                                                                                                           |

### New Schema Fields to Add

| Field                   | Convex Type   | Validator                      | Notes                                                                                       |
| ----------------------- | ------------- | ------------------------------ | ------------------------------------------------------------------------------------------- |
| `title`                 | string        | `v.optional(v.string())`       | Empty = "Catechist". Options: `Cha`, `Thầy`, `Soeur`, `Huynh Trưởng` (stored as plain text) |
| `community`             | string        | `v.optional(v.string())`       | Cộng đoàn (dòng tu) — free text                                                             |
| `level`                 | string        | `v.optional(v.string())`       | Level for Huynh Trưởng in TNTT — free text                                                  |
| `profilePhotoStorageId` | id(\_storage) | `v.optional(v.id('_storage'))` | Reference to Convex storage for profile photo                                               |

### File Storage Pattern (Convex Guidelines)

From `convex/_generated/ai/guidelines.md:339-368`:

- `ctx.storage.getUrl(storageId)` — returns signed URL for display
- `ctx.db.system.get('_storage', storageId)` — get file metadata (size, contentType)
- Upload flow: client calls `generateUploadUrl` (built-in Convex mutation) → uploads file → gets `storageId` → stores `storageId` on record

### Anti-Patterns to Avoid

- Do NOT store photo as base64 string in document — use Convex `_storage` system table
- Do NOT add `generateUploadUrl` action manually — Convex provides it at `api.storage.generateUploadUrl` automatically
- Do NOT add photo size validation on backend — validate client-side (500KB max), verify with `ctx.db.system.get` if needed
- Do NOT make `title` an enum validator — store as free string so options can change without migration
- Do NOT duplicate `profilePhotoStorageId` into a `users` table — catechists ARE users in this system

---

## Phase 1: Schema & Docs Update

**Files to modify:**

- `convex/schema.ts` — add 4 new fields to `catechists` table definition
- `docs/schema/02-catechists.md` — add 4 new rows to `Catechist` table

### Schema Change (`convex/schema.ts:95-110`)

Add after `notes: v.optional(v.string()),` and before `isDeleted: v.boolean(),`:

```ts
title: v.optional(v.string()),
community: v.optional(v.string()),
level: v.optional(v.string()),
profilePhotoStorageId: v.optional(v.id('_storage')),
```

### Docs Change (`docs/schema/02-catechists.md`)

Add 4 rows after `notes` row (between lines 18-19):

```markdown
| `title` | string | optional | Danh xưng: `Cha`, `Thầy`, `Soeur`, `Huynh Trưởng`. Empty = "Giáo Lý Viên" |
| `community` | string | optional | Cộng đoàn (dòng tu) — free text |
| `level` | string | optional | Cấp bậc (TNTT Huynh Trưởng) — free text, e.g. `1`, `2`, `3` |
| `profile_photo_id` | id | optional | Ref → `_storage` system table. Max 500KB, used as avatar |
```

### Verification

```bash
grep "profilePhotoStorageId" convex/schema.ts   # → 1 match (field definition)
grep "profile_photo_id" docs/schema/02-catechists.md   # → 1 match (doc row)
```

---

## Phase 2: Backend Mutation Updates

**Files to modify:**

- `convex/catechists.ts` — add new fields to `updateMyProfile`, `update`, `create`, `createWithDetails`, `insertCatechistRecord`
- Add new mutation: `updateProfilePhoto` (set `profilePhotoStorageId` on catechist doc)
- Add new mutation: `deleteProfilePhoto` (clear `profilePhotoStorageId`)
- Add new query: `getProfilePhotoUrl` (return signed URL from storage)

### 2a. `updateMyProfile` args

Add 4 new optional args matching schema. Patch them in handler alongside existing fields.

```ts
args: {
  catechistId: v.id('catechists'),
  fullName: v.string(),
  saintName: v.optional(v.string()),
  dateOfBirth: v.optional(v.string()),
  gender: v.optional(v.union(v.literal('male'), v.literal('female'), v.literal('other'))),
  joinedDate: v.optional(v.string()),
  notes: v.optional(v.string()),
  title: v.optional(v.string()),
  community: v.optional(v.string()),
  level: v.optional(v.string()),
},
```

Handler already uses `const { catechistId, ...fields } = args` — no changes needed to handler body.

### 2b. `update` args

Same 3 new optional args. Handler already spreads `...fields` — no handler body changes.

### 2c. `create` args

Same 3 new optional args (no `profilePhotoStorageId` on create — only set after upload).

### 2d. `createWithDetails` args

Same 3 new optional args.

### 2e. `insertCatechistRecord` helper

Add `title?`, `community?`, `level?` to `CatechistCoreFields` type.

### 2f. New: `updateProfilePhoto` mutation

```ts
export const updateProfilePhoto = mutation({
  args: {
    catechistId: v.id('catechists'),
    storageId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch('catechists', args.catechistId, {
      profilePhotoStorageId: args.storageId,
    })
  },
})
```

No auth check — called by self-service (profile page) and admin (edit page). Caller owns their own photo.

### 2g. New: `deleteProfilePhoto` mutation

```ts
export const deleteProfilePhoto = mutation({
  args: { catechistId: v.id('catechists') },
  handler: async (ctx, args) => {
    const catechist = await ctx.db.get('catechists', args.catechistId)
    if (!catechist || !catechist.profilePhotoStorageId) return
    await ctx.storage.delete(catechist.profilePhotoStorageId)
    await ctx.db.patch('catechists', args.catechistId, {
      profilePhotoStorageId: undefined,
    })
  },
})
```

### 2h. New: `getProfilePhotoUrl` query

```ts
export const getProfilePhotoUrl = query({
  args: { catechistId: v.id('catechists') },
  handler: async (ctx, args) => {
    const catechist = await ctx.db.get('catechists', args.catechistId)
    if (!catechist || !catechist.profilePhotoStorageId) return null
    return await ctx.storage.getUrl(catechist.profilePhotoStorageId)
  },
})
```

### Verification

```bash
grep "title: v.optional" convex/catechists.ts   # → 4 matches (updateMyProfile, update, create, createWithDetails)
grep "updateProfilePhoto" convex/catechists.ts   # → 1 mutation
grep "deleteProfilePhoto" convex/catechists.ts   # → 1 mutation
grep "getProfilePhotoUrl" convex/catechists.ts   # → 1 query
```

---

## Phase 3: i18n Translation Keys

**Files:** `src/locales/en.json`, `src/locales/vi.json`

Add after existing `profile.personal.*` block (before `profile.contacts.*`):

```json
// en.json
"profile.personal.title": "Title/Role",
"profile.personal.title.placeholder": "Select title",
"profile.personal.title.none": "Catechist",
"profile.personal.title.cha": "Father (Cha)",
"profile.personal.title.thay": "Brother (Thầy)",
"profile.personal.title.soeur": "Sister (Soeur)",
"profile.personal.title.huynh_truong": "Huynh Trưởng",
"profile.personal.community": "Community (Dòng tu)",
"profile.personal.level": "Level (Cấp bậc)",
"profile.personal.photo": "Profile Photo",
"profile.personal.photo.upload": "Upload Photo",
"profile.personal.photo.remove": "Remove Photo",
"profile.personal.photo.maxSize": "Maximum 500KB",
"profile.personal.photo.error.size": "File too large. Maximum 500KB.",
```

**Vietnamese** (`vi.json`) — same keys:

```json
"profile.personal.title": "Danh xưng",
"profile.personal.title.placeholder": "Chọn danh xưng",
"profile.personal.title.none": "Giáo Lý Viên",
"profile.personal.title.cha": "Cha",
"profile.personal.title.thay": "Thầy",
"profile.personal.title.soeur": "Soeur",
"profile.personal.title.huynh_truong": "Huynh Trưởng",
"profile.personal.community": "Cộng đoàn (Dòng tu)",
"profile.personal.level": "Cấp bậc",
"profile.personal.photo": "Ảnh đại diện",
"profile.personal.photo.upload": "Tải ảnh lên",
"profile.personal.photo.remove": "Xóa ảnh",
"profile.personal.photo.maxSize": "Tối đa 500KB",
"profile.personal.photo.error.size": "File quá lớn. Tối đa 500KB.",
```

**Verification:**

```bash
grep -c "profile.personal.title" src/locales/en.json   # → 1
grep -c "profile.personal.title" src/locales/vi.json   # → 1
```

---

## Phase 4: Profile Photo Upload Component

**New file:** `src/components/custom/catechist-photo-upload.tsx`

Copy pattern from: Base UI `<Avatar>` in `src/components/ui/avatar.tsx` + Convex `generateUploadUrl` + `useMutation` pattern in existing forms.

### Component Interface

```tsx
interface CatechistPhotoUploadProps {
  catechistId: Id<'catechists'>
  currentPhotoUrl?: string | null
  onPhotoChange?: (storageId: Id<'_storage'> | null) => void
}
```

### Behavior

1. Show current photo in `Avatar` + `AvatarImage` (or `AvatarFallback` with initials if no photo)
2. "Upload" button triggers hidden `<input type="file" accept="image/*" />`
3. On file select:
   - Validate size ≤ 500KB client-side
   - Call `generateUploadUrl()` (built-in Convex storage action via `useMutation(api.storage.generateUploadUrl)`)
   - Upload file via `fetch(uploadUrl, { method: 'POST', body: file })`
   - Call `updateProfilePhoto` mutation with returned `storageId`
   - Refresh photo via `getProfilePhotoUrl` query or re-render
4. "Remove" button calls `deleteProfilePhoto` mutation
5. Show error toast on validation failure

### Verification

```bash
ls src/components/custom/catechist-photo-upload.tsx   # file exists
```

---

## Phase 5: Update Reusable Form Component

**File:** `src/components/forms/catechist-personal-info-form.tsx`

### 5a. Update `CatechistPersonalInfoFormValues` interface

Add:

```ts
title?: string
community?: string
level?: string
```

### 5b. Update `CatechistPersonalInfoFormProps` → `initialValues`

Add:

```ts
title: string
community: string
level: string
```

### 5c. Add form fields

After the `notes` textarea field (before submit button), add 3 new fields in a grid:

```tsx
{
  /* Title select */
}
;<form.Field name="title">
  <Field>
    <FieldLabel>{t('profile.personal.title')}</FieldLabel>
    <Select value={val} onValueChange={(v) => field.handleChange(v)}>
      <SelectTrigger>
        <SelectValue placeholder={t('profile.personal.title.placeholder')} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="">{t('profile.personal.title.none')}</SelectItem>
        <SelectItem value="Cha">{t('profile.personal.title.cha')}</SelectItem>
        <SelectItem value="Thầy">{t('profile.personal.title.thay')}</SelectItem>
        <SelectItem value="Soeur">
          {t('profile.personal.title.soeur')}
        </SelectItem>
        <SelectItem value="Huynh Trưởng">
          {t('profile.personal.title.huynh_truong')}
        </SelectItem>
      </SelectContent>
    </Select>
  </Field>
</form.Field>

{
  /* Community input */
}
;<form.Field name="community">
  <Input placeholder={t('profile.personal.community')} />
</form.Field>

{
  /* Level input */
}
;<form.Field name="level">
  <Input placeholder={t('profile.personal.level')} />
</form.Field>
```

Layout: single-row or 2-column grid as appropriate. Use `grid grid-cols-2 gap-4` for title+community, then level alone or in a row.

### Verification

```bash
grep -c "title" src/components/forms/catechist-personal-info-form.tsx   # → multiple (field, initialValues, onSubmit)
```

---

## Phase 6: Update Edit Page

**File:** `src/routes/_authenticated/catechists_.$id_.edit.tsx`

### 6a. `PersonalInfoSection` — initialValues

Add 3 new values:

```ts
title: profile.title ?? '',
community: profile.community ?? '',
level: profile.level ?? '',
```

No changes to `onSubmit` — `catechists.update` already accepts the new fields (updated in Phase 2).

### 6b. Add PhotoUpload section

After `PersonalInfoSection` and before `AccountSettingsSection`, add:

```tsx
<Card>
  <CardHeader>
    <CardTitle>{t('profile.personal.photo')}</CardTitle>
    <CardDescription>{t('profile.personal.photo.maxSize')}</CardDescription>
  </CardHeader>
  <CardContent>
    <CatechistPhotoUpload
      catechistId={catechistId}
      currentPhotoUrl={/* fetch via getProfilePhotoUrl query */}
      onPhotoChange={() => setFormDirty(true)}
    />
  </CardContent>
</Card>
```

### Verification

```bash
grep -c "profile.personal.photo" src/routes/_authenticated/catechists_.$id_.edit.tsx   # → ≥1
```

---

## Phase 7: Update Detail Page

**File:** `src/routes/_authenticated/catechists_.$id.tsx`

### 7a. Display new fields

After the `notes` display row (line ~175), add:

```tsx
<div>
  <p className="text-sm font-medium text-muted-foreground">
    {t('profile.personal.title')}
  </p>
  <p>{data.title || t('profile.personal.title.none')}</p>
</div>
<div>
  <p className="text-sm font-medium text-muted-foreground">
    {t('profile.personal.community')}
  </p>
  <p>{data.community || '-'}</p>
</div>
<div>
  <p className="text-sm font-medium text-muted-foreground">
    {t('profile.personal.level')}
  </p>
  <p>{data.level || '-'}</p>
</div>
```

### 7b. Add Avatar display at top of page

In the PageHeader area or before the Personal Info card, show:

```tsx
{
  data && (
    <div className="flex items-center gap-4 mb-4">
      <Avatar size="lg">
        <AvatarImage src={photoUrl ?? undefined} alt={data.fullName} />
        <AvatarFallback>{data.fullName.charAt(0)}</AvatarFallback>
      </Avatar>
    </div>
  )
}
```

Where `photoUrl` is fetched via `useQuery(api.catechists.getProfilePhotoUrl, { catechistId: id as Id<'catechists'> })`.

### Verification

```bash
grep -c "AvatarImage" src/routes/_authenticated/catechists_.$id.tsx   # → ≥1
grep -c "data.title" src/routes/_authenticated/catechists_.$id.tsx   # → ≥1
```

---

## Phase 8: Update Create Page

**File:** `src/routes/_authenticated/catechists_.create.tsx`

### 8a. Add fields to form defaultValues

```ts
title: '',
community: '',
level: '',
```

### 8b. Add form fields (same as Phase 5)

### 8c. Add to `createWithDetails` call

```ts
title: value.title || undefined,
community: value.community || undefined,
level: value.level || undefined,
```

### Verification

```bash
grep "title: value.title" src/routes/_authenticated/catechists_.create.tsx   # → 1
```

---

## Phase 9: Backend Tests

**File:** `convex/catechists.test.ts`

### Test cases to add

1. `updateMyProfile with new fields` — set title, community, level; assert they persist
2. `update with new fields` (admin) — same
3. `create with new fields` — verify stored
4. `createWithDetails with new fields` — verify stored
5. `updateProfilePhoto mutation` — set storageId, verify patched
6. `deleteProfilePhoto mutation` — set then delete, verify cleared
7. `getProfilePhotoUrl query` — returns URL for valid storageId, null for missing

### Form test updates

**File:** `src/components/forms/catechist-personal-info-form.test.tsx`

Add test for new fields rendering and submitting.

### Verification

```bash
npm test -- --run   # all tests pass
```

---

## Phase 10: Verification

### Audit checklist

| Check                           | Command                                                                                       |
| ------------------------------- | --------------------------------------------------------------------------------------------- |
| Schema has all 4 new fields     | `grep -c "profilePhotoStorageId\|title:" convex/schema.ts` ≥ 4                                |
| All mutations accept new fields | `grep -c "title: v.optional" convex/catechists.ts` = 4                                        |
| i18n keys complete              | `grep -c "profile.personal.photo" src/locales/en.json` ≥ 1                                    |
| Form component renders fields   | `grep -c "form.Field.*name.*title" src/components/forms/catechist-personal-info-form.tsx` ≥ 1 |
| Detail page shows fields        | `grep "data.title" src/routes/_authenticated/catechists_.$id.tsx`                             |
| Edit page passes initialValues  | `grep "profile.title" src/routes/_authenticated/catechists_.$id_.edit.tsx`                    |
| Create page passes values       | `grep "value.title" src/routes/_authenticated/catechists_.create.tsx`                         |
| Photo upload component exists   | `ls src/components/custom/catechist-photo-upload.tsx`                                         |
| Tests pass                      | `npm test -- --run`                                                                           |
| TypeScript compiles             | `npx tsc --noEmit`                                                                            |

### UI Verification

- Open detail page for a catechist: new fields display with correct values/defaults
- Open edit page: fields pre-filled, save works
- Open create page: fields present, create works
- Upload photo: file picker opens, validates 500KB, shows preview
- Remove photo: confirmation dialog, photo cleared
- Avatar in detail page updates after upload
