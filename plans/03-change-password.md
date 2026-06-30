# Plan: Change Password Page

Available to all user types (catechist + student). User verifies current password, sets new one.

---

## Phase 0: Verified Facts

### Auth & accounts

- `accounts` table (`convex/schema.ts:427`): fields `loginId`, `passwordHash`, `accountType`, `userRefId`, `isActive`, `lastLoginAt`, `createdAt`
- Index: `by_login_id` on `loginId` — use this to find the account
- `loginId` = `user.memberId` for both user types (catechists use memberId, students use studentCode — both stored as loginId)
- `sha256Hex()` helper defined locally in `convex/auth.ts` and `convex/seed.ts` — needs to be extracted to shared lib or duplicated

### Password hashing

- Current: SHA-256 via `crypto.subtle.digest` (dev-only, noted as needing bcrypt before prod)
- Pattern (from `convex/auth.ts:5-9`):
  ```ts
  async function sha256Hex(plaintext: string): Promise<string> {
    const encoded = new TextEncoder().encode(plaintext)
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoded)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  }
  ```

### Route pattern (from `src/routes/_authenticated/profile.tsx:29`)

```ts
export const Route = createFileRoute('/_authenticated/change-password')({
  component: ChangePasswordPage,
})
```

### Form pattern (from `src/routes/login.tsx`)

- `useForm` from `@tanstack/react-form`
- `zod` validators on `onBlur`
- `useMutation` from `convex/react`
- `toast.success()` / `toast.error()` from `sonner`
- `useTranslation()` from `react-i18next`

### PageHeader pattern (from `src/components/page-header.tsx`)

```tsx
<PageHeader icon={LockIcon} title={t('password.title')} />
```

### Auth context

- `useAuth()` → `{ user: AuthUser }` where `user.memberId` = loginId

### Existing Convex mutations (pattern from `convex/auth.ts`)

- `ctx.db.query('accounts').withIndex('by_login_id', q => q.eq('loginId', loginId)).unique()`
- `ctx.db.patch(id, fields)` — 2-arg

### Anti-patterns

- Do NOT call `ctx.db.patch('accounts', id, fields)` — 3-arg form is wrong
- Do NOT store plaintext password
- Do NOT skip old-password verification on server side

---

## Phase 1: Extract sha256Hex to shared lib

`sha256Hex` is duplicated in `convex/auth.ts` and `convex/seed.ts`. Extract to `convex/lib/password.ts` before adding a third copy.

### Create `convex/lib/password.ts`

```ts
export async function sha256Hex(plaintext: string): Promise<string> {
  const encoded = new TextEncoder().encode(plaintext)
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}
```

### Update `convex/auth.ts`

- Remove local `sha256Hex` function
- Add: `import { sha256Hex } from './lib/password'`

### Update `convex/seed.ts`

- Remove local `sha256Hex` function
- Add: `import { sha256Hex } from './lib/password'`

### Verification

- `npx convex dev --once` passes (no duplicate symbol errors)
- `npx tsc --noEmit` passes

---

## Phase 2: Convex Mutation — changePassword

**File:** `convex/auth.ts` (append to existing file)

```ts
export const changePassword = mutation({
  args: {
    loginId: v.string(),
    oldPassword: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, { loginId, oldPassword, newPassword }) => {
    const account = await ctx.db
      .query('accounts')
      .withIndex('by_login_id', (q) => q.eq('loginId', loginId))
      .unique()

    if (!account || !account.isActive) {
      throw new Error('Account not found')
    }

    const oldHash = await sha256Hex(oldPassword)
    if (oldHash !== account.passwordHash) {
      throw new Error('Current password is incorrect')
    }

    if (newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters')
    }

    const newHash = await sha256Hex(newPassword)
    await ctx.db.patch(account._id, { passwordHash: newHash })
  },
})
```

### Verification

- `npx convex dev --once` passes
- Mutation appears in generated API

---

## Phase 3: i18n Keys

Add to both `src/locales/vi.json` and `src/locales/en.json`.

**vi.json additions:**

