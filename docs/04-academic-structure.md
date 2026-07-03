[← Back to index](README.md)

## 4. Academic Structure

### Academic Year & Semester

- Each year has **1 to 4 semesters**.
- Each `AcademicYear` has a `timezone` (IANA string) so that session dates and timestamps are interpreted correctly for both Vietnam and overseas communities.
- Semester start/end dates are **not stored per semester** — the academic year's `start_date` / `end_date` is sufficient. Semester boundaries within a year are managed at the application layer.
- Classes are instantiated per year: the same logical class (e.g., "Ấu Nhi 1") gets a new `ClassYear` record each academic year.
- `ClassYear.class_type` distinguishes primary catechism classes from supplemental ones.

### Class Sessions

Each `ClassSession` record represents one scheduled meeting. The `session_type` field indicates whether it is a Mass, catechism, supplemental, or extracurricular session. Cancelled sessions are flagged `is_cancelled = true`.

`catechism`/`supplemental` sessions are **class-scoped** (`class_year_id` + `semester_id` set). `mass`/`extracurricular` sessions are **parish-scoped** — one row per date for the whole parish, no `class_year_id` — and never tied to a specific class. See [Design Decision 9.12](09-design-decisions.md#912-parish-scoped-sessions-for-mass--extracurricular).

### Grade Structure

Grading is **flexible per class per semester**, with one mandatory column that can never be removed:

| Column Type                       | Mandatory | Stored?                     |
| --------------------------------- | --------- | --------------------------- |
| `semester_exam`                   | ✅ Yes    | ✅ `ScoreEntry`             |
| `short_quiz` (15-minute, hệ số 1) | No        | ✅ `ScoreEntry`             |
| `midterm_test` (1-tiết, hệ số 2)  | No        | ✅ `ScoreEntry`             |

There is no `diligence` score column — diligence is not stored or computed as a numeric score. Instead, attendance is displayed as **raw counts** of each status (`present`, `late`, `excused_absence`, `unexcused_absence`) per student per semester, computed from `AttendanceRecord`.

Conduct and yearly remarks are recorded once per year in `AnnualResult`. Morality and teacher notes are recorded **per semester** in `SemesterResult`.

Default recommended structure per semester:

- 2 × `short_quiz` (weight 1)
- 1 × `midterm_test` (weight 2)
- 1 × `semester_exam` (weight 3, mandatory)

### Attendance Display (replaces diligence_score)

Instead of a calculated diligence score, attendance is shown as a summary of raw counts:

```
present: COUNT(status = 'present' AND session_type IN ('catechism','supplemental'))
late: COUNT(status = 'late' AND session_type IN ('catechism','supplemental'))
excused_absence: COUNT(status = 'excused_absence' AND session_type IN ('catechism','supplemental'))
unexcused_absence: COUNT(status = 'unexcused_absence' AND session_type IN ('catechism','supplemental'))

-- scoped to ClassSession WHERE class_year_id = <this class>
-- i.e. catechism/supplemental only — mass/extracurricular never included
-- Cancelled sessions (is_cancelled = true) are excluded
```

Mass/extracurricular attendance is tracked separately as a campaign-style metric (e.g., `mass_attendance_count`), computed the same way but scoped by date range instead of class — see [9.12](09-design-decisions.md#912-parish-scoped-sessions-for-mass--extracurricular).

### Per-Semester Evaluation

At the end of each semester, the homeroom teacher records one `SemesterResult` per student:

- `morality`: overall morality assessment for the semester (`excellent` / `good` / `average` / `below_average` / `poor`)
- `teacher_note`: narrative comment visible to students and parents
- `is_completed`: boolean pass/fail

### End-of-Year Evaluation

At the end of each academic year, the homeroom teacher records one `AnnualResult` per student:

- `conduct_grade`: overall conduct rating for the year
- `remark`: narrative comment
- `is_completed`: boolean pass/fail
