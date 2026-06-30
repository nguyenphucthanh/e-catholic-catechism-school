[← Back to index](../README.md)

> **Format note:** Schema is database-agnostic. Logical types: `id` (auto-increment or UUID), `ref → Table` (foreign key), `string` (~200 chars), `text` (unbounded), `enum`, `date`, `timestamp` (with timezone), `decimal`, `boolean`.
>
> Constraints: `[required]`, `[unique]`, `[default: x]`, `[immutable]`, `[computed, never stored]`.

## 7.1 — Core Organization

#### `Branch` — Ngành

6 fixed branches, seeded at setup.

| Field         | Type    | Constraints                 | Notes                           |
| ------------- | ------- | --------------------------- | ------------------------------- |
| `id`          | id      | [required] [unique]         |                                 |
| `name`        | string  | [required]                  | e.g. "Ấu Nhi", "Thiếu Nhi"      |
| `sort_order`  | integer | [required] [unique]         | 1 = Chiên Con … 6 = Dự Trưởng   |
| `description` | text    | optional                    |                                 |
| `is_deleted`  | boolean | [required] [default: false] | Soft delete — never hard-delete |

---

#### `AcademicYear` — Năm Học

| Field        | Type    | Constraints                              | Notes                                                               |
| ------------ | ------- | ---------------------------------------- | ------------------------------------------------------------------- |
| `id`         | id      | [required] [unique]                      |                                                                     |
| `name`       | string  | [required] [unique]                      | e.g. "2024-2025"                                                    |
| `start_date` | date    | [required]                               |                                                                     |
| `end_date`   | date    | [required]                               |                                                                     |
| `timezone`   | string  | [required] [default: `Asia/Ho_Chi_Minh`] | IANA timezone string e.g. `America/Los_Angeles`, `Australia/Sydney` |
| `is_active`  | boolean | [required] [default: false]              | Only one year active at a time                                      |
| `is_deleted` | boolean | [required] [default: false]              | Soft delete — never hard-delete                                     |

---

#### `Semester` — Học Kỳ

| Field              | Type               | Constraints                 | Notes                           |
| ------------------ | ------------------ | --------------------------- | ------------------------------- |
| `id`               | id                 | [required] [unique]         |                                 |
| `academic_year_id` | ref → AcademicYear | [required]                  |                                 |
| `semester_number`  | integer            | [required]                  | Must be between 1 and 4         |
| `name`             | string             | optional                    | e.g. "Học Kỳ 1"                 |
| `is_deleted`       | boolean            | [required] [default: false] | Soft delete — never hard-delete |

Constraint: `(academic_year_id, semester_number)` unique. Start/end dates defined at `AcademicYear` level only.

---

#### `Class` — Lớp (year-agnostic template)

| Field         | Type         | Constraints                 | Notes                           |
| ------------- | ------------ | --------------------------- | ------------------------------- |
| `id`          | id           | [required] [unique]         |                                 |
| `branch_id`   | ref → Branch | [required]                  |                                 |
| `name`        | string       | [required]                  | e.g. "Ấu Nhi 1"                 |
| `description` | text         | optional                    |                                 |
| `is_deleted`  | boolean      | [required] [default: false] | Soft delete — never hard-delete |

---

#### `ClassYear` — Lớp × Năm Học (live instance)

Central anchor for attendance, enrollments, and grading.

| Field              | Type               | Constraints                     | Notes                                                             |
| ------------------ | ------------------ | ------------------------------- | ----------------------------------------------------------------- |
| `id`               | id                 | [required] [unique]             |                                                                   |
| `class_id`         | ref → Class        | [required]                      |                                                                   |
| `academic_year_id` | ref → AcademicYear | [required]                      |                                                                   |
| `class_type`       | enum               | [required] [default: `primary`] | `primary` / `apostle` / `sacrament_review` / `supplemental_other` |
| `is_deleted`       | boolean            | [required] [default: false]     | Soft delete — never hard-delete                                   |

Constraint: `(class_id, academic_year_id)` unique.
