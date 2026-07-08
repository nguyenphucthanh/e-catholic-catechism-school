[← Back to index](../README.md)

> **Format note:** Schema is database-agnostic. Logical types: `id` (auto-increment or UUID), `ref → Table` (foreign key), `string` (~200 chars), `text` (unbounded), `enum`, `date`, `timestamp` (with timezone), `decimal`, `boolean`.
>
> Constraints: `[required]`, `[unique]`, `[default: x]`, `[immutable]`, `[computed, never stored]`.

## 7.9 — Calendar

#### `CalendarEvent` — Board/Branch/Class-Scoped Schedule Entry

| Field              | Type               | Constraints                  | Notes                                                                 |
| ------------------ | ------------------ | ----------------------------- | ---------------------------------------------------------------------- |
| `id`               | id                 | [required] [unique]           |                                                                        |
| `academic_year_id` | ref → AcademicYear | [required]                    |                                                                        |
| `date`             | date               | [required]                    | ISO date string `YYYY-MM-DD`                                          |
| `liturgical_date`  | string             | optional                      | Free text, e.g. "Chúa Nhật XVII Thường Niên"                          |
| `description`      | text               | [required]                    | Serialized Tiptap/ProseMirror JSON; re-parsed client-side              |
| `severity`         | enum               | [required]                    | `high` / `medium` / `low`                                             |
| `scope`            | enum               | [required]                    | `board` / `branch` / `class` — determines which target field is set    |
| `branch_id`        | ref → Branch       | required iff `scope = branch` |                                                                        |
| `class_year_id`    | ref → ClassYear    | required iff `scope = class`  |                                                                        |
| `created_by`       | ref → Catechist    | [required] [immutable]        |                                                                        |
| `created_at`       | timestamp          | [required] [immutable]        | Unix ms                                                                |
| `updated_by`       | ref → Catechist    | optional                      |                                                                        |
| `updated_at`       | timestamp          | optional                      | Unix ms                                                                |
| `is_deleted`       | boolean            | [required] [default: false]   | Soft delete — never hard-delete                                       |

Constraint: exactly one of `branch_id` / `class_year_id` is set, matching `scope`; both are null when `scope = board`.

### Permission Model (strict same-scope)

- **Create:** requires an assignment matching the event's exact scope for the given academic year — `board_member` for `scope=board`, `branch_head` of `branch_id` for `scope=branch`, class-assigned catechist of `class_year_id` for `scope=class`. A catechist with **no** assignment anywhere cannot create any event. `admin` role bypasses all scope checks and may create at any scope/branch/class.
- **Edit/Delete:** the event's `created_by` owner, `admin`, or any other catechist holding the **same** assignment (peer) at the event's exact scope — e.g. another `branch_head` of the same branch. No cascading down from a higher assignment (a `board_member` cannot edit a `branch`- or `class`-scoped event unless they also hold that specific assignment).
- **Read:** any authenticated catechist sees all `board`-scope events, plus `branch`/`class`-scope events for branches/classes they are assigned to. `admin` sees everything.
- **Academic year lock:** mutations are rejected once `AcademicYear.is_active = false`, consistent with the rest of the app's inactive-year lock.

### Convex APIs (`convex/calendarEvents.ts`)

| Function                      | Type     | Notes                                                                 |
| ------------------------------ | -------- | ---------------------------------------------------------------------- |
| `api.calendarEvents.list`      | query    | `(requesterId, academicYearId, dateFrom, dateTo)` — scoped by permission |
| `api.calendarEvents.get`       | query    | Single event, returns `null` if not found/not visible                  |
| `api.calendarEvents.create`    | mutation | Validates scope/target combo, active year, and scope permission        |
| `api.calendarEvents.update`    | mutation | Owner/admin/same-scope-peer only; `date`/`liturgicalDate`/`description`/`severity` |
| `api.calendarEvents.remove`    | mutation | Soft delete; same permission as `update`                                |
