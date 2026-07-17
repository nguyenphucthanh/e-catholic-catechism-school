[← Back to index](README.md)

## 18. Calendar Management

Tracks JIRA KAN-224. Lets catechists manage schedule/liturgical events scoped to the whole program (board), a branch, or a class.

### Event Fields

| Field             | Notes                                                                 |
| ------------------ | ---------------------------------------------------------------------- |
| `academic_year_id` | Event belongs to one academic year                                    |
| `date`             | ISO date                                                               |
| `end_date`         | Optional, inclusive last day; absent = single-day event                |
| `start_time`       | Optional `HH:mm`; absent = all-day event                               |
| `end_time`         | Optional `HH:mm`; set iff `start_time` set                             |
| `liturgical_date`  | Optional free text, e.g. "Chúa Nhật XVII Thường Niên"                 |
| `description`      | Rich text (Tiptap editor), stored as serialized JSON                   |
| `severity`         | `high` / `medium` / `low`                                              |
| `scope`            | `board` / `branch` / `class` — see schema for `branch_id`/`class_year_id` rules |

Full schema: [7.9 Calendar](schema/09-calendar.md).

### Permission Model — Strict Same-Scope

Unlike most of the app, calendar permissions do **not** cascade down the assignment hierarchy (board_member → branch_head → class_catechist). A catechist can only create/edit events at the exact scope of their own assignment:

| Assignment          | Can create/edit events at scope | Cannot                                                          |
| -------------------- | -------------------------------- | ----------------------------------------------------------------- |
| `board_member`       | `board`                          | `branch` or `class` events, even though board_member outranks them |
| `branch_head`        | `branch` (own branch only)       | `class` events within their branch, or other branches' events     |
| class-assigned catechist | `class` (own class only)     | events for other classes, or their branch's events                |
| No assignment        | none                              | Cannot create any event                                            |
| `admin`              | any scope, any branch/class      | —                                                                   |

**Editing an existing event:** allowed for the event's owner (`created_by`), `admin`, or any other catechist holding the *same* scope+target assignment (e.g. a co-branch_head of the same branch). This is deliberately narrower than other app features — see [Design Decision](09-design-decisions.md) if one is added for calendar-specific rules.

### Visibility

Any authenticated catechist can query events for a date range:

- All `board`-scope events are visible to everyone.
- `branch`-scope events are visible only to catechists assigned (branch_head) to that branch.
- `class`-scope events are visible only to catechists assigned to that class.
- `admin` sees everything, unfiltered.

### Academic Year Lock

Calendar events follow the same inactive-year lock as the rest of the app ([Section 4](04-academic-structure.md)): once `AcademicYear.is_active = false`, no create/edit/delete is allowed for events in that year.

### Convex APIs

See [7.9 Calendar — Convex APIs](schema/09-calendar.md#convex-apis-convexcalendareventsts) for the full function list (`convex/calendarEvents.ts`).
