[← Back to index](../README.md)

## 7.3 — Students — Học Sinh

#### `Student`

| Field              | Type      | Constraints                | Notes                                                  |
| ------------------ | --------- | -------------------------- | ------------------------------------------------------ |
| `id`               | id        | [required] [unique]        | Convex document id (opaque)                            |
| `student_code`     | string    | [required] [unique]        | Login identifier for parent — from `counters` sequence |
| `full_name`        | string    | [required]                 |                                                        |
| `saint_name`       | string    | optional                   | Tên Thánh                                              |
| `date_of_birth`    | date      | optional                   | Also used as default password: `DDMMYYYY`              |
| `gender`           | enum      | optional                   | `male` / `female` / `other`                            |
| `previous_parish`  | string    | optional                   | Giáo xứ cũ                                             |
| `previous_diocese` | string    | optional                   | Giáo phận cũ                                           |
| `is_active`        | boolean   | [required] [default: true] |                                                        |
| `created_at`       | timestamp | [required] [immutable]     |                                                        |

---

#### `StudentAddress`

1-to-1 with `Student`. Supports Vietnam and overseas formats.

| Field            | Type          | Constraints                | Notes                |
| ---------------- | ------------- | -------------------------- | -------------------- |
| `id`             | id            | [required] [unique]        |                      |
| `student_id`     | ref → Student | [required] [unique]        |                      |
| `country`        | string        | [required] [default: `VN`] | ISO 3166-1 alpha-2   |
| `address_line_1` | text          | optional                   |                      |
| `address_line_2` | text          | optional                   |                      |
| `city`           | string        | optional                   |                      |
| `state_province` | string        | optional                   |                      |
| `postal_code`    | string        | optional                   |                      |
| `hamlet`         | string        | optional                   | Giáo Họ — free text  |
| `sub_hamlet`     | string        | optional                   | Giáo Xóm — free text |

---

#### `Guardian` — Phụ Huynh / Người Bảo Hộ

Independent entity. One `Guardian` record per adult, shared across sibling students.

| Field        | Type   | Constraints         | Notes     |
| ------------ | ------ | ------------------- | --------- |
| `id`         | id     | [required] [unique] |           |
| `full_name`  | string | [required]          |           |
| `saint_name` | string | optional            | Tên Thánh |
| `notes`      | text   | optional            |           |

---

#### `GuardianContact`

Contact entries attached to the guardian, not the student. Updating a number here propagates to all linked children automatically.

| Field          | Type           | Constraints                 | Notes                                                                                                                                                                                                                   |
| -------------- | -------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`           | id             | [required] [unique]         |                                                                                                                                                                                                                         |
| `guardian_id`  | ref → Guardian | [required]                  |                                                                                                                                                                                                                         |
| `contact_type` | enum           | [required]                  | `phone` / `email` / `zalo` / `other`                                                                                                                                                                                    |
| `value`        | string         | [required] [index]          | **Indexed for phone-number lookup.** When `contact_type = phone`, must be E.164: `+[country_code][number]` e.g. `+84901234567`, `+14155552671`. Enforced at application layer; UI should provide a country-code picker. |
| `is_primary`   | boolean        | [required] [default: false] | Preferred contact method for this guardian                                                                                                                                                                              |
| `notes`        | text           | optional                    | e.g. "Call after 5pm"                                                                                                                                                                                                   |

> **Phone lookup flow:** phone number → `GuardianContact.value` → `guardian_id` → `StudentGuardian` → all linked students.

---

#### `StudentGuardian` — Student ↔ Guardian Link

Many-to-many. Enables sibling families and ordered emergency contact lists.

| Field              | Type           | Constraints         | Notes                                                     |
| ------------------ | -------------- | ------------------- | --------------------------------------------------------- |
| `id`               | id             | [required] [unique] |                                                           |
| `student_id`       | ref → Student  | [required]          |                                                           |
| `guardian_id`      | ref → Guardian | [required]          |                                                           |
| `relationship`     | string         | [required]          | `father` / `mother` / `guardian` / free text              |
| `contact_priority` | integer        | [required]          | Call order: 1 = first to contact. Unique per `student_id` |
| `notes`            | text           | optional            | e.g. "custody: weekdays only"                             |

Constraints: `(student_id, guardian_id)` unique. `(student_id, contact_priority)` unique.

---

#### `StudentSacrament`

One row per sacrament per student. Max 4 rows per student.

| Field            | Type          | Constraints         | Notes                                                               |
| ---------------- | ------------- | ------------------- | ------------------------------------------------------------------- |
| `id`             | id            | [required] [unique] |                                                                     |
| `student_id`     | ref → Student | [required]          |                                                                     |
| `sacrament_type` | enum          | [required]          | `baptism` / `first_confession` / `first_communion` / `confirmation` |
| `received_date`  | date          | optional            |                                                                     |
| `received_place` | string        | optional            | Free text: church name, parish                                      |
| `notes`          | text          | optional            |                                                                     |

Constraint: `(student_id, sacrament_type)` unique.

---

#### `StudentClass` — Enrollment Record

| Field                 | Type            | Constraints                    | Notes                                          |
| --------------------- | --------------- | ------------------------------ | ---------------------------------------------- |
| `id`                  | id              | [required] [unique]            |                                                |
| `student_id`          | ref → Student   | [required]                     |                                                |
| `class_year_id`       | ref → ClassYear | [required]                     |                                                |
| `is_primary_class`    | boolean         | [required] [default: true]     | Exactly one primary class per student per year |
| `enrolled_date`       | date            | [required]                     |                                                |
| `status`              | enum            | [required] [default: `active`] | `active` / `on_leave` / `withdrawn`            |
| `status_changed_date` | date            | optional                       | Date of last status change                     |
| `left_date`           | date            | optional                       | Set only when `status = withdrawn`             |

Constraint: `(student_id, class_year_id)` unique.
