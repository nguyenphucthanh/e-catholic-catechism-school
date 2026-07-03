[← Back to index](README.md)

## 5. Grading & Assessment Logic

### Score Column Configuration

`ScoreColumn` defines the grading structure per class per semester. `semester_exam` is **not** auto-seeded — a homeroom teacher adds it (or any other column) only when they actually hold that exam. A semester can end with zero, one, or several `semester_exam` columns. There is no `diligence` column type — attendance is displayed as raw status counts rather than a computed score.

`conduct` is **not** a `ScoreColumn` — it is a qualitative annual assessment stored in `AnnualResult`.

### Score Scale Type

Each `ScoreColumn` declares a `scale_type`, chosen by the homeroom teacher when creating the column:

- `scale_10` (default) — numeric score, 0.00–10.00. Matches Vietnamese school convention.
- `pass_fail` — binary judgment (`pass` / `fail`).
- `letter_af` — letter grade (`A`–`F`).

Scale type is set per column, not per class or semester — one exam can be pass/fail while quizzes in the same semester stay numeric.

### Score Entry

`ScoreEntry` stores one score per student per column. Only applies to `short_quiz`, `midterm_test`, and `semester_exam`.

The stored value depends on the parent column's `scale_type`:

- `scale_10` → `score_value` (decimal 0.00–10.00)
- `pass_fail` / `letter_af` → `score_label` (string, validated at the application layer against the allowed values for that scale type)

Only one of the two fields is populated per entry, matching the column's scale type.

### No Cross-Scale Average

Because columns within the same semester can carry different scale types, there is no single "weighted average" that can be computed across them — averaging a `scale_10` score with a `pass_fail` label is not meaningful. **No weighted average is computed or stored, at the semester or year level.** Each column's scores are shown on their own terms. `AnnualResult.is_completed` ("passed the year") remains a manual judgment recorded by the homeroom teacher, not a derived calculation — so this has no effect on year-end completion logic.

### Weight — Removed

The former `weight` field on `ScoreColumn` existed only to feed the weighted-average calculation. Since that calculation no longer exists, `weight` is removed. A teacher who wants to signal relative importance does so through `column_name` (e.g. "Semester Exam (quan trọng)"), not a stored number driving a formula.

### Score Audit Trail

Every modification to a `ScoreEntry` appends a row to `ScoreEntryHistory`, recording the old value, new value, who changed it, and when. This is append-only and immutable.

### Semester Result

`SemesterResult` is written once per student per class enrollment per semester. It stores the homeroom teacher's qualitative assessment for that semester, visible to students and parents.

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

### Annual Result

`AnnualResult` is written once per student per class year. It is the only persisted yearly evaluation record.
