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

`catechism`/`supplemental` sessions are **class-scoped** (`class_year_id` + `semester_id` set). `mass`/`extracurricular` sessions are **parish-scoped** — one row per date for the whole parish, no `class_year_id` — and never tied to a specific class. See [Design Decision 9.12](design-decisions.md#912-parish-scoped-sessions-for-mass-extracurricular).

### Attendance Display

Attendance is shown as a summary of raw counts per status per semester:

```
present: COUNT(status = 'present' AND session_type IN ('catechism','supplemental'))
late: COUNT(status = 'late' AND session_type IN ('catechism','supplemental'))
excused_absence: COUNT(status = 'excused_absence' AND session_type IN ('catechism','supplemental'))
unexcused_absence: COUNT(status = 'unexcused_absence' AND session_type IN ('catechism','supplemental'))

-- scoped to ClassSession WHERE class_year_id = <this class>
-- i.e. catechism/supplemental only — mass/extracurricular never included
-- Cancelled sessions (is_cancelled = true) are excluded
```

Mass/extracurricular attendance is tracked separately as a campaign-style metric (e.g., `mass_attendance_count`), computed the same way but scoped by date range instead of class — see [Design Decision 9.12](design-decisions.md#912-parish-scoped-sessions-for-mass-extracurricular).

### Grading & Evaluation Milestones

- **Continuous Assessment:** Configured per class per semester via `ScoreColumn` (`short_quiz`, `midterm_test`, `semester_exam`).
- **Per-Semester Evaluation (`SemesterResult`):** Qualitative evaluation recorded per student per semester (`morality`, narrative `teacher_note`, and semester `is_completed`).
- **End-of-Year Evaluation (`AnnualResult`):** Yearly summary rating recorded per student (`conduct_grade`, narrative `remark`, and annual `is_completed`).

For detailed score scale configurations, weighting, average calculations, and the full schema, see **[Grading & Assessment Logic](grading-assessment.md)**.
