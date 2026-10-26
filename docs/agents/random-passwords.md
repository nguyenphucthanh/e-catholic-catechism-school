# Spec: random passwords for new and reset accounts

Replace the default password (password = login ID) with a server-generated random password wherever an admin creates, grants or resets an account. The plaintext is shown to the admin **once** — a credentials dialog for single actions, a one-time CSV download for bulk actions — and never stored or shown again.

## Decisions

| # | Decision |
|---|---|
| D1 | **Format**: 10 characters from lowercase letters + digits minus lookalikes (`0 o 1 l i`) — alphabet `23456789abcdefghjkmnpqrstuvwxyz`. Example `k7mq4xt2rp`. |
| D2 | **Scope**: only accounts created, granted or reset after release. Existing passwords are untouched — no mass change. |
| D3 | `mustChangePassword: true` stays on every generated password. Enforcement stays UI-only (unchanged). |
| D4 | **Lost password** = reset again. The server stores only the bcrypt hash; plaintext exists only in the action's response. |
| D5 | **Single vs bulk is decided by the action**, not by the row count. A bulk action with 1 row still produces a CSV. |
| D6 | **Partial failures**: the CSV/dialog contains only accounts actually created or reset. Failed rows keep their current UI. Zero successes → no dialog, existing error toast. |
| D7 | `updateAccountLoginIdPrefixes` renames login IDs only and stops touching passwords. |
| D8 | `seed.ts` demo data keeps password = login ID. `setup.ts` (first admin picks their own password) is out of scope. |

## Entry points

| Action | Backend today | Kind | UI |
|---|---|---|---|
| Create catechist | `catechists.createWithDetails` (mutation) | single | `src/routes/_authenticated/_catechist/catechists_.create.tsx` |
| Create student | `students.createStudentWithProfile` (mutation; account via `createStudentWithAccount` in `convex/students.ts`, also used by CSV import with a precomputed `passwordHash`) | single | `src/routes/_authenticated/_catechist/students_.create.tsx` — today shows **no** credentials |
| Grant catechist account | `accountAdmin.grantCatechistAccount` | single | `src/routes/_authenticated/_catechist/_admin/catechist-accounts.tsx` |
| Grant student account | `accountAdmin.grantStudentAccount` | single | `src/routes/_authenticated/_catechist/_admin/student-accounts.tsx` |
| Reset password | `accountAdmin.resetPassword` | single | both account pages |
| Bulk grant | `accountAdmin.bulkGrantCatechistAccounts`, `bulkGrantStudentAccounts` | bulk | both account pages |
| Bulk reset | `accountAdmin.bulkResetPasswords` | bulk | both account pages |
| CSV import | `csvImport.bulkImportStudents`, `bulkImportCatechists` (actions) | bulk | `src/components/csv-import/ImportStep6Import.tsx` → `ImportStep7Result.tsx` |
| Transform students → catechists | `catechists.transformStudentsToCatechists` | bulk | `src/routes/_authenticated/_catechist/_admin/students_.transform.tsx` |

Find every remaining `hashPassword(loginId)` / `hashPassword(account.loginId)` with `grep -rn "hashPassword(" convex`; after this work, only `seed.ts` may hash a login ID.

## Backend

**Randomness lives in actions.** Convex mutations run with seeded randomness (deterministic replay), so they must never generate credentials. Follow the existing pattern in `convex/csvImport.ts` (action hashes, internal mutation writes) and `convex/accountAdmin.ts` `loginAsCatechist` (action → internal mutation):

