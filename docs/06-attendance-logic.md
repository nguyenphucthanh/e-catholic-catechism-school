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

### Attendance Statuses

| Status              | Vietnamese      | Counts toward diligence? |
| ------------------- | --------------- | ------------------------ |
| `present`           | Có mặt          | ✅ Yes                   |
| `excused_absence`   | Vắng có phép    | ❌ No                    |
| `unexcused_absence` | Vắng không phép | ❌ No                    |
| `late`              | Trễ             | ✅ Yes                   |

### Offline-First QR Flow

Students carry a physical QR card encoding their `student_code`. Catechists scan using the webapp (PWA) on their phone. The full offline-first implementation is documented in [Section 11](11-attendance-qr-offline.md).
