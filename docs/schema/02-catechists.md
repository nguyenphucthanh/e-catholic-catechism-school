[← Back to index](../README.md)

## 7.2 — Catechists — Giáo Lý Viên

#### `Catechist`

| Field              | Type    | Constraints                  | Notes                                                                     |
| ------------------ | ------- | ---------------------------- | ------------------------------------------------------------------------- |
| `id`               | id      | [required] [unique]          | Convex document id (opaque)                                               |
| `member_id`        | string  | [required] [unique]          | Login identifier — from `counters` sequence, formatted at UI layer        |
| `full_name`        | string  | [required]                   |                                                                           |
| `saint_name`       | string  | optional                     | Tên Thánh                                                                 |
| `date_of_birth`    | date    | optional                     |                                                                           |
| `gender`           | enum    | optional                     | `male` / `female` / `other`                                               |
| `role`             | enum    | [required] [default: `user`] | `admin` / `user`                                                          |
| `is_active`        | boolean | [required] [default: true]   |                                                                           |
| `joined_date`      | date    | optional                     |                                                                           |
| `notes`            | text    | optional                     |                                                                           |
| `title`            | string  | optional                     | Danh xưng: `Cha`, `Thầy`, `Soeur`, `Huynh Trưởng`. Empty = "Giáo Lý Viên" |
| `community`        | string  | optional                     | Cộng đoàn (dòng tu) — free text                                           |
| `level`            | string  | optional                     | Cấp bậc (TNTT Huynh Trưởng) — free text, e.g. `1`, `2`, `3`               |
| `profile_photo_id` | id      | optional                     | Ref → `_storage` system table. Max 500KB, used as avatar                  |
| `is_deleted`       | boolean | [required] [default: false]  | Soft delete — never hard-delete                                           |

---

#### `CatechistAddress`

1-to-1 with `Catechist`. Supports Vietnam and overseas formats.

| Field            | Type            | Constraints                 | Notes                                          |
| ---------------- | --------------- | --------------------------- | ---------------------------------------------- |
| `id`             | id              | [required] [unique]         |                                                |
| `catechist_id`   | ref → Catechist | [required] [unique]         |                                                |
| `country`        | string          | [required] [default: `VN`]  | ISO 3166-1 alpha-2 e.g. `VN`, `US`, `AU`, `CA` |
| `address_line_1` | text            | optional                    | Street number and name                         |
| `address_line_2` | text            | optional                    | Apartment, unit, suite                         |
| `city`           | string          | optional                    |                                                |
| `state_province` | string          | optional                    | Tỉnh (VN) / State (US, AU) / Province (CA)     |
| `postal_code`    | string          | optional                    |                                                |
| `hamlet`         | string          | optional                    | Giáo Họ — free text, VN context                |
| `sub_hamlet`     | string          | optional                    | Giáo Xóm — free text, VN context               |
| `is_deleted`     | boolean         | [required] [default: false] | Soft delete — never hard-delete                |

---

#### `CatechistContact`

| Field          | Type            | Constraints                 | Notes                                                         |
| -------------- | --------------- | --------------------------- | ------------------------------------------------------------- |
| `id`           | id              | [required] [unique]         |                                                               |
| `catechist_id` | ref → Catechist | [required]                  |                                                               |
| `label`        | string          | [required]                  | e.g. "Personal Phone", "Zalo"                                 |
| `contact_type` | enum            | [required]                  | `phone` / `email` / `zalo` / `other`                          |
| `value`        | string          | [required]                  | When `contact_type = phone`, use E.164 format: `+84901234567` |
| `is_primary`   | boolean         | [required] [default: false] |                                                               |
| `notes`        | text            | optional                    |                                                               |
| `is_deleted`   | boolean         | [required] [default: false] | Soft delete — never hard-delete                               |

---

#### `CatechistClass` (DEPRECATED) — Teaching Assignment

| Field           | Type            | Constraints                      | Notes                                              |
| --------------- | --------------- | -------------------------------- | -------------------------------------------------- |
| `id`            | id              | [required] [unique]              |                                                    |
| `catechist_id`  | ref → Catechist | [required]                       |                                                    |
| `class_year_id` | ref → ClassYear | [required]                       |                                                    |
| `role`          | enum            | [required] [default: `homeroom`] | `homeroom` (chủ nhiệm) / `co_teacher` (đồng giảng) |
| `is_deleted`    | boolean         | [required] [default: false]      | Soft delete — never hard-delete                    |

Constraint: `(catechist_id, class_year_id)` unique.
