[← Back to index](README.md)

## 4. Academic Structure

### Academic Year & Semester

- Each year has **1 to 4 semesters**.
- Each `AcademicYear` has a `timezone` (IANA string) so that session dates and timestamps are interpreted correctly for both Vietnam and overseas communities.
- Semester start/end dates are **not stored per semester** — the academic year's `start_date` / `end_date` is sufficient. Semester boundaries within a year are managed at the application layer.
- Classes are instantiated per year: the same logical class (e.g., "Ấu Nhi 1") gets a new `ClassYear` record each academic year.
- `ClassYear.class_type` distinguishes primary catechism classes from supplemental ones.

### Class Sessions

Each `ClassSession` record represents one scheduled meeting. The `session_type` field indicates whether it is a Mass, catechism, supplemental, or extracurricular session. Cancelled sessions are flagged `is_cancelled = true` and excluded from diligence calculations.

`catechism`/`supplemental` sessions are **class-scoped** (`class_year_id` + `semester_id` set) and feed `diligence_score`. `mass`/`extracurricular` sessions are **parish-scoped** — one row per date for the whole parish, no `class_year_id` — and never feed `diligence_score`. See [Design Decision 9.12](09-design-decisions.md#912-parish-scoped-sessions-for-mass--extracurricular).

### Grade Structure

Grading is **flexible per class per semester**, with two mandatory columns that can never be removed:

| Column Type                       | Mandatory | Weight      | Stored?                     |
| --------------------------------- | --------- | ----------- | --------------------------- |
| `semester_exam`                   | ✅ Yes    | 3 (fixed)   | ✅ `ScoreEntry`             |
| `diligence`                       | ✅ Yes    | —           | ❌ Computed from attendance |
| `short_quiz` (15-minute, hệ số 1) | No        | 1 (default) | ✅ `ScoreEntry`             |
| `midterm_test` (1-tiết, hệ số 2)  | No        | 2 (default) | ✅ `ScoreEntry`             |

Conduct and yearly remarks are recorded once per year in `AnnualResult`, not as semester score columns.

Default recommended structure per semester:

- 2 × `short_quiz` (weight 1)
- 1 × `midterm_test` (weight 2)
- 1 × `semester_exam` (weight 3, mandatory)
- 1 × `diligence` (mandatory, computed on-the-fly)

### Computed Values (never stored)

```
weighted_average = SUM(score × weight) / SUM(weight)
                   over ScoreEntry WHERE column_type IN ('short_quiz','midterm_test','semester_exam')

diligence_score  = COUNT(status IN ('present', 'late'))
                 / COUNT(sessions WHERE is_cancelled = false)
                 × 10
                 -- scoped to ClassSession WHERE class_year_id = <this class>
                 -- i.e. catechism/supplemental only — mass/extracurricular never included
```

Both values are computed at query time. No finalization step required.

Mass/extracurricular attendance is tracked separately as a campaign-style metric (e.g. `mass_attendance_rate`), computed the same way but scoped by date range instead of class — see [9.12](09-design-decisions.md#912-parish-scoped-sessions-for-mass--extracurricular).

### End-of-Year Evaluation

At the end of each academic year, the homeroom teacher records one `AnnualResult` per student:

- `conduct_grade`: overall conduct rating for the year
- `remark`: narrative comment
- `is_completed`: boolean pass/fail
