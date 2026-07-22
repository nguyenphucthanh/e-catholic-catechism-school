[← Back to index](README.md)

## 6. Attendance Logic

### Session Types & Permission Rules

| `session_type`    | Who can record attendance                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------- |
| `mass`            | **Any active catechist** — open permission, no class assignment required                  |
| `extracurricular` | **Any active catechist**                                                                  |
| `catechism`       | Only catechists assigned to that class via `CatechistClass`, or `branch_leader` / `board` |
| `supplemental`    | Only catechists assigned to that class via `CatechistClass`, or `branch_leader` / `board` |

Mass attendance uses open permission because 2–3 catechists must rapidly scan ~100 students across all classes before Mass begins. Class assignment is irrelevant in that context.

`mass`/`extracurricular` sessions are parish-scoped, not tied to any class — one row per date for the whole parish, never pre-created per class. See [Design Decision 9.12](09-design-decisions.md#912-parish-scoped-sessions-for-mass--extracurricular).

### Attendance Statuses

| Status              | Vietnamese      |
| ------------------- | --------------- |
| `present`           | Có mặt          |
| `excused_absence`   | Vắng có phép    |
| `unexcused_absence` | Vắng không phép |
| `late`              | Trễ             |

Attendance is displayed to students and parents as **raw counts** per status, scoped to class sessions (`catechism`, `supplemental`) per semester. `mass`/`extracurricular` attendance is tracked separately as a campaign metric (`mass_attendance_count`).

### Offline-First QR Flow

Students carry a physical QR card encoding their `student_code`. Catechists scan using the webapp (PWA) on their phone. The full offline-first implementation is documented in [Section 11](11-attendance-qr-offline.md).
