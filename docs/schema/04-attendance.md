[← Back to index](../README.md)

## 7.4 — Attendance

#### `ClassSession` — Buổi Học

| Field           | Type            | Constraints                 | Notes                                                     |
| --------------- | --------------- | --------------------------- | --------------------------------------------------------- |
| `id`            | id              | [required] [unique]         |                                                           |
| `class_year_id` | ref → ClassYear | [required]                  |                                                           |
| `semester_id`   | ref → Semester  | [required]                  |                                                           |
| `session_date`  | date            | [required]                  |                                                           |
| `session_type`  | enum            | [required]                  | `mass` / `catechism` / `supplemental` / `extracurricular` |
| `is_cancelled`  | boolean         | [required] [default: false] | Excluded from diligence calculation when true             |
| `notes`         | text            | optional                    |                                                           |

---

#### `AttendanceRecord` — Điểm Danh

One record per student per session. Two timestamps to support offline QR scanning.

| Field              | Type               | Constraints            | Notes                                                          |
| ------------------ | ------------------ | ---------------------- | -------------------------------------------------------------- |
| `id`               | id                 | [required] [unique]    |                                                                |
| `session_id`       | ref → ClassSession | [required]             |                                                                |
| `student_class_id` | ref → StudentClass | [required]             |                                                                |
| `status`           | enum               | [required]             | `present` / `excused_absence` / `unexcused_absence` / `late`   |
| `notes`            | text               | optional               |                                                                |
| `recorded_by`      | ref → Catechist    | [required]             |                                                                |
| `device_queued_at` | timestamp          | [required] [immutable] | Actual moment of scan on device — source of truth for presence |
| `synced_at`        | timestamp          | optional               | Server-side receipt time. Null = not yet synced                |

Constraint: `(session_id, student_class_id)` unique — first-write-wins on conflict.
