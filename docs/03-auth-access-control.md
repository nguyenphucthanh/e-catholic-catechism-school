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
