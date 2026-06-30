[← Back to index](../README.md)

## 7.5 — Grading

#### `ScoreColumn` — Grade Column Configuration

| Field           | Type            | Constraints                 | Notes                                                                               |
| --------------- | --------------- | --------------------------- | ----------------------------------------------------------------------------------- |
| `id`            | id              | [required] [unique]         |                                                                                     |
| `class_year_id` | ref → ClassYear | [required]                  |                                                                                     |
| `semester_id`   | ref → Semester  | [required]                  |                                                                                     |
| `column_name`   | string          | [required]                  | e.g. "15-min Quiz 1", "Semester Exam"                                               |
| `column_type`   | enum            | [required]                  | `short_quiz` / `midterm_test` / `semester_exam` / `diligence`                       |
| `weight`        | decimal         | optional                    | Null for `diligence`. Defaults: `short_quiz`=1, `midterm_test`=2, `semester_exam`=3 |
| `is_mandatory`  | boolean         | [required] [default: false] | True for `semester_exam` and `diligence` — cannot be deleted                        |
| `sort_order`    | integer         | [required] [default: 0]     |                                                                                     |

---

#### `ScoreEntry` — Individual Score

Only for `short_quiz`, `midterm_test`, `semester_exam`. Never for `diligence`.

| Field              | Type               | Constraints         | Notes        |
| ------------------ | ------------------ | ------------------- | ------------ |
| `id`               | id                 | [required] [unique] |              |
| `student_class_id` | ref → StudentClass | [required]          |              |
| `score_column_id`  | ref → ScoreColumn  | [required]          |              |
| `score`            | decimal            | optional            | 0.00 – 10.00 |
| `entered_by`       | ref → Catechist    | [required]          |              |
| `entered_at`       | timestamp          | [required]          |              |
| `updated_at`       | timestamp          | optional            |              |

Constraint: `(student_class_id, score_column_id)` unique.

---

#### `ScoreEntryHistory` — Score Audit Trail

Append-only. One row per modification to any `ScoreEntry`.

| Field            | Type             | Constraints            | Notes                 |
| ---------------- | ---------------- | ---------------------- | --------------------- |
| `id`             | id               | [required] [unique]    |                       |
| `score_entry_id` | ref → ScoreEntry | [required]             |                       |
| `old_score`      | decimal          | optional               | Null on initial entry |
| `new_score`      | decimal          | optional               |                       |
| `changed_by`     | ref → Catechist  | [required]             |                       |
| `changed_at`     | timestamp        | [required] [immutable] |                       |
| `reason`         | text             | optional               |                       |

---

#### `AnnualResult` — End-of-Year Evaluation

Written once per student per class year. Computed values not stored here.

| Field              | Type               | Constraints         | Notes                                                       |
| ------------------ | ------------------ | ------------------- | ----------------------------------------------------------- |
| `id`               | id                 | [required] [unique] |                                                             |
| `student_class_id` | ref → StudentClass | [required] [unique] | One per student per class year                              |
| `conduct_grade`    | enum               | optional            | `excellent` / `good` / `average` / `below_average` / `poor` |
| `remark`           | text               | optional            | Homeroom teacher's narrative                                |
| `is_completed`     | boolean            | optional            | True = passed the year                                      |
| `recorded_by`      | ref → Catechist    | optional            |                                                             |
| `recorded_at`      | timestamp          | optional            |                                                             |
