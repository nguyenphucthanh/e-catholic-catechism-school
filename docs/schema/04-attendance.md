[← Back to index](../README.md)

## 7.4 — Attendance

#### `ClassSession` — Buổi Học

Two scopes, by `session_type`:

- **class-scoped** (`catechism`, `supplemental`) — `class_year_id` + `semester_id` required. One row per class meeting. Attendance is displayed as raw counts per student per semester.
- **parish-scoped** (`mass`, `extracurricular`) — `class_year_id` + `semester_id` are null. **One row per date for the whole parish**, not per class — no more creating N sessions for the same Mass across N classes. `academic_year_id` is set instead. Tracked separately for campaign reporting (see [Design Decision 9.12](../09-design-decisions.md#912-parish-scoped-sessions-for-mass--extracurricular)).

| Field              | Type               | Constraints                 | Notes                                                                      |
| ------------------ | ------------------ | --------------------------- | -------------------------------------------------------------------------- |
| `id`               | id                 | [required] [unique]         |                                                                            |
| `class_year_id`    | ref → ClassYear    | optional                    | Required for `catechism`/`supplemental`; null for `mass`/`extracurricular` |
| `semester_id`      | ref → Semester     | optional                    | Required for `catechism`/`supplemental`; null for `mass`/`extracurricular` |
| `academic_year_id` | ref → AcademicYear | optional                    | Set only for `mass`/`extracurricular`                                      |
| `session_date`     | date               | [required]                  |                                                                            |
| `session_type`     | enum               | [required]                  | `mass` / `catechism` / `supplemental` / `extracurricular`                  |
| `is_cancelled`     | boolean            | [required] [default: false] | Excluded from attendance counts when true                               |
| `notes`            | text               | optional                    |                                                                            |
| `is_deleted`       | boolean            | [required] [default: false] | Soft delete — never hard-delete                                            |

---

#### `AttendanceRecord` — Điểm Danh

One record per student per session. `student_class_id` always points at the student's **primary** `StudentClass` for the relevant academic year — for class-scoped sessions that's the obvious class; for parish-scoped sessions (mass, extracurricular) the session itself has no class, so it's resolved via the student's primary enrollment instead. Two timestamps to support offline QR scanning.

| Field              | Type               | Constraints                 | Notes                                                          |
| ------------------ | ------------------ | --------------------------- | -------------------------------------------------------------- |
| `id`               | id                 | [required] [unique]         |                                                                |
| `session_id`       | ref → ClassSession | [required]                  |                                                                |
| `student_class_id` | ref → StudentClass | [required]                  |                                                                |
| `status`           | enum               | [required]                  | `present` / `excused_absence` / `unexcused_absence` / `late`   |
| `notes`            | text               | optional                    |                                                                |
| `recorded_by`      | ref → Catechist    | [required]                  |                                                                |
| `device_queued_at` | timestamp          | [required] [immutable]      | Actual moment of scan on device — source of truth for presence |
| `synced_at`        | timestamp          | optional                    | Server-side receipt time. Null = not yet synced                |
| `is_deleted`       | boolean            | [required] [default: false] | Soft delete — never hard-delete                                |

Constraint: `(session_id, student_class_id)` unique — first-write-wins on conflict.
