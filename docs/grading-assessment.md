[← Back to index](README.md)

## 5. Grading & Assessment Logic

### Score Column Configuration

`ScoreColumn` defines the grading structure per class per semester. `semester_exam` is **not** auto-seeded — a homeroom teacher adds it (or any other column) only when they actually hold that exam. A semester can end with zero, one, or several `semester_exam` columns. Attendance is displayed as raw status counts rather than a computed score.

`conduct` is **not** a `ScoreColumn` — it is a qualitative annual assessment stored in `AnnualResult`.

### Score Scale Type

Each `ScoreColumn` declares a `scale_type`, chosen by the homeroom teacher when creating the column:

- `scale_10` (default) — numeric score, 0.00–10.00. Matches Vietnamese school convention.
- `pass_fail` — binary judgment (`pass` / `fail`).
- `letter_af` — letter grade (`A`–`F`).

Scale type is set per column, not per class or semester — one exam can be pass/fail while quizzes in the same semester stay numeric.

### Score Column Weight

Each `ScoreColumn` also declares a `weight` (integer, 1–3, default 1), regardless of `scale_type`. Weight only affects the semester-average calculation below; it has no effect on `pass_fail` / `letter_af` columns since those aren't averaged.

### Exam Date

Each `ScoreColumn` may optionally declare an `examDate` (ISO date string) — the date the exam was held. Purely informational, shown alongside the column header in the score grid board; not used in any average calculation.

### Semester / Annual Average (computed, not stored)

Averages are calculated purely client-side from existing `ScoreColumn`/`ScoreEntry` data — there is no `SemesterAvg` or `AnnualAvg` field or table. See `src/lib/grading.ts`.

- **Semester average**: weighted mean of a student's `scale_10` scores in that semester — `Σ(score × weight) / Σ(weight)`, using only columns where the student has an entered `scoreValue`. Computes with as few as **1** entered `scale_10` score; only shows `—` when there are none.
- **Annual average**: simple (unweighted) mean of the semester averages. Requires **every** semester in the academic year to already have a computed semester average; if any semester is missing an average, the annual average is not shown (`—`).

The annual average column in the score grid board is only shown when the semester filter is set to "All" (it's meaningless when scoped to a single semester).

Displayed in the score grid board (per-semester and annual columns) and in the student's enrollment summary (grading tab and semester/year tab).

### Score Entry

`ScoreEntry` stores one score per student per column. Only applies to `short_quiz`, `midterm_test`, and `semester_exam`.

The stored value depends on the parent column's `scale_type`:

- `scale_10` → `score_value` (decimal 0.00–10.00)
- `pass_fail` / `letter_af` → `score_label` (string, validated at the application layer against the allowed values for that scale type)

Only one of the two fields is populated per entry, matching the column's scale type.

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
| `teacher_note`     | text               | optional                    | Homeroom teacher's narrative for semester                   |
| `is_completed`     | boolean            | optional                    | True = passed this semester                                 |
| `recorded_by`      | ref → Catechist    | optional                    |                                                             |
| `recorded_at`      | timestamp          | optional                    |                                                             |
| `is_deleted`       | boolean            | [required] [default: false] | Soft delete — never hard-delete                             |

Constraint: `(student_class_id, semester_id)` unique — one result per student per semester.

### Annual Result

`AnnualResult` is written once per student per class year. It is the only persisted yearly evaluation record.
