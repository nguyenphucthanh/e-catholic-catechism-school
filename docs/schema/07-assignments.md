[← Back to index](../README.md)

## 7.7 — Assignments (Phân Công)

#### `AcademicYearAssignment` — Board Member Assignment

Assigns a catechist to a board member role for a specific academic year.

| Field              | Type               | Constraints                 | Notes                           |
| ------------------ | ------------------ | --------------------------- | ------------------------------- |
| `id`               | id                 | [required] [unique]         |                                 |
| `academic_year_id` | ref → AcademicYear | [required]                  |                                 |
| `catechist_id`     | ref → Catechist    | [required]                  |                                 |
| `assignment_type`  | enum               | [required]                  | `board_member`                  |
| `is_deleted`       | boolean            | [required] [default: false] | Soft delete — never hard-delete |

Constraint: `(academic_year_id, catechist_id)` unique.

---

#### `BranchAssignment` — Branch Head Assignment

Assigns a catechist to head a specific branch for an academic year.
One catechist may head multiple branches in the same academic year.

| Field              | Type               | Constraints                 | Notes                           |
| ------------------ | ------------------ | --------------------------- | ------------------------------- |
| `id`               | id                 | [required] [unique]         |                                 |
| `academic_year_id` | ref → AcademicYear | [required]                  |                                 |
| `catechist_id`     | ref → Catechist    | [required]                  |                                 |
| `branch_id`        | ref → Branch       | [required]                  |                                 |
| `is_deleted`       | boolean            | [required] [default: false] | Soft delete — never hard-delete |

Constraint: `(academic_year_id, catechist_id, branch_id)` unique.

---

#### `ClassCatechist` — Teaching Assignment

Replaces `CatechistClass` with explicit `academic_year_id`.

| Field              | Type               | Constraints                 | Notes                                              |
| ------------------ | ------------------ | --------------------------- | -------------------------------------------------- |
| `id`               | id                 | [required] [unique]         |                                                    |
| `catechist_id`     | ref → Catechist    | [required]                  |                                                    |
| `class_year_id`    | ref → ClassYear    | [required]                  |                                                    |
| `academic_year_id` | ref → AcademicYear | [required]                  |                                                    |
| `role`             | enum               | [required]                  | `homeroom` (chủ nhiệm) / `co_teacher` (đồng giảng) |
| `is_deleted`       | boolean            | [required] [default: false] | Soft delete — never hard-delete                    |

Constraint: `(catechist_id, class_year_id)` unique.
