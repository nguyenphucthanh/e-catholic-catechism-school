# System Design: Vietnamese Catholic Religious Education Management

## Trường Giáo Lý / Thiếu Nhi Thánh Thể (TNTT)

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Key Entities & Business Rules](#2-key-entities--business-rules)
3. [Authentication & Access Control](#3-authentication--access-control)
4. [Academic Structure](#4-academic-structure)
5. [Grading & Assessment Logic](#5-grading--assessment-logic)
6. [Attendance Logic](#6-attendance-logic)
7. [Complete Database Schema](#7-complete-database-schema)
8. [Enum Reference](#8-enum-reference)
9. [Key Design Decisions](#9-key-design-decisions)
10. [Indexes & Constraints](#10-indexes--constraints)
11. [Attendance System — QR & Offline-First](#11-attendance-system--qr--offline-first)
12. [Appendix: Table Relationship Summary](#12-appendix-table-relationship-summary)

---

## 1. System Overview

This system manages a single **Đoàn** (parish religious education program) for a Vietnamese Catholic parish. Designed to support both Vietnam-based and overseas (US, Australia, Canada, etc.) TNTT communities with minimal configuration differences.

Core capabilities:

- Student enrollment across branches (ngành) and classes
- Weekly Sunday Mass + catechism attendance via QR card scanning (offline-capable)
- Grade management across a flexible scoring structure
- Sacramental records for students
- Parent/guardian contact management with sibling-family support
- Role-based access for catechists and parents

### Activities Managed

| Activity                                               | Schedule           | Tracked By                     |
| ------------------------------------------------------ | ------------------ | ------------------------------ |
| Sunday Mass                                            | Weekly (Sunday)    | Attendance (QR scan)           |
| Catechism Class                                        | Weekly (Sunday)    | Attendance (QR scan or manual) |
| Supplemental classes (Apostle class, Sacrament review) | Weekdays, optional | Attendance                     |
| Extracurricular (summer camp, training)                | Ad hoc, voluntary  | Attendance (optional)          |

### Multi-Year Support

The system supports **multiple academic years** simultaneously. Historical records (attendance, grades, class assignments) are fully preserved when a student advances through branches. Each academic year runs two semesters.

---

## 2. Key Entities & Business Rules

### Organizational Hierarchy

```
Đoàn (Parish Program)
└── Ngành (Branch) — 6 fixed branches in order:
    ├── Chiên Con      (youngest)
    ├── Ấu Nhi
    ├── Thiếu Nhi
    ├── Nghĩa Sĩ
    ├── Hiệp Sĩ
    └── Dự Trưởng     (oldest / future catechists)
        └── Lớp (Class) — multiple classes per branch per year
```

**Branch leadership:** Each branch has one catechist appointed as `branch_leader` and optionally one as `branch_deputy`. Tracked via `CatechistClass.role`.

**Program leadership (Ban Quản Trị):** Managed via `Catechist.role`. Roles include: Parish Program Director (Xứ Đoàn Trưởng), Deputy Directors, Secretary, Treasurer, and other board members.

### Students

- A student must be enrolled in **exactly one primary class** per academic year.
- A student **may simultaneously enroll** in one or more supplemental classes (e.g., Apostle class, Sacrament class), flagged as `is_primary_class = false` in `StudentClass`.
- A student progresses through branches over multiple years. Full historical records are retained via `StudentClass`.

### Catechists

- A catechist may teach in **multiple classes** simultaneously.
- Within each class, a catechist has a role: `homeroom` (chủ nhiệm) or `co_teacher` (đồng giảng).
- Catechists with `role = branch_leader` or `branch_deputy` can view all classes within their branch.
- Catechists with `role = board` can view all classes in the entire program.

---

## 3. Authentication & Access Control

Authentication uses **member ID + password** (not email). No email-based flows exist.

### Member ID / Student Code Generation

Both `Catechist.member_id` and `Student.student_code` use a **manually incremented counter** as their value. A shared `counters` table holds one row per sequence (`name: 'catechist'` and `name: 'student'`). Each insert atomically reads, increments, and patches the counter row within the same mutation — safe because Convex mutations are serialized.

Display formatting (e.g. zero-padded `000042`) is handled at the UI layer via `id.toString().padStart(6, '0')` — never stored.

This keeps login IDs short and easy to enter on mobile, which is important for the parent audience.

### Account Types

| Account Type      | Login Identifier         | Access Scope                     |
| ----------------- | ------------------------ | -------------------------------- |
| Catechist         | Catechist's `member_id`  | Depends on `Catechist.role`      |
| Parent / Guardian | Student's `student_code` | Read-only: their child's records |

> **Implementation note:** Neither Convex nor Supabase natively supports member-ID authentication. Recommended approach: use `ConvexCredentials` (Convex) with a custom `authorize` function, or synthesize a fake internal email like `{member_id}@internal.giaoly` server-side (Supabase). The `Account` table is the source of truth for credentials.

### Password Management

- **No email reset flow** — passwords are reset by an admin (board-level catechist) via an admin screen.
- **Default password on account creation:** student's date of birth in `DDMMYYYY` format. User should be prompted to change on first login.
- **Account disable:** set `Account.is_active = false`. Blocked users cannot log in regardless of password.

### Catechist Permission Matrix

| `Catechist.role`                  | Can access                                 |
| --------------------------------- | ------------------------------------------ |
| `catechist`                       | Only classes assigned via `CatechistClass` |
| `branch_deputy` / `branch_leader` | All classes within their branch            |
| `board`                           | All classes across all branches            |

---

## 4. Academic Structure

### Academic Year & Semester

- Each year has **2 semesters**.
- Each `AcademicYear` has a `timezone` (IANA string) so that session dates and timestamps are interpreted correctly for both Vietnam and overseas communities.
- Semester start/end dates are **not stored per semester** — the academic year's `start_date` / `end_date` is sufficient. Semester boundaries within a year are managed at the application layer.
- Classes are instantiated per year: the same logical class (e.g., "Ấu Nhi 1") gets a new `ClassYear` record each academic year.
- `ClassYear.class_type` distinguishes primary catechism classes from supplemental ones.

### Class Sessions

Each `ClassSession` record represents one scheduled meeting. The `session_type` field indicates whether it is a Mass, catechism, supplemental, or extracurricular session. Cancelled sessions are flagged `is_cancelled = true` and excluded from diligence calculations.

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
```

Both values are computed at query time. No finalization step required.

### End-of-Year Evaluation

At the end of each academic year, the homeroom teacher records one `AnnualResult` per student:

- `conduct_grade`: overall conduct rating for the year
- `remark`: narrative comment
- `is_completed`: boolean pass/fail

---

## 5. Grading & Assessment Logic

### Score Column Configuration

`ScoreColumn` defines the grading structure per class per semester. Two columns are auto-seeded at semester creation and flagged `is_mandatory = true`: `semester_exam` and `diligence`. These cannot be deleted. All other columns are optional and configurable by the homeroom teacher.

`conduct` is **not** a `ScoreColumn` — it is a qualitative annual assessment stored in `AnnualResult`.

### Score Entry

`ScoreEntry` stores one numeric score per student per column. Only applies to `short_quiz`, `midterm_test`, and `semester_exam`. `diligence` never has `ScoreEntry` rows.

### Score Audit Trail

Every modification to a `ScoreEntry` appends a row to `ScoreEntryHistory`, recording the old value, new value, who changed it, and when. This is append-only and immutable.

### Annual Result

`AnnualResult` is written once per student per class year. It is the only persisted evaluation record. Computed values (`weighted_average`, `diligence_score`) are never stored here.

---

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

Students carry a physical QR card encoding their `student_code`. Catechists scan using the webapp (PWA) on their phone. The full offline-first implementation is documented in **Section 11**.

---

## 7. Complete Database Schema

> **Format note:** Schema is database-agnostic. Logical types: `id` (auto-increment or UUID), `ref → Table` (foreign key), `string` (~200 chars), `text` (unbounded), `enum`, `date`, `timestamp` (with timezone), `decimal`, `boolean`.
>
> Constraints: `[required]`, `[unique]`, `[default: x]`, `[immutable]`, `[computed, never stored]`.

---

### 7.1 — Core Organization

#### `Branch` — Ngành

6 fixed branches, seeded at setup.

| Field         | Type    | Constraints         | Notes                         |
| ------------- | ------- | ------------------- | ----------------------------- |
| `id`          | id      | [required] [unique] |                               |
| `name`        | string  | [required]          | e.g. "Ấu Nhi", "Thiếu Nhi"    |
| `sort_order`  | integer | [required] [unique] | 1 = Chiên Con … 6 = Dự Trưởng |
| `description` | text    | optional            |                               |

---

#### `AcademicYear` — Năm Học

| Field        | Type    | Constraints                              | Notes                                                               |
| ------------ | ------- | ---------------------------------------- | ------------------------------------------------------------------- |
| `id`         | id      | [required] [unique]                      |                                                                     |
| `name`       | string  | [required] [unique]                      | e.g. "2024-2025"                                                    |
| `start_date` | date    | [required]                               |                                                                     |
| `end_date`   | date    | [required]                               |                                                                     |
| `timezone`   | string  | [required] [default: `Asia/Ho_Chi_Minh`] | IANA timezone string e.g. `America/Los_Angeles`, `Australia/Sydney` |
| `is_active`  | boolean | [required] [default: false]              | Only one year active at a time                                      |

---

#### `Semester` — Học Kỳ

| Field              | Type               | Constraints         | Notes               |
| ------------------ | ------------------ | ------------------- | ------------------- |
| `id`               | id                 | [required] [unique] |                     |
| `academic_year_id` | ref → AcademicYear | [required]          |                     |
| `semester_number`  | integer            | [required]          | Only 1 or 2 allowed |
| `name`             | string             | optional            | e.g. "Học Kỳ 1"     |

Constraint: `(academic_year_id, semester_number)` unique. Start/end dates defined at `AcademicYear` level only.

---

#### `Class` — Lớp (year-agnostic template)

| Field         | Type         | Constraints         | Notes           |
| ------------- | ------------ | ------------------- | --------------- |
| `id`          | id           | [required] [unique] |                 |
| `branch_id`   | ref → Branch | [required]          |                 |
| `name`        | string       | [required]          | e.g. "Ấu Nhi 1" |
| `description` | text         | optional            |                 |

---

#### `ClassYear` — Lớp × Năm Học (live instance)

Central anchor for attendance, enrollments, and grading.

| Field              | Type               | Constraints                     | Notes                                                             |
| ------------------ | ------------------ | ------------------------------- | ----------------------------------------------------------------- |
| `id`               | id                 | [required] [unique]             |                                                                   |
| `class_id`         | ref → Class        | [required]                      |                                                                   |
| `academic_year_id` | ref → AcademicYear | [required]                      |                                                                   |
| `class_type`       | enum               | [required] [default: `primary`] | `primary` / `apostle` / `sacrament_review` / `supplemental_other` |

Constraint: `(class_id, academic_year_id)` unique.

---

### 7.2 — Catechists — Giáo Lý Viên

#### `Catechist`

| Field           | Type    | Constraints                       | Notes                                                              |
| --------------- | ------- | --------------------------------- | ------------------------------------------------------------------ |
| `id`            | id      | [required] [unique]               | Convex document id (opaque)                                        |
| `member_id`     | string  | [required] [unique]               | Login identifier — from `counters` sequence, formatted at UI layer |
| `full_name`     | string  | [required]                        |                                                                    |
| `saint_name`    | string  | optional                          | Tên Thánh                                                          |
| `date_of_birth` | date    | optional                          |                                                                    |
| `gender`        | enum    | optional                          | `male` / `female` / `other`                                        |
| `role`          | enum    | [required] [default: `catechist`] | `catechist` / `branch_deputy` / `branch_leader` / `board`          |
| `is_active`     | boolean | [required] [default: true]        |                                                                    |
| `joined_date`   | date    | optional                          |                                                                    |
| `notes`         | text    | optional                          |                                                                    |

---

#### `CatechistAddress`

1-to-1 with `Catechist`. Supports Vietnam and overseas formats.

| Field            | Type            | Constraints                | Notes                                          |
| ---------------- | --------------- | -------------------------- | ---------------------------------------------- |
| `id`             | id              | [required] [unique]        |                                                |
| `catechist_id`   | ref → Catechist | [required] [unique]        |                                                |
| `country`        | string          | [required] [default: `VN`] | ISO 3166-1 alpha-2 e.g. `VN`, `US`, `AU`, `CA` |
| `address_line_1` | text            | optional                   | Street number and name                         |
| `address_line_2` | text            | optional                   | Apartment, unit, suite                         |
| `city`           | string          | optional                   |                                                |
| `state_province` | string          | optional                   | Tỉnh (VN) / State (US, AU) / Province (CA)     |
| `postal_code`    | string          | optional                   |                                                |
| `hamlet`         | string          | optional                   | Giáo Họ — free text, VN context                |
| `sub_hamlet`     | string          | optional                   | Giáo Xóm — free text, VN context               |

---

#### `CatechistContact`

| Field          | Type            | Constraints                 | Notes                                                         |
| -------------- | --------------- | --------------------------- | ------------------------------------------------------------- |
| `id`           | id              | [required] [unique]         |                                                               |
| `catechist_id` | ref → Catechist | [required]                  |                                                               |
| `label`        | string          | [required]                  | e.g. "Personal Phone", "Zalo"                                 |
| `contact_type` | enum            | [required]                  | `phone` / `email` / `zalo` / `other`                          |
| `value`        | string          | [required]                  | When `contact_type = phone`, use E.164 format: `+84901234567` |
| `is_primary`   | boolean         | [required] [default: false] |                                                               |
| `notes`        | text            | optional                    |                                                               |

---

#### `CatechistClass` — Teaching Assignment

| Field           | Type            | Constraints                      | Notes                                              |
| --------------- | --------------- | -------------------------------- | -------------------------------------------------- |
| `id`            | id              | [required] [unique]              |                                                    |
| `catechist_id`  | ref → Catechist | [required]                       |                                                    |
| `class_year_id` | ref → ClassYear | [required]                       |                                                    |
| `role`          | enum            | [required] [default: `homeroom`] | `homeroom` (chủ nhiệm) / `co_teacher` (đồng giảng) |

Constraint: `(catechist_id, class_year_id)` unique.

---

### 7.3 — Students — Học Sinh

#### `Student`

| Field              | Type      | Constraints                | Notes                                                  |
| ------------------ | --------- | -------------------------- | ------------------------------------------------------ |
| `id`               | id        | [required] [unique]        | Convex document id (opaque)                            |
| `student_code`     | string    | [required] [unique]        | Login identifier for parent — from `counters` sequence |
| `full_name`        | string    | [required]                 |                                                        |
| `saint_name`       | string    | optional                   | Tên Thánh                                              |
| `date_of_birth`    | date      | optional                   | Also used as default password: `DDMMYYYY`              |
| `gender`           | enum      | optional                   | `male` / `female` / `other`                            |
| `previous_parish`  | string    | optional                   | Giáo xứ cũ                                             |
| `previous_diocese` | string    | optional                   | Giáo phận cũ                                           |
| `is_active`        | boolean   | [required] [default: true] |                                                        |
| `created_at`       | timestamp | [required] [immutable]     |                                                        |

---

#### `StudentAddress`

1-to-1 with `Student`. Supports Vietnam and overseas formats.

| Field            | Type          | Constraints                | Notes                |
| ---------------- | ------------- | -------------------------- | -------------------- |
| `id`             | id            | [required] [unique]        |                      |
| `student_id`     | ref → Student | [required] [unique]        |                      |
| `country`        | string        | [required] [default: `VN`] | ISO 3166-1 alpha-2   |
| `address_line_1` | text          | optional                   |                      |
| `address_line_2` | text          | optional                   |                      |
| `city`           | string        | optional                   |                      |
| `state_province` | string        | optional                   |                      |
| `postal_code`    | string        | optional                   |                      |
| `hamlet`         | string        | optional                   | Giáo Họ — free text  |
| `sub_hamlet`     | string        | optional                   | Giáo Xóm — free text |

---

#### `Guardian` — Phụ Huynh / Người Bảo Hộ

Independent entity. One `Guardian` record per adult, shared across sibling students.

| Field        | Type   | Constraints         | Notes     |
| ------------ | ------ | ------------------- | --------- |
| `id`         | id     | [required] [unique] |           |
| `full_name`  | string | [required]          |           |
| `saint_name` | string | optional            | Tên Thánh |
| `notes`      | text   | optional            |           |

---

#### `GuardianContact`

Contact entries attached to the guardian, not the student. Updating a number here propagates to all linked children automatically.

| Field          | Type           | Constraints                 | Notes                                                                                                                                                                                                                   |
| -------------- | -------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`           | id             | [required] [unique]         |                                                                                                                                                                                                                         |
| `guardian_id`  | ref → Guardian | [required]                  |                                                                                                                                                                                                                         |
| `contact_type` | enum           | [required]                  | `phone` / `email` / `zalo` / `other`                                                                                                                                                                                    |
| `value`        | string         | [required] [index]          | **Indexed for phone-number lookup.** When `contact_type = phone`, must be E.164: `+[country_code][number]` e.g. `+84901234567`, `+14155552671`. Enforced at application layer; UI should provide a country-code picker. |
| `is_primary`   | boolean        | [required] [default: false] | Preferred contact method for this guardian                                                                                                                                                                              |
| `notes`        | text           | optional                    | e.g. "Call after 5pm"                                                                                                                                                                                                   |

> **Phone lookup flow:** phone number → `GuardianContact.value` → `guardian_id` → `StudentGuardian` → all linked students.

---

#### `StudentGuardian` — Student ↔ Guardian Link

Many-to-many. Enables sibling families and ordered emergency contact lists.

| Field              | Type           | Constraints         | Notes                                                     |
| ------------------ | -------------- | ------------------- | --------------------------------------------------------- |
| `id`               | id             | [required] [unique] |                                                           |
| `student_id`       | ref → Student  | [required]          |                                                           |
| `guardian_id`      | ref → Guardian | [required]          |                                                           |
| `relationship`     | string         | [required]          | `father` / `mother` / `guardian` / free text              |
| `contact_priority` | integer        | [required]          | Call order: 1 = first to contact. Unique per `student_id` |
| `notes`            | text           | optional            | e.g. "custody: weekdays only"                             |

Constraints: `(student_id, guardian_id)` unique. `(student_id, contact_priority)` unique.

---

#### `StudentSacrament`

One row per sacrament per student. Max 4 rows per student.

| Field            | Type          | Constraints         | Notes                                                               |
| ---------------- | ------------- | ------------------- | ------------------------------------------------------------------- |
| `id`             | id            | [required] [unique] |                                                                     |
| `student_id`     | ref → Student | [required]          |                                                                     |
| `sacrament_type` | enum          | [required]          | `baptism` / `first_confession` / `first_communion` / `confirmation` |
| `received_date`  | date          | optional            |                                                                     |
| `received_place` | string        | optional            | Free text: church name, parish                                      |
| `notes`          | text          | optional            |                                                                     |

Constraint: `(student_id, sacrament_type)` unique.

---

#### `StudentClass` — Enrollment Record

| Field                 | Type            | Constraints                    | Notes                                          |
| --------------------- | --------------- | ------------------------------ | ---------------------------------------------- |
| `id`                  | id              | [required] [unique]            |                                                |
| `student_id`          | ref → Student   | [required]                     |                                                |
| `class_year_id`       | ref → ClassYear | [required]                     |                                                |
| `is_primary_class`    | boolean         | [required] [default: true]     | Exactly one primary class per student per year |
| `enrolled_date`       | date            | [required]                     |                                                |
| `status`              | enum            | [required] [default: `active`] | `active` / `on_leave` / `withdrawn`            |
| `status_changed_date` | date            | optional                       | Date of last status change                     |
| `left_date`           | date            | optional                       | Set only when `status = withdrawn`             |

Constraint: `(student_id, class_year_id)` unique.

---

### 7.4 — Attendance

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

---

### 7.5 — Grading

#### `ScoreColumn` — Grade Column Configuration

| Field           | Type            | Constraints                 | Notes                                                                               |
| --------------- | --------------- | --------------------------- | ----------------------------------------------------------------------------------- |
| `id`            | id              | [required] [unique]         |                                                                                     |
| `class_year_id` | ref → ClassYear | [required]                  |                                                                                     |
| `semester_id`   | ref → Semester  | [required]                  |                                                                                     |
| `column_name`   | string          | [required]                  | e.g. "15-min Quiz 1", "Semester Exam"                                               |
| `column_type`   | enum            | [required]                  | `short_quiz` / `midterm_test` / `semester_exam` / `diligence`                       |
| `weight`        | decimal         | optional                    | Null for `diligence`. Defaults: `short_quiz`=1, `midterm_test`=2, `semester_exam`=3 |
| `is_mandatory`  | boolean         | [required] [default: false] | True for `semester_exam` and `diligence` — cannot be deleted                        |
| `sort_order`    | integer         | [required] [default: 0]     |                                                                                     |

---

#### `ScoreEntry` — Individual Score

Only for `short_quiz`, `midterm_test`, `semester_exam`. Never for `diligence`.

| Field              | Type               | Constraints         | Notes        |
| ------------------ | ------------------ | ------------------- | ------------ |
| `id`               | id                 | [required] [unique] |              |
| `student_class_id` | ref → StudentClass | [required]          |              |
| `score_column_id`  | ref → ScoreColumn  | [required]          |              |
| `score`            | decimal            | optional            | 0.00 – 10.00 |
| `entered_by`       | ref → Catechist    | [required]          |              |
| `entered_at`       | timestamp          | [required]          |              |
| `updated_at`       | timestamp          | optional            |              |

Constraint: `(student_class_id, score_column_id)` unique.

---

#### `ScoreEntryHistory` — Score Audit Trail

Append-only. One row per modification to any `ScoreEntry`.

| Field            | Type             | Constraints            | Notes                 |
| ---------------- | ---------------- | ---------------------- | --------------------- |
| `id`             | id               | [required] [unique]    |                       |
| `score_entry_id` | ref → ScoreEntry | [required]             |                       |
| `old_score`      | decimal          | optional               | Null on initial entry |
| `new_score`      | decimal          | optional               |                       |
| `changed_by`     | ref → Catechist  | [required]             |                       |
| `changed_at`     | timestamp        | [required] [immutable] |                       |
| `reason`         | text             | optional               |                       |

---

#### `AnnualResult` — End-of-Year Evaluation

Written once per student per class year. Computed values not stored here.

| Field              | Type               | Constraints         | Notes                                                       |
| ------------------ | ------------------ | ------------------- | ----------------------------------------------------------- |
| `id`               | id                 | [required] [unique] |                                                             |
| `student_class_id` | ref → StudentClass | [required] [unique] | One per student per class year                              |
| `conduct_grade`    | enum               | optional            | `excellent` / `good` / `average` / `below_average` / `poor` |
| `remark`           | text               | optional            | Homeroom teacher's narrative                                |
| `is_completed`     | boolean            | optional            | True = passed the year                                      |
| `recorded_by`      | ref → Catechist    | optional            |                                                             |
| `recorded_at`      | timestamp          | optional            |                                                             |

---

### 7.6 — Authentication

#### `Account`

| Field           | Type      | Constraints                | Notes                                                      |
| --------------- | --------- | -------------------------- | ---------------------------------------------------------- |
| `id`            | id        | [required] [unique]        |                                                            |
| `login_id`      | string    | [required] [unique]        | Catechist → `member_id`; Parent → student's `student_code` |
| `password_hash` | string    | [required]                 | bcrypt or argon2; never plaintext                          |
| `account_type`  | enum      | [required]                 | `catechist` / `student`                                    |
| `user_ref_id`   | id        | [required]                 | Points to `Catechist.id` or `Student.id`                   |
| `is_active`     | boolean   | [required] [default: true] | Set to false to disable login                              |
| `last_login_at` | timestamp | optional                   |                                                            |
| `created_at`    | timestamp | [required] [immutable]     |                                                            |

---

## 8. Enum Reference

| Table              | Column           | Allowed Values                                                   |
| ------------------ | ---------------- | ---------------------------------------------------------------- |
| `ClassYear`        | `class_type`     | `primary`, `apostle`, `sacrament_review`, `supplemental_other`   |
| `Catechist`        | `role`           | `catechist`, `branch_deputy`, `branch_leader`, `board`           |
| `CatechistClass`   | `role`           | `homeroom`, `co_teacher`                                         |
| `CatechistContact` | `contact_type`   | `phone`, `email`, `zalo`, `other`                                |
| `GuardianContact`  | `contact_type`   | `phone`, `email`, `zalo`, `other`                                |
| `StudentSacrament` | `sacrament_type` | `baptism`, `first_confession`, `first_communion`, `confirmation` |
| `StudentClass`     | `status`         | `active`, `on_leave`, `withdrawn`                                |
| `ClassSession`     | `session_type`   | `mass`, `catechism`, `supplemental`, `extracurricular`           |
| `AttendanceRecord` | `status`         | `present`, `excused_absence`, `unexcused_absence`, `late`        |
| `ScoreColumn`      | `column_type`    | `short_quiz`, `midterm_test`, `semester_exam`, `diligence`       |
| `AnnualResult`     | `conduct_grade`  | `excellent`, `good`, `average`, `below_average`, `poor`          |
| `Account`          | `account_type`   | `catechist`, `student`                                           |

---

## 9. Key Design Decisions

### 9.1 Class as Template + ClassYear as Live Instance

`Class` stores the logical identity (e.g. "Ấu Nhi 1") independent of year. `ClassYear` instantiates it per academic year, keeping per-year data cleanly scoped.

### 9.2 Flexible Grading via ScoreColumn

`ScoreColumn` lets each homeroom teacher configure their own grade structure per semester. Two columns (`semester_exam`, `diligence`) are auto-seeded and immutable. `conduct` is annual-only, stored in `AnnualResult`.

### 9.3 Computed-Only Values — No Stored Aggregates

`weighted_average` and `diligence_score` are never persisted — computed on-the-fly from `ScoreEntry` and `AttendanceRecord`. Avoids stale data if scores or attendance are corrected after entry.

### 9.4 Guardian as Independent Entity

`Guardian` is its own entity linked to students via `StudentGuardian`. Solves the sibling problem: one guardian record is shared across multiple children. Phone update propagates automatically. `contact_priority` (integer) replaces a boolean flag — enables ordered emergency contact lists (call father first, then mother, etc.).

### 9.5 Sacraments as Rows

Each sacrament is a separate `StudentSacrament` row. The 4 types are fixed by enum. Adding a new type requires only an enum change.

### 9.6 Address — International Format

Both address tables use `country` (ISO 3166-1 alpha-2, default `VN`) + `address_line_1/2` + `city` + `state_province` + `postal_code`. Vietnam-specific `hamlet` / `sub_hamlet` retained as optional free-text. Works for VN, US, AU, CA without schema changes.

### 9.7 Phone Numbers — E.164 Format

All phone fields use E.164 (`+[country_code][number]`). Enforced at application layer. Ensures consistent lookup in `GuardianContact.value` regardless of how the number was originally typed.

### 9.8 Authentication via Counter-Based ID

`member_id` and `student_code` are derived from a `counters` table (one row per sequence: `'catechist'` and `'student'`). Each insert reads, increments, and patches the counter atomically inside the same Convex mutation — safe because mutations are serialized. No prefix, no race conditions. UI formats with `padStart(6, '0')` for display only. Short IDs are intentional — easy to enter on mobile for less tech-savvy parents.

### 9.9 StudentClass Status Enum

Three states: `active`, `on_leave` (temporary), `withdrawn` (permanent). `left_date` is only set on `withdrawn`. All historical records are preserved regardless of status.

### 9.10 Attendance — Open Permission for Mass

`session_type = mass` allows any active catechist to record any student's attendance, bypassing the usual class-assignment check. This reflects the real-world constraint: 2–3 catechists must scan ~100 students across all classes before Mass begins. Class-level restriction would be impractical.

---

## 10. Indexes & Constraints

### Uniqueness Constraints

| Collection         | Unique on                             | Notes                                         |
| ------------------ | ------------------------------------- | --------------------------------------------- |
| `Account`          | `login_id`                            |                                               |
| `Student`          | `student_code`                        |                                               |
| `Catechist`        | `member_id`                           |                                               |
| `AcademicYear`     | `name`                                |                                               |
| `Semester`         | `(academic_year_id, semester_number)` | Composite                                     |
| `ClassYear`        | `(class_id, academic_year_id)`        | Composite                                     |
| `CatechistAddress` | `catechist_id`                        |                                               |
| `CatechistClass`   | `(catechist_id, class_year_id)`       | Composite                                     |
| `StudentAddress`   | `student_id`                          |                                               |
| `StudentGuardian`  | `(student_id, guardian_id)`           | Composite                                     |
| `StudentGuardian`  | `(student_id, contact_priority)`      | Composite — no duplicate priority per student |
| `StudentClass`     | `(student_id, class_year_id)`         | Composite                                     |
| `StudentSacrament` | `(student_id, sacrament_type)`        | Composite                                     |
| `AttendanceRecord` | `(session_id, student_class_id)`      | Composite                                     |
| `ScoreEntry`       | `(student_class_id, score_column_id)` | Composite                                     |
| `AnnualResult`     | `student_class_id`                    |                                               |

### Query Indexes

| Collection          | Index on                         | Used for                               |
| ------------------- | -------------------------------- | -------------------------------------- |
| `Student`           | `is_active`                      | Filtering active students              |
| `ClassYear`         | `academic_year_id`               | All classes in a year                  |
| `ClassYear`         | `class_id`                       | All year instances of a class          |
| `CatechistClass`    | `catechist_id`                   | All classes a catechist teaches        |
| `CatechistClass`    | `class_year_id`                  | All catechists in a class              |
| `StudentClass`      | `student_id`                     | All enrollments for a student          |
| `StudentClass`      | `class_year_id`                  | All students in a class                |
| `StudentClass`      | `(student_id, is_primary_class)` | Student's primary class                |
| `StudentClass`      | `status`                         | Filter by enrollment status            |
| `StudentGuardian`   | `student_id`                     | All guardians for a student            |
| `StudentGuardian`   | `guardian_id`                    | All students linked to a guardian      |
| `GuardianContact`   | `guardian_id`                    | All contacts for a guardian            |
| `GuardianContact`   | `value`                          | **Phone-number lookup**                |
| `ClassSession`      | `(class_year_id, semester_id)`   | All sessions for a class in a semester |
| `ClassSession`      | `session_date`                   | Sessions by date                       |
| `AttendanceRecord`  | `session_id`                     | All attendance for a session           |
| `AttendanceRecord`  | `student_class_id`               | All attendance for a student           |
| `AttendanceRecord`  | `synced_at`                      | Monitor unsynced offline records       |
| `ScoreColumn`       | `(class_year_id, semester_id)`   | Grade structure for a class semester   |
| `ScoreEntry`        | `student_class_id`               | All scores for a student               |
| `ScoreEntry`        | `score_column_id`                | All scores for a column                |
| `ScoreEntryHistory` | `score_entry_id`                 | Audit trail for a score                |
| `AnnualResult`      | `student_class_id`               | Year-end evaluation                    |
| `StudentSacrament`  | `student_id`                     | All sacraments for a student           |
| `CatechistContact`  | `catechist_id`                   | All contacts for a catechist           |

---

## 11. Attendance System — QR & Offline-First

### 11.1 Overview & Core Constraints

Mass attendance must be **instantaneous** — no acceptable delay between scan and acknowledgement. Network latency cannot block the flow.

| Context   | Sessions                    | Students in scope          | Who scans           | Time pressure |
| --------- | --------------------------- | -------------------------- | ------------------- | ------------- |
| **Class** | `catechism`, `supplemental` | That class only (~25)      | Assigned catechists | Low           |
| **Mass**  | `mass`                      | All active students (~100) | Any catechist       | **High**      |

### 11.2 QR Card Design

- QR encodes only the raw `student_code` (e.g. `10042`). No prefix, no URL, no JSON.
- Physical card: student name + saint name + class + branch printed for visual verification.
- QR minimum size: 2.5 × 2.5 cm. Recommend lanyard hole.
- Lost card: reprint trivially — content never changes.

### 11.3 Technology Stack

| Layer         | Choice                                                   | Reason                                                                    |
| ------------- | -------------------------------------------------------- | ------------------------------------------------------------------------- |
| App delivery  | **PWA** (no native app)                                  | `getUserMedia` + `BarcodeDetector` works on Safari iOS and Chrome Android |
| QR scanning   | Native `BarcodeDetector` API + `@zxing/browser` fallback | BarcodeDetector fast on modern devices; ZXing covers older iOS            |
| Local queue   | **IndexedDB** via `idb` library                          | Persists across reloads and browser close                                 |
| Sync          | Convex mutations, batched                                | Handles retries natively                                                  |
| Offline shell | Service Worker + Web App Manifest                        | App loads with no network                                                 |

### 11.4 IndexedDB Stores

**`attendance_queue`**

| Field              | Notes                               |
| ------------------ | ----------------------------------- |
| `local_id`         | Client-generated UUID (primary key) |
| `session_id`       | Selected before scanning            |
| `student_code`     | Decoded from QR                     |
| `student_class_id` | Resolved from cache                 |
| `status`           | Default `present` for QR scans      |
| `recorded_by`      | Logged-in catechist id              |
| `device_queued_at` | `Date.now()` at scan moment         |
| `sync_status`      | `pending` / `synced` / `conflict`   |

**`student_cache`**

| Field              | Notes                                       |
| ------------------ | ------------------------------------------- |
| `student_code`     | Primary key                                 |
| `student_class_id` | For current session                         |
| `full_name`        | Display after scan                          |
| `saint_name`       | Display after scan                          |
| `class_name`       | Display after scan                          |
| `cached_at`        | For invalidation (refresh if > 2 hours old) |

### 11.5 Flows

**Pre-fetch (before scanning):**

```
1. Catechist selects ClassSession
2. App fetches from Convex:
   - Students in scope + student_code → student_class_id mapping
   - Already-recorded attendance for this session
3. Write all to IndexedDB
4. Signal: "Ready to scan offline"
```

**Scan loop (target < 200ms per student, zero network):**

```
1. Camera active, continuously scanning frames
2. QR decoded → student_code extracted client-side
3. Lookup in IndexedDB student_cache:
   ├─ Found + not yet recorded → write to queue → SUCCESS (green flash + beep + name)
   ├─ Found + already recorded → DUPLICATE (yellow flash + different beep)
   └─ Not found → UNKNOWN (red flash + error beep)
4. Camera auto-resets immediately — no tap needed
```

**Background sync (non-blocking, every 5 seconds while online):**

```
1. Read all sync_status = 'pending' from queue
2. Batch call Convex mutation: attendance:recordBatch(records)
3. On success → update sync_status = 'synced'
4. On conflict → update sync_status = 'conflict', log locally
5. On network error → leave as 'pending', retry next cycle
```

Also triggers immediately on `window.addEventListener('online', syncNow)`.

### 11.6 Conflict Resolution — First-Write-Wins

**Scenario:** Two catechists scan the same student while offline. Both sync. Duplicate inserts arrive for `(session_id, student_class_id)`.

**Rule:** Keep the record with the earlier `device_queued_at`. Discard the later one.

```
for each incoming record:
  existing = query by (session_id, student_class_id)
  if existing:
    if incoming.device_queued_at < existing.device_queued_at:
      replace existing  // earlier scan wins (rare edge case)
    else:
      discard incoming, return { status: 'conflict' }
  else:
    insert, return { status: 'synced' }
```

**Why this is correct:** the student was present — outcome is identical regardless of which device recorded first. Conflicts are benign and fully automatic.

### 11.7 Convex API

**Queries:**

- `attendance:getSessionStudents({ session_id })` — pre-fetch students + existing records
- `attendance:getSessionSummary({ session_id })` — count present / total, unrecorded list

**Mutations:**

- `attendance:recordBatch({ records })` — idempotent, first-write-wins, returns `{ local_id, status }[]`
- `attendance:updateRecord({ session_id, student_class_id, status, notes })` — manual correction
- `attendance:cancelSession({ session_id, reason })` — sets `is_cancelled = true`

**Permission enforcement in each mutation:**

```
mass / extracurricular → any active catechist
catechism / supplemental → assigned catechist OR branch_leader / board
```

### 11.8 Implementation Notes

**Camera setup:**

```javascript
// Primary: native BarcodeDetector
const detector = new BarcodeDetector({ formats: ['qr_code'] })

// Fallback: ZXing
import { BrowserQRCodeReader } from '@zxing/browser'

// Always request rear camera, 1280px width
const stream = await navigator.mediaDevices.getUserMedia({
  video: { facingMode: 'environment', width: 1280 },
})
// Debounce 800ms to prevent double-fire on same QR
```

**IndexedDB setup:**

```javascript
import { openDB } from 'idb'
const db = await openDB('giaoly-attendance', 1, {
  upgrade(db) {
    db.createObjectStore('attendance_queue', { keyPath: 'local_id' })
    db.createObjectStore('student_cache', { keyPath: 'student_code' })
  },
})
```

**PWA manifest minimum:**

- `name`: "Điểm Danh Giáo Lý"
- `display`: `standalone`
- `start_url`: `/attendance`
- `icons`: 192×192 and 512×512 PNG

### 11.9 UX Requirements

- Full-screen camera, minimal UI chrome
- Overlay: session name + date + counter ("47 / 98 đã điểm danh")
- Sync dot: green (all synced) / yellow (pending queue)
- **No tap required between scans** — camera auto-resets
- Offline banner: "Đang lưu offline — sẽ đồng bộ khi có mạng" (non-blocking)
- **Class attendance shortcut:** "Mark all present" button, then catechist marks exceptions only
- Post-session review: unrecorded students list + quick-tap to mark absent

---

## 12. Appendix: Table Relationship Summary

```
AcademicYear ──< Semester
AcademicYear ──< ClassYear >── Class >── Branch

ClassYear ──< CatechistClass >── Catechist
ClassYear ──< StudentClass   >── Student
ClassYear ──< ClassSession

ClassSession ──< AttendanceRecord >── StudentClass
ClassSession ── Semester

Semester ──< ScoreColumn >── ClassYear
ScoreColumn ──< ScoreEntry >── StudentClass
ScoreEntry ──< ScoreEntryHistory

StudentClass ──── AnnualResult          (1-to-1, written once at year end)
  ↑ weighted_average: computed from ScoreEntry        (never stored)
  ↑ diligence_score:  computed from AttendanceRecord  (never stored)

Student ──── StudentAddress             (1-to-1)
Student ──< StudentSacrament
Student ──< StudentGuardian >── Guardian
                                Guardian ──< GuardianContact
                                  (phone lookup: GuardianContact.value → Guardian → StudentGuardian → Student[])

Catechist ──── CatechistAddress         (1-to-1)
Catechist ──< CatechistContact

Account >── Catechist  (when account_type = 'catechist')
Account >── Student    (when account_type = 'student', parent login)
```

---

_Document version: 2.0 — consolidated from giao-ly-db-design.md (v1.4) + attendance-design.md (v1.0). Includes all design decisions from full requirements session._
