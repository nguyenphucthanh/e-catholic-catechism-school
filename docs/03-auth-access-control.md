[← Back to index](README.md)

## 3. Authentication & Access Control

Authentication uses **member ID + password** (not email). No email-based flows exist.

### Member ID / Student Code Generation

Both `Catechist.member_id` and `Student.student_code` use a **manually incremented counter** as their value. A shared `counters` table holds one row per sequence (`name: 'catechist'` and `name: 'student'`). Each insert atomically reads, increments, and patches the counter row within the same mutation — safe because Convex mutations are serialized.

Display formatting (e.g. zero-padded `000042`) is handled at the UI layer via `id.toString().padStart(6, '0')` — never stored.

This keeps login IDs short and easy to enter on mobile, which is important for the parent audience.

### Account Types

| Account Type      | Login Identifier         | Access Scope                     |
| ----------------- | ------------------------ | -------------------------------- |
| Catechist         | Catechist's `member_id`  | Depends on `Catechist.role`      |
| Parent / Guardian | Student's `student_code` | Read-only: their child's records |

> **Implementation note:** Neither Convex nor Supabase natively supports member-ID authentication. Recommended approach: use `ConvexCredentials` (Convex) with a custom `authorize` function, or synthesize a fake internal email like `{member_id}@internal.giaoly` server-side (Supabase). The `Account` table is the source of truth for credentials.

### Password Management

- **No email reset flow** — passwords are reset by an admin (board-level catechist) via an admin screen.
- **Default password on account creation:** student's date of birth in `DDMMYYYY` format. User should be prompted to change on first login.
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
