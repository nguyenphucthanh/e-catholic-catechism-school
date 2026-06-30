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

### Catechist Permission Matrix

| `Catechist.role`                  | Can access                                 |
| --------------------------------- | ------------------------------------------ |
| `catechist`                       | Only classes assigned via `CatechistClass` |
| `branch_deputy` / `branch_leader` | All classes within their branch            |
| `board`                           | All classes across all branches            |
