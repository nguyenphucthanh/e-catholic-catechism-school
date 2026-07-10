[← Back to index](../README.md)

## 7.5 — Grading

#### `ScoreColumn` — Grade Column Configuration

| Field           | Type            | Constraints                  | Notes                                                                        |
| --------------- | --------------- | ----------------------------- | ------------------------------------------------------------------------------ |
| `id`            | id              | [required] [unique]          |                                                                                |
| `class_year_id` | ref → ClassYear | [required]                   |                                                                                |
| `semester_id`   | ref → Semester  | [required]                   |                                                                                |
| `column_name`   | string          | [required]                   | e.g. "15-min Quiz 1", "Semester Exam"                                         |
| `column_type`   | enum            | [required]                   | `short_quiz` / `midterm_test` / `semester_exam`                               |
| `scale_type`    | enum            | [required] [default: scale_10] | `scale_10` / `pass_fail` / `letter_af`                                      |
| `weight`        | integer         | [required] [default: 1]      | 1–3. Used for weighted semester-average calculation (`scale_10` columns only) |
| `sort_order`    | integer         | [required] [default: 0]      |                                                                                |
| `is_deleted`    | boolean         | [required] [default: false]  | Soft delete — never hard-delete                                              |

---

#### `ScoreEntry` — Individual Score

Only for `short_quiz`, `midterm_test`, `semester_exam`.

| Field              | Type               | Constraints                 | Notes                                                                            |
| ------------------ | ------------------ | --------------------------- | --------------------------------------------------------------------------------- |
| `id`               | id                 | [required] [unique]         |                                                                                   |
| `student_class_id` | ref → StudentClass | [required]                  |                                                                                   |
| `score_column_id`  | ref → ScoreColumn  | [required]                  |                                                                                   |
| `score_value`      | decimal            | optional                    | 0.00 – 10.00. Set only when column's `scale_type = scale_10`                     |
| `score_label`      | string             | optional                    | Set only when column's `scale_type` is `pass_fail` / `letter_af`; app-validated  |
| `entered_by`       | ref → Catechist    | [required]                  |                                                                                   |
| `entered_at`       | timestamp          | [required]                  |                                                                                   |
| `updated_at`       | timestamp          | optional                    |                                                                                   |
| `is_deleted`       | boolean            | [required] [default: false] | Soft delete — never hard-delete                                                  |

Constraint: `(student_class_id, score_column_id)` unique. Exactly one of `score_value` / `score_label` set, matching parent column's `scale_type`.

---

#### `ScoreEntryHistory` — Score Audit Trail

Append-only. One row per modification to any `ScoreEntry`. No `is_deleted` — audit trail rows are never deleted, soft or hard.

| Field            | Type             | Constraints            | Notes                                          |
| ---------------- | ---------------- | ---------------------- | ------------------------------------------------ |
| `id`             | id               | [required] [unique]    |                                                 |
| `score_entry_id` | ref → ScoreEntry | [required]             |                                                 |
| `old_score_value`| decimal          | optional               | Null on initial entry or when scale is not `scale_10` |
| `new_score_value`| decimal          | optional               |                                                 |
| `old_score_label`| string           | optional               | Null on initial entry or when scale is `scale_10` |
| `new_score_label`| string           | optional               |                                                 |
| `changed_by`     | ref → Catechist  | [required]             |                                                 |
| `changed_at`     | timestamp        | [required] [immutable] |                                                 |
| `reason`         | text             | optional               |                                                 |

---

#### `SemesterResult` — Per-Semester Evaluation

One per student per class enrollment per semester. Stores the homeroom teacher's qualitative assessment, visible to students and parents.

| Field              | Type               | Constraints                 | Notes                                                       |
| ------------------ | ------------------ | --------------------------- | ----------------------------------------------------------- |
| `id`               | id                 | [required] [unique]         |                                                             |
| `student_class_id` | ref → StudentClass | [required]                  |                                                             |
| `semester_id`      | ref → Semester     | [required]                  |                                                             |
| `morality`         | enum               | optional                    | `excellent` / `good` / `average` / `below_average` / `poor` |
| `teacher_note`     | text               | optional                    | Homeroom teacher's narrative for semester                    |
| `is_completed`     | boolean            | optional                    | True = passed this semester                                  |
| `recorded_by`      | ref → Catechist    | optional                    |                                                             |
| `recorded_at`      | timestamp          | optional                    |                                                             |
| `is_deleted`       | boolean            | [required] [default: false] | Soft delete — never hard-delete                              |

Constraint: `(student_class_id, semester_id)` unique — one result per student per semester.

---

#### `AnnualResult` — End-of-Year Evaluation

Written once per student per class year.

| Field              | Type               | Constraints                 | Notes                                                       |
| ------------------ | ------------------ | --------------------------- | ----------------------------------------------------------- |
| `id`               | id                 | [required] [unique]         |                                                             |
| `student_class_id` | ref → StudentClass | [required] [unique]         | One per student per class year                              |
| `conduct_grade`    | enum               | optional                    | `excellent` / `good` / `average` / `below_average` / `poor` |
| `remark`           | text               | optional                    | Homeroom teacher's narrative                                |
| `is_completed`     | boolean            | optional                    | True = passed the year                                      |
| `recorded_by`      | ref → Catechist    | optional                    |                                                             |
| `recorded_at`      | timestamp          | optional                    |                                                             |
| `is_deleted`       | boolean            | [required] [default: false] | Soft delete — never hard-delete                             |