```json
"password.title": "Đổi Mật Khẩu",
"password.subtitle": "Cập nhật mật khẩu đăng nhập",
"password.current": "Mật khẩu hiện tại",
"password.current.required": "Vui lòng nhập mật khẩu hiện tại",
"password.new": "Mật khẩu mới",
"password.new.min": "Mật khẩu phải có ít nhất 8 ký tự",
"password.confirm": "Xác nhận mật khẩu mới",
"password.confirm.mismatch": "Mật khẩu xác nhận không khớp",
"password.submit": "Đổi mật khẩu",
"password.submitting": "Đang đổi...",
"password.success": "Đổi mật khẩu thành công",
"password.error.incorrect": "Mật khẩu hiện tại không đúng"
```

**en.json additions:**

```json
"password.title": "Change Password",
"password.subtitle": "Update your login password",
"password.current": "Current password",
"password.current.required": "Please enter your current password",
"password.new": "New password",
"password.new.min": "Password must be at least 8 characters",
"password.confirm": "Confirm new password",
"password.confirm.mismatch": "Passwords do not match",
"password.submit": "Change password",
"password.submitting": "Updating...",
"password.success": "Password changed successfully",
"password.error.incorrect": "Current password is incorrect"
```

### Verification

- `Object.keys(vi).length === Object.keys(en).length` — equal counts

---

## Phase 4: Route — Change Password Page

**File:** `src/routes/_authenticated/change-password.tsx`

### Structure

```
<div class="flex flex-col gap-6">
  <PageHeader icon={Lock} title={t('password.title')} subtitle={t('password.subtitle')} />
  <Card>
    <CardContent>
      <form>
        currentPassword  (type="password")
        newPassword      (type="password", min 8)
        confirmPassword  (type="password", must match newPassword)
        <Button submit>
      </form>
    </CardContent>
  </Card>
</div>
```

### Form logic

```ts
const { user } = useAuth()
const changePassword = useMutation(api.auth.changePassword)

const form = useForm({
  defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  onSubmit: async ({ value }) => {
    try {
      await changePassword({
        loginId: user!.memberId,
        oldPassword: value.currentPassword,
        newPassword: value.newPassword,
      })
      toast.success(t('password.success'))
      form.reset()
    } catch (e) {
      // Server throws "Current password is incorrect" → show as field error
      toast.error(e instanceof Error ? e.message : String(e))
    }
  },
})
```

### Validators

```ts
// currentPassword — onBlur
z.string().min(1) → t('password.current.required')

// newPassword — onBlur
z.string().min(8) → t('password.new.min')

// confirmPassword — onBlur, cross-field check
fieldApi.form.getFieldValue('newPassword') !== value → t('password.confirm.mismatch')
```

### Verification

- Route renders at `/change-password`
- Wrong current password → `toast.error`
- Mismatched confirm → field-level error on blur
- Success → `toast.success` + form clears
- `npx tsc --noEmit` passes

---

## Phase 5: Sidebar Link

In `src/components/app-sidebar.tsx`, add "Đổi mật khẩu" / "Change password" to the NavUser dropdown, below "Hồ sơ":

```tsx
// Add to NavUser dropdown, after profile link:
<DropdownMenuItem render={<Link to="/change-password" />}>
  <Lock />
  {t('password.title')}
</DropdownMenuItem>
```

Add `t('password.title')` i18n key already covered in Phase 3.

### Verification

- Dropdown shows "Đổi mật khẩu" in vi, "Change password" in en
- Clicking navigates to `/change-password`
- `npx tsc --noEmit` passes
- `npm run lint` passes

---

## Phase 6: Final Verification

```bash
npx tsc --noEmit
npm run lint
npx convex dev --once
```

Manual checks:

- [ ] Catechist can change password → re-login with new password works
- [ ] Wrong current password → toast error, form stays open
- [ ] New password < 8 chars → field error on blur
- [ ] Confirm mismatch → field error on blur
- [ ] Success → toast, form clears
- [ ] Student login also reaches `/change-password`
- [ ] Language switch works on this page