1. Add `generatePassword()` in `convex/lib/password.ts`: `crypto.getRandomValues` over the D1 alphabet, rejection sampling to avoid modulo bias.
2. For each entry point: a public **action** generates one password per account, hashes it with `hashPassword`, calls an **internal mutation** with the hashes, and returns the plaintext alongside the rows. The internal mutation keeps today's authorization (`assertAdminRole(ctx)` etc. — identity propagates from the action) and today's writes, taking `passwordHash` as an argument instead of hashing the login ID.
3. Existing mutations that become internal get a public action of the **same name** (as `changePassword` / `loginAsCatechist` did), so frontend changes are `useMutation` → `useAction`.
4. Generate passwords only for rows that will be written; for bulk actions where the mutation decides which rows succeed (skips, existing accounts), have the mutation return which ids succeeded and drop the other plaintexts before responding.
5. `resetPassword` / `bulkResetPasswords` keep calling `revokeSessions`.
6. D7: in `convex/updateAccountPrefixes.ts`, drop `newPasswordHash` from `applyAccountUpdate` and stop hashing in the action.

**Response shape** (single and bulk alike):

```ts
type IssuedCredential = {
  accountType: 'catechist' | 'student'
  saintName?: string
  fullName: string
  className?: string // students: primary class in the active academic year, if any
  loginId: string
  password: string // plaintext, this response only
}
```

Single actions return their existing payload plus one `IssuedCredential`; bulk actions return their existing payload plus `IssuedCredential[]`.

## Frontend

### Shared credentials dialog (single actions)

One component replaces both existing copies (the `credentialsInfo` dialog in the two account pages and `CopyField` in `catechists_.create.tsx`). Contents:

- Highlighted warning `Alert`: passwords are shown only once.
- Login ID and password, each with a copy button.
- **Copy both** button — copies `Tên đăng nhập: <loginId>\nMật khẩu: <password>`.
- Not dismissable by outside click or Esc. Closing before any copy shows a confirm ("Passwords will be lost — close anyway?").

Create catechist: unchanged flow (dialog, then navigate to the catechist). Create student: **new** — dialog, then navigate to `/students/$id`.

### Bulk credentials dialog (bulk actions)

Same modal rules and warning, plus:

- Count of accounts issued and a **Download CSV** button.
- Closing before downloading shows the confirm.
- Used by bulk grant, bulk reset, CSV import (after the import finishes, before/with `ImportStep7Result`) and transform.

### CSV

Build it with the helpers in `src/lib/export/csv.ts` (CLAUDE.md: export logic lives in `src/lib/export`), from the action response — never from table state.

- Columns: `Họ tên` (`formatPersonName` from `src/lib/name.ts`), `Loại` (`Giáo lý viên` / `Học viên`), `Lớp` (students; empty for catechists), `Tên đăng nhập`, `Mật khẩu`.
- UTF-8 with BOM (Excel + Vietnamese diacritics).
- Filename `tai-khoan-<action>-<yyyyMMdd-HHmm>.csv`, `<action>` ∈ `cap-moi` (grant/create), `dat-lai` (reset), `nhap` (import), `chuyen-doi` (transform).

### Leaving the page

While a dialog holds plaintext that has not been copied (single) or downloaded (bulk), register a `beforeunload` warning; remove it after the first copy/download or when the dialog closes.

All user-facing strings go through i18n (`vi` and `en`).

## Out of scope

Server-side enforcement of `mustChangePassword`; changing existing passwords; QR cards (they carry `memberId` / `studentCode`, never passwords); `setup.ts`; `seed.ts`.

## Done when

- `grep -rn "hashPassword(" convex` shows no login-ID hashing outside `seed.ts`, and `updateAccountPrefixes` no longer writes `passwordHash`.
- Every entry point in the table returns `IssuedCredential`(s) and its UI shows the single or bulk dialog per D5.
- Unit tests (via the `unit-test-writer` agent, ≥75% coverage on touched files) cover: `generatePassword` alphabet/length/uniqueness; each action returns plaintext whose bcrypt hash matches the stored hash; partial-failure bulk returns only successful rows; prefix migration leaves `passwordHash` unchanged; dialogs block outside-click/Esc, confirm on unsaved close, `beforeunload` registered then cleared; CSV columns, BOM and filename.
- `npx tsc --noEmit`, `npx vitest run`, `npx eslint` clean.
