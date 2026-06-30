[← Back to index](../README.md)

## 7.6 — Authentication

#### `Account`

| Field           | Type      | Constraints                | Notes                                                      |
| --------------- | --------- | -------------------------- | ---------------------------------------------------------- |
| `id`            | id        | [required] [unique]        |                                                            |
| `login_id`      | string    | [required] [unique]        | Catechist → `member_id`; Parent → student's `student_code` |
| `password_hash` | string    | [required]                 | bcrypt or argon2; never plaintext                          |
| `account_type`  | enum      | [required]                 | `catechist` / `student`                                    |
| `user_ref_id`   | id        | [required]                 | Points to `Catechist.id` or `Student.id`                   |
| `is_active`     | boolean   | [required] [default: true] | Set to false to disable login                              |
| `last_login_at` | timestamp | optional                   |                                                            |
| `created_at`    | timestamp | [required] [immutable]     |                                                            |
