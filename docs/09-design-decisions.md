[← Back to index](README.md)

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

**Library: `libphonenumber-js`** (npm package). Use for all phone validation and formatting:

```ts
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js'

// Validate
isValidPhoneNumber(value) // returns boolean

// Parse and get E.164
const phone = parsePhoneNumber(value)
phone.format('E.164') // e.g. "+84901234567"
phone.isValid() // boolean
```

- **Validate** with `isValidPhoneNumber(value)` — accepts international format with leading `+`
- **Normalize to E.164** with `parsePhoneNumber(value).format('E.164')` before storing
- Do NOT store raw user input — always normalize first
- UI hint: `+84901234567` (include country code)

### 9.8 Authentication via Counter-Based ID

`member_id` and `student_code` are derived from a `counters` table (one row per sequence: `'catechist'` and `'student'`). Each insert reads, increments, and patches the counter atomically inside the same Convex mutation — safe because mutations are serialized. No prefix, no race conditions. UI formats with `padStart(6, '0')` for display only. Short IDs are intentional — easy to enter on mobile for less tech-savvy parents.

### 9.9 StudentClass Status Enum

Three states: `active`, `on_leave` (temporary), `withdrawn` (permanent). `left_date` is only set on `withdrawn`. All historical records are preserved regardless of status.

### 9.10 Attendance — Open Permission for Mass

`session_type = mass` allows any active catechist to record any student's attendance, bypassing the usual class-assignment check. This reflects the real-world constraint: 2–3 catechists must scan ~100 students across all classes before Mass begins. Class-level restriction would be impractical.

### 9.11 Soft Delete via isDeleted

Every entity table (everything except `ScoreEntryHistory` and `counters`) carries an `is_deleted` boolean, default `false`. Deletion is always a flag flip, never a row removal — preserves all foreign-key relationships and historical records (attendance, grades, enrollment history) even after a student, catechist, class, etc. is "deleted" from the UI. Queries that list active records must filter `is_deleted = false`; queries resolving historical references (e.g. an old `AttendanceRecord.recordedBy`) should still resolve through soft-deleted rows. `ScoreEntryHistory` is excluded because it is already append-only and immutable; `counters` is excluded because it's an internal sequence, not user data.

### 9.12 Parish-Scoped Sessions for Mass / Extracurricular

**Problem:** `ClassSession` originally required `class_year_id`, which forced one row per class for the same physical Mass — Mass happens once for the whole parish, not once per class. Admins had to pre-create N sessions (one per active class) before every Mass, including ad-hoc weekday Masses with no class meeting at all.

**Fix:** `ClassSession.class_year_id` and `semester_id` are now optional, required only for class-scoped types (`catechism`, `supplemental`). For parish-scoped types (`mass`, `extracurricular`), they're null and `academic_year_id` is set instead — **one row per date for the whole parish**, regardless of how many classes exist.

- `AttendanceRecord.student_class_id` still resolves to a real `StudentClass`, but for parish-scoped sessions it's the student's **primary** class for the active year, looked up at scan time — not derived from the session (which has none).
- `diligence_score` is unaffected structurally: it only ever sums sessions where `class_year_id` matches the class in question, so parish-scoped rows (which have no `class_year_id`) were never eligible. Documented explicitly in [Section 4](04-academic-structure.md#computed-values-never-stored) to avoid ambiguity.
- Mass/extracurricular attendance gets its own non-stored campaign metric (`mass_attendance_rate`), computed the same shape as diligence but scoped by date range instead of class — answers "how many Masses did this student attend this month" without touching any class enrollment.
- Scanning no longer requires an admin to pre-create a session: the attendance mutation does a find-or-create on `(session_type, session_date)` via the `by_session_type_and_session_date` index, so the first scan of the day opens the session automatically.

### 9.13 Immutable Past Academic Years

Only one `AcademicYear` can be active. When a year becomes inactive (year closed, next year starts), all data scoped to that year is **locked for editing** — no modifications to classes, enrollments, grades, or attendance records. This prevents accidental corruption of historical data and satisfies audit compliance requirements. Enforcement happens at the mutation layer: all mutations operating on year-scoped entities must verify `academic_year.is_active = true` before allowing writes.

### 9.15 Catholic Naming Convention — Saint Name Precedes Full Name

As a Catholic application, any person with a `saintName` must display it in front of their `fullName` in all UI contexts. This follows the Vietnamese Catholic convention: "Maria Nguyễn Văn A" rather than "Nguyễn Văn A (Maria)".

- **Display everywhere:** Always render `saintName` + `fullName` as a single combined string (`${saintName} ${fullName}`) when saintName exists, otherwise just `fullName`.
- **Edit forms:** The `saintName` field always appears before the `fullName` field in form layouts.
- **Separate field retained:** `saintName` is still stored as its own column — it remains independently editable. Only the visual presentation combines them.
- **Utility:** Use `formatPersonName(saintName, fullName)` from `src/lib/name.ts` for consistent formatting.

### 9.14 Inactive Year Alert — Page-Level, Not Global

UI alerts warning that an academic year is locked should appear **on pages viewing year-scoped data only**, not globally. Examples: classes list/detail, grades, assignments, attendance. Pages that are **never** year-scoped (e.g., catechist profiles, branch settings) do not show the alert.

**Why:** Global alerts based on the year selector in context create false warnings. A user browsing catechists (which have no year scope) would see an inactive-year warning and be confused. Alerts must reflect the data on the current page, not a global selection.

**Implementation:** Use `InactiveYearAlert` component directly on pages that are year-scoped. Pass the academic year ID from page props or data context, not from global selection context. This ensures the alert only shows when the viewed data is actually restricted.
