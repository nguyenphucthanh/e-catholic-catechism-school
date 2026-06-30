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
