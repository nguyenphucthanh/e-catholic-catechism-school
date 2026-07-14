[← Back to index](README.md)

## 3. Authentication & Access Control

Authentication uses **loginId + password** (not email). No email-based flows exist.

### Member ID / Student Code Generation

Both `Catechist.member_id` and `Student.student_code` use a **manually incremented counter** as their value. A shared `counters` table holds one row per sequence (`name: 'catechist'` and `name: 'student'`). Each insert atomically reads, increments, and patches the counter row within the same mutation — safe because Convex mutations are serialized.

The raw integer is stored as-is (e.g. `1`, `42`). No zero-padding is applied anywhere — not in storage, not at the UI layer.

This keeps login IDs short and easy to enter on mobile, which is important for the parent audience.

### Account Auto-Creation

An `Account` row is automatically created whenever a new catechist or student is inserted:

| Entity    | `loginId`              | Default Password       |
| --------- | ---------------------- | ---------------------- |
| Catechist | `CAT-<member_id>`      | same as `loginId`      |
| Student   | `STD-<student_code>`   | same as `loginId`      |

Users should be prompted to change their password on first login.

### Account Types

| Account Type      | Login Identifier         | Access Scope                     |
| ----------------- | ------------------------ | -------------------------------- |
| Catechist         | `CAT-<member_id>`        | Depends on `Catechist.role`      |
| Parent / Guardian | `STD-<student_code>`     | Read-only: their child's records |

> **Implementation note:** Neither Convex nor Supabase natively supports member-ID authentication. Recommended approach: use `ConvexCredentials` (Convex) with a custom `authorize` function, or synthesize a fake internal email like `{login_id}@internal.giaoly` server-side (Supabase). The `Account` table is the source of truth for credentials.

### Password Management

- **No email reset flow** — passwords are reset by an admin (board-level catechist) via an admin screen.
- **Default password on account creation:** the `loginId` itself (e.g. `CAT-1`, `STD-42`). User should be prompted to change on first login.
- **Account disable:** set `Account.is_active = false`. Blocked users cannot log in regardless of password.

### Admin Lockout Recovery ("Break-Glass")

Admins reset everyone else's password via the app — but nothing resets an admin's own password if they're locked out. `resetAdminPassword` (in `convex/auth.ts`) is a last-resort recovery path for exactly that. It is **dashboard/CLI-only — no UI, no public route.**

**How it works**

- Guarded by a `BREAK_GLASS_CODE` environment variable (Convex env var, not stored in any table). Compared against the submitted code with a constant-time compare.
- Only works against accounts where `accountType = 'catechist'`, `isActive = true`, and `Catechist.role = 'admin'`. Any other target (students, non-admin catechists, unknown loginId) is rejected.
- **One-time use.** Every attempt (success or failure) is logged to the `breakGlassRecovery` table. Once one success row exists, all further attempts are rejected — even with the correct code — until a human manually deletes that row via the Convex dashboard.
- All rejections return the same generic error, regardless of cause (wrong code, unknown loginId, non-admin target, already used, env var unset). This is deliberate — no signal is leaked about *why* an attempt failed.

**Setup (one-time, before you ever need it)**

1. Generate a strong random code, e.g. `openssl rand -base64 32`.
2. Set it as `BREAK_GLASS_CODE` in the Convex dashboard (Settings → Environment Variables) for the relevant deployment.
3. Store the code in your password manager. It is not recoverable from the app or the database if lost.

**Recovery procedure (when locked out)**

1. Retrieve `BREAK_GLASS_CODE` from your password manager.
2. Run from the Convex dashboard function-runner or CLI:
   ```
   npx convex run auth:resetAdminPassword '{"loginId": "CAT-1", "code": "<BREAK_GLASS_CODE>", "newPassword": "<new password>"}'
   ```
3. Log in with the new password.
4. **Re-arm for next time:** in the Convex dashboard, delete the success row in `breakGlassRecovery`, then rotate `BREAK_GLASS_CODE` to a new value and update your password manager. Skipping this leaves the mechanism permanently spent.

**Why this shape:** the only admin account having zero recovery path was the original problem. A self-service email/SMS reset was rejected — it would add an external provider dependency and a public attack surface for a scenario that happens rarely and always has a human with dashboard access nearby. A pre-generated, env-stored, one-time code needs no new dependency, isn't discoverable by scanning the app's routes, and can't be recovered by anyone who only has database read access (it never touches the `accounts` table or any other table).

### App Roles (System-level)

| `Catechist.role` | Permissions                                                                                                      |
| ---------------- | ---------------------------------------------------------------------------------------------------------------- |
| `admin`          | Full system access: setup academic years, assign roles/board/branch members, manage all classes, reset passwords |
| `user`           | Base access: varies by real-life assignment (see below)                                                          |

### Real-Life Assignments (Per Academic Year)

Tracked via `AcademicYearAssignment` table linking catechist to assignment type per academic year.

| Assignment        | Scope                | Permissions                                                         |
| ----------------- | -------------------- | ------------------------------------------------------------------- |
| `board_member`    | Entire academic year | System admin for that AY: setup, assign members, manage all classes |
| `branch_head`     | Branch within AY     | View/manage all classes in branch, record attendance, view reports  |
| `class_catechist` | Class within AY      | Manage own class (exams, results), view all data (read-only)        |
| None              | Global read-only     | View all classes, students, catechists (read-only)                  |

### Permission Decision Tree

1. If `Catechist.role = admin` → full system access (all operations)
2. If `Catechist.role = user`:
   - Check `AcademicYearAssignment` for current academic year
   - If `board_member` → all operations scoped to that AY
   - If `branch_head` → branch operations (view/manage/record attendance)
   - If assigned to class → manage own class
   - Otherwise → read-only access

### Admin Assignment Rules

- Only `admin` role can assign/revoke `admin` role
- Board members/branch heads are assigned per academic year
- Assignments reset when academic year changes
- When board member election changes, tech admin retains `admin` role for annual setup
