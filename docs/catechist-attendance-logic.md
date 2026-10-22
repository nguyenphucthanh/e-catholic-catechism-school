[← Back to index](README.md)

## 7. Catechist Attendance Logic

Catechist attendance is tracked separately from student attendance ([Attendance Logic](attendance-logic.md)). Different tables, different targets, different permission rules. Student attendance code never touches these tables.

Source: `convex/catechistAttendance.ts`, `convex/catechistMeetings.ts`, `convex/lib/catechistAttendance.ts`.

### Targets

A record points at **exactly one** target (enforced in `reconcileCatechistAttendanceRecord`, not by the schema):

| Target                              | Field       | Table              | Notes                                                                 |
| ----------------------------------- | ----------- | ------------------ | --------------------------------------------------------------------- |
| Class teaching                      | `sessionId` | `classSessions`    | Only `catechism` / `supplemental` sessions with a `classYearId`       |
| Catechist meeting (Buổi Họp)        | `meetingId` | `catechistMeetings` | Kept out of `classSessions` so student attendance never sees meetings |

`mass` / `extracurricular` sessions are **not** targets — catechists are not tracked there.

### Expected Roster

"Expected" = who should have a record. Drives the `unrecorded` state. Only meaningful for the **active** academic year (see [Locked Years](#locked-years)). Computed in `convex/lib/catechistAttendance.ts`; always deduped and filtered to active, non-deleted catechists.

| Target                  | Expected catechists                                                          | `roleAtSession`                     |
| ----------------------- | ---------------------------------------------------------------------------- | ----------------------------------- |
| Class session           | Live `classCatechists` rows of the session's `classYearId`                   | `homeroom` / `co_teacher`           |
| Meeting, `scope: all`   | All active catechists                                                        | `attendee`                          |
| Meeting, `scope: board` | `academicYearAssignments` of the meeting's year                              | `attendee`                          |
| Meeting, `scope: branch`| `branchAssignments` (branch heads) + catechists teaching in the branch's classes that year | `attendee`           |

A catechist recorded but **not** in the roster (e.g. a stand-in) is returned in `substitutes`. On a class session the default role for them is `substitute`; meetings only allow `attendee` (other roles → `INVALID_ROLE`).

### Statuses

Same four values as students, no extra statuses:

| Status              | Vietnamese      | Counts as attended |
| ------------------- | --------------- | ------------------ |
| `present`           | Có mặt          | yes                |
| `late`              | Trễ             | yes                |
| `excused_absence`   | Vắng có phép    | no                 |
| `unexcused_absence` | Vắng không phép | no                 |

`unset` / `unrecorded` is **not stored** — it is the absence of a live record. UI shows it as grey `Circle`.

**Attendance rate** = `(present + late) / total` over recorded rows only (`computeCatechistAttendanceRate`). `null` when `total = 0`. Unrecorded targets never lower the rate; they are surfaced separately.

### Permission Rules

Resolved in `resolveTarget` (read and write share it). Full matrix: [Permission Matrix](permission-matrix.md).

| Target                       | Who can view / record                                   |
| ---------------------------- | ------------------------------------------------------- |
| Class session                | Class catechist of that `classYear`, branch head of its branch, board, admin |
| Meeting `scope: branch`      | Branch head of that branch, board, admin                |
| Meeting `scope: all` / `board` | Board, admin only                                     |

Reading a catechist's own summary/history: that catechist, or board/admin of the year.

Meeting **visibility** (listing) is wider than recording: `all` is visible to everyone; `board` only to board/admin; `branch` to the branch head and anyone in its expected roster.

### Write Rules

All writes go through `resolveWritableTarget`, then `reconcileCatechistAttendanceRecord`:

- Academic year must be active → else `INACTIVE_ACADEMIC_YEAR`.
- Cancelled session / meeting is not writable → `SESSION_CANCELLED` / `MEETING_CANCELLED`.
- `batchRecordAttendance` rejects duplicate catechists → `DUPLICATE_CATECHIST`.
- Records are **soft-deleted** (`isDeleted`), never removed. A soft-deleted row for the same key is reactivated in place rather than duplicated. Lookups use `firstActive()` (see CLAUDE.md `.first()` rule).

#### Conflict resolution (`checkInMethod`)

| Incoming     | Existing                | Result                                                      |
| ------------ | ----------------------- | ----------------------------------------------------------- |
| `manual`     | anything                | Overwrites status / notes / recordedBy / time               |
| `qr_scan`    | none                    | Inserts                                                     |
| `qr_scan`    | `manual`                | **Never overwrites** — manual is authoritative → `conflict` |
| `qr_scan`    | `qr_scan`               | First-write-wins: replaced only by an earlier `deviceQueuedAt`; otherwise `conflict` |

#### Clearing a record (unset)

- `deleteAttendanceRecord` — soft-deletes one record.
- `updateMeeting({ clearCatechistIds })` — soft-deletes live records atomically with the meeting edit (`clearMeetingRecord`). A catechist id in both `clearCatechistIds` and `attendance` → `CLEAR_OVERLAPS_ATTENDANCE`, nothing written.
- Meeting create/edit form: on **edit**, expected catechists with no saved record start as *unset* and are not saved; choosing *unset* on a saved record clears it on save.

### Recording Flows

| Flow                                   | Where                                   | Method     | Notes                                                             |
| -------------------------------------- | --------------------------------------- | ---------- | ----------------------------------------------------------------- |
| Class session roster                   | `/attendance/catechists`, create-session page (assigned catechists + scan dialog) | `manual` / `qr_scan` | `listRecordableSessions` lists sessions on a date the requester may record |
| Meeting attendance                     | Meeting create / edit form (`attendance` arg, saved with the meeting in one transaction) | `manual` | Any throw rolls back the meeting write too                        |
| QR check-in                            | `/attendance/catechists` QR mode        | `qr_scan`  | **Online only** (no offline queue, unlike students). Scan over a manual record reports a conflict |

Catechist QR payload is JSON `{"type":"catechist","memberId":"..."}` (`src/lib/qr-payload.ts`); student cards are the raw `studentCode`. The student scan page rejects catechist cards with a clear message.

### Locked Years

`catechists.isActive` is global, not per-year, so today's flags would distort the roster of a past year. For an inactive academic year:

- Roster queries return **recorded rows only**; `substitutes` empty; `totalExpected` and `unrecorded` are `null`.
- Summary `unrecorded` is `null`.
- Writes are rejected.

### Summary & History (per catechist)

- `getCatechistAttendanceSummary` → `classTeaching`, `meeting`, `overall` rates + `unrecorded`. Cancelled targets are excluded. `unrecorded` counts targets on or before `asOfDate` (client passes today; queries can't read the clock) where the catechist is expected but has no record. Active year only.
- `listCatechistAttendanceHistory` → date-sorted entries, optional `kind` filter (`class` / `meeting`).

### Yearly Matrix Report

`getYearlyMatrixReport` — catechists × targets for one year. Page: `/reports/catechist-attendance`.

**Access:** admin / board for the whole year; with `branchId`, that branch's head too. A branch head without a `branchId` is defaulted to their first branch in the UI.

**Args:** `academicYearId`, `branchId?`, `fromDate?` / `toDate?` (inclusive `YYYY-MM-DD`, absent = open-ended), `kind?` (`class` | `meeting`, absent = both).

**Targets included:** non-deleted, non-cancelled sessions/meetings within the date range. `kind: 'meeting'` skips class sessions; `kind: 'class'` skips meetings. With `branchId`, board-scope meetings are dropped; year-wide and that branch's meetings are kept.

**Cell values:**

| Cell                  | Meaning                                                                 |
| --------------------- | ----------------------------------------------------------------------- |
| a status              | Live record exists                                                      |
| `unrecorded`          | Expected (assigned to the class, or in the meeting's roster) but no record — absentees from meetings now show up too |
| `null`                | Not applicable / no record                                              |

Rates and totals use **recorded rows only**. Cancelled targets never affect them.

**Limits:** `MATRIX_MAX_TARGETS = 120`, `MATRIX_MAX_CATECHISTS = 100`. Over either → `truncated: true` (earliest targets / first catechists by name kept; totals cover included targets only). Narrow with branch, type, or date range.

#### Report page behaviour (`reports_.catechist-attendance.tsx`)

- **Filters:** branch, type (class session / meeting; default class), date range. Default range = last 3 months, clamped to the selected year's bounds; resets when the year changes.
- **One column per distinct date**, not per target. If several targets share a date, the cell shows the **worst** status (severity: unexcused > excused > unrecorded > late > present). Header and cell tooltips list the target labels.
- Cells use the standard attendance colors/icons from CLAUDE.md (`unrecorded` = grey `Circle`).
- **Export:** CSV = one column per date + rate; PDF = per-status totals + rate only (per-date columns don't fit a page). See `src/lib/export`.

### Related

- Schema: `catechistMeetings`, `catechistAttendanceRecords` in [`convex/schema.ts`](../convex/schema.ts).
- Errors: `CATECHIST_ATTENDANCE_ERRORS`, `CATECHIST_MEETING_ERRORS` in `convex/lib/errors.ts`.
