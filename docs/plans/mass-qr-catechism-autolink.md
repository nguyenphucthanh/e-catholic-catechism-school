# Plan: Auto-link Mass QR attendance → Catechism attendance

Ticket: auto-record catechism attendance when a student is QR-scanned at Mass.
Each phase is self-contained: run it in a fresh context, read the cited refs first, then run its checklist.

## Settled decisions (from grilling, user-confirmed)

| # | Decision |
|---|----------|
| D1 | Linked catechism status is always `present`. Only link when the Mass record being written is `present` (never for absence marks from `handleSetAbsenceStatus`). |
| D2 | `appConfig.autoLinkCatechismAttendance?: boolean` (unset = `false`). Scan screen has a toggle initialised from config; override is screen state only, never persisted, never written back. Toggle only shown for session type `mass`. |
| D3 | Link targets the student's **primary** active class only (the `studentClassId` the scan already carries; skip if not `isPrimaryClass` or not active). |
| D4 | Catechism session is **auto-created lazily** (first scanned student of a class creates it). Skip if an existing `catechism` session for that class+date is cancelled. |
| D5 | Semester chosen by the scanner on the select step (dropdown, required when toggle on), sent with every record. Server validates it, never searches. |
| D6 | Auto-created session has **only the scanned students' records**. Unscanned students have no record (= unset). |
| D7 | Never modify an existing catechism record (insert only if absent). New records carry `source: 'mass_qr'`. |
| D8 | Any valid catechist may trigger session creation across classes (class-level auth intentionally bypassed for this path). |
| D9 | No backfill, no rollback when Mass record is edited/deleted, no UI filter by `source`. |
| D10 | A link failure/skip must never fail or roll back the Mass record. |

## Phase 0: Documentation discovery (consolidated, already done)

Allowed APIs / refs (verified by read-only discovery):

- `convex/_generated/ai/guidelines.md`: read before any Convex edit.
- `convex/attendance.ts:435` `recordBatch`
  - Args: `records: v.array(v.object({ localId, sessionId, studentClassId, status, notes?, deviceQueuedAt }))`.
  - Returns `Array<{ localId, status: 'synced'|'conflict'|'error', error? }>`.
  - Per-record try/catch (errors become `status:'error'`, never throw).
  - Private helpers: `assertActiveAcademicYear` (l.47), `authCheck` (l.154).
- `convex/lib/attendance.ts:149` `reconcileAttendanceRecord(ctx, {sessionId, studentClassId, status, notes?, recordedBy, deviceQueuedAt, mode, existing?})`.
  - Modes: `overwrite | first_write_wins | error_on_conflict`.
  - No insert-only helper. For link, look up `by_session_id_and_student_class_id` yourself and insert only if no live row.
  - Soft-deleted row exists → reactivation is fine only if D7 still holds (it has no live record); prefer reuse via `first_write_wins`.
- `convex/lib/dbHelpers.ts:9` `firstActive` (required for soft-delete tables, per CLAUDE.md).
- `convex/classSessions.ts:~352` `generateClassSessionsForSemester`: inline insert shape to copy: `{classYearId, semesterId, sessionDate, sessionType, isCancelled:false, isDeleted:false}`. No extractable helper.
- `classSessions.create` does NOT dedupe class-scoped sessions; the existing duplicate check is a client warning via `existsForClassOnDate` (`classSessions.ts:~228`). The auto-create path must dedupe itself.
- Indexes today: `classSessions`: `by_class_year_id_and_semester_id`, `by_session_date`, `by_session_type_and_session_date`, `by_is_deleted`. `attendanceRecords`: `by_session_id_and_student_class_id`, etc.
- `semesters` (schema.ts:48): `academicYearId, semesterNumber, name?, startDate?, isDeleted`; **no `endDate`**. `academicYears.listSemesters({academicYearId})` (`convex/academicYears.ts:79`).
- `isActiveEnrollment` `convex/lib/enrollment.ts:7`.
- appConfig pattern to copy: `git show 994ebf7 --stat` (9 files). Boolean variant: `v.optional(v.boolean())` in schema + `upsert` arg, `?? false` in `get`.
- Frontend:
  - `src/routes/_authenticated/_catechist/attendance.tsx`: select-step JSX l.445-517, `handleStartScanning` l.174, `handleQRScan` l.246 (`enqueueScan` l.324), `handleSetAbsenceStatus` l.~345.
  - `src/lib/offline-db.ts`: `LocalAttendanceRecord` l.14, `enqueueScan` l.101.
  - `src/hooks/use-attendance-sync.ts`: `syncNow` maps records to `recordBatch` and only writes results to IndexedDB. The UI never sees results today.
  - App-config form: `src/components/forms/app-config-form.tsx` zod l.109, defaults l.136, Switch markup l.484-502. `...restValues` flows to `upsert` automatically.
  - Locales: `src/locales/en-US.json` ~l.1428, `vi-VN.json` ~l.1450, keys `appConfig.fields.<name>` (+ `.description`).
  - Select with `items`: `src/components/custom/attendance-summary-report.tsx:474-502`. Semester options memo: `attendance-grid-board.tsx:561-575`.
- Test patterns:
  - Convex: `authedConvexTest(schema, modules)` from `test-utils/authedConvexTest`; see `convex/attendanceQR.test.ts` (`setupTest()`, `recordBatch` at l.125).
  - Route: `-attendance.test.tsx` mocks router/sonner/offline-db/use-attendance-sync/QRScanner. **`useQuery` is not mocked there**, so a new `useQuery` needs mocking (pattern: `-classes_.$id_.sessions_.create.test.tsx:141`).
  - Form: `app-config-form.test.tsx`.

Anti-patterns to avoid:

- `.first()` on soft-delete tables.
- `ctx.db.delete`.
- `.filter()` instead of an index.
- Editing `src/components/ui/*`.
- Radix patterns.
- Inventing semester `endDate`.
- Calling `recordBatch` helpers that are module-private from other files without exporting them.

## Phase 1: Schema + app config (backend data layer)

Implement (copy the 994ebf7 pattern):

1. `convex/schema.ts`
   - `appConfig.autoLinkCatechismAttendance: v.optional(v.boolean())`, commented `// unset = false`.
   - `attendanceRecords.source: v.optional(v.literal('mass_qr'))`.
   - New `classSessions` index `by_class_year_id_and_session_date` on `['classYearId','sessionDate']`.
   - Lint flagged a redundant-prefix index before. If it complains, check prefix overlap with `by_class_year_id_and_semester_id` (shares only `classYearId`; neither is a prefix of the other).
2. `convex/appConfig.ts`: `get` default `?? false`; `upsert` arg `v.optional(v.boolean())`.

Verify:

- `npx tsc --noEmit` / project typecheck passes.
- `grep -n autoLinkCatechismAttendance convex/` shows schema, get, upsert.
- Extend `convex/appConfig.test.ts` (default false; upsert round-trip).

Guard: no data migration; all new fields optional.

## Phase 2: Backend link logic

Implement:

1. New `convex/lib/catechismAutoLink.ts` exporting `linkMassScanToCatechism(ctx, { massSession, studentClassId, semesterId, recordedBy, deviceQueuedAt })` → `{ outcome: 'created'|'exists'|'skipped', reason? }`:
   - Load `studentClass`; skip unless `isActiveEnrollment` and `isPrimaryClass` (D3).
   - Load `classYear`; require `classYear.academicYearId === massSession.academicYearId`.
   - Load `semester`; require not deleted and `semester.academicYearId === classYear.academicYearId`. Else skip `invalid_semester`.
   - Query `classSessions` via the new index with `(classYearId, sessionDate)`, collect, filter `sessionType==='catechism' && !isDeleted`. Cancelled → skip `session_cancelled`.
   - Absent → insert (shape from `generateClassSessionsForSemester`).
   - Look up the record via `by_session_id_and_student_class_id`; if live → `exists`. Else insert `{status:'present', recordedBy, deviceQueuedAt, syncedAt, isDeleted:false, source:'mass_qr'}`. Use `firstActive` if reading by collect.
2. `convex/attendance.ts` `recordBatch`
   - Add per-record arg `catechismLink: v.optional(v.object({ semesterId: v.id('semesters') }))`.
   - After a successful Mass reconcile, if `session.sessionType==='mass' && record.status==='present' && record.catechismLink` → call the helper inside its own try/catch (D10).
   - Return extra optional `catechismLink?: 'created'|'exists'|'skipped'` and `catechismLinkReason?`.
   - Run link only on `synced`; also when the Mass result is `conflict` (re-scan) is a no-op, so skip it.
3. Auth: D8, no class-level check. Active-year check is inherited from the Mass session's year.

Cost note: per linked scan ≈ studentClass + classYear + semester + index read (≤2 rows) + record lookup + insert. Roughly 5 reads/scan, no scans or collects on growing tables.

Tests (via `unit-test-writer`; model on `attendanceQR.test.ts`):

- Creates session + record on first scan.
- Second student of the same class reuses the session (no duplicate session).
- Existing record is untouched (status stays).
- Cancelled session is skipped.
- Non-primary and withdrawn enrollment are skipped.
- Semester of another year is skipped.
- Absence status never links.
- Flag absent → no link.
- Link error does not change Mass result.
- Mass record is unaffected.
- Inactive year is rejected by the existing guard.
- `source === 'mass_qr'` on the created record.

Verify:

- `npm test -- convex/attendanceQR.test.ts convex/lib/catechismAutoLink.test.ts --coverage` ≥75% on touched files.
- `grep -rn "\.first()" convex/lib/catechismAutoLink.ts` empty.

## Phase 3: Offline queue + sync hook

Implement:

1. `src/lib/offline-db.ts`: add optional `catechismSemesterId?: string` to `LocalAttendanceRecord`; extend `enqueueScan` args. **Check whether the IndexedDB store needs a version bump**: optional non-indexed fields normally do not (read the file's schema/version code first).
2. `src/hooks/use-attendance-sync.ts`: map `catechismSemesterId` → `catechismLink: { semesterId }` in the `recordBatch` payload. Aggregate results where `catechismLink === 'skipped'`, show one Sonner warning toast with the reason; on `created` do nothing extra (silent, per D2 "no extra step").
3. Keep hook return shape unchanged (test mocks rely on it).

Tests: extend `offline-db.test.ts` and `use-attendance-sync.test.ts` (payload includes link only when set; skipped result → toast).

Verify: typecheck; `npm test -- src/lib/offline-db.test.ts src/hooks/use-attendance-sync.test.ts`.

## Phase 4: Attendance scan screen (UI)

Implement in `attendance.tsx` (read `shadcn-baseui` skill only if the user asks; follow `src/components/ui` patterns, Base UI):

1. State: `autoLink` (init from `api.appConfig.get`, re-init when config loads, never written back), `semesterId`.
2. Select step (l.445-517), only when `selectedType==='mass'`: shadcn `Switch` in a `Field` for auto-link; when on, a `Select` (with `items`) of `api.academicYears.listSemesters` for the active academic year, required.
3. Pre-select semester: the semester with the greatest `startDate <= selectedDate` (semester 1 has no `startDate`, so treat it as earliest). Else empty. Recompute on date change unless user picked manually after.
4. Disable "Start scanning" when `autoLink && !semesterId`.
5. `handleQRScan` l.324: pass `catechismSemesterId` to `enqueueScan` only when `autoLink` and status is `present`. Do NOT pass it from `handleSetAbsenceStatus`.
6. Short warning text under the toggle when on: "Will create catechism sessions for classes with scanned students on dd/mm".
7. i18n en-US + vi-VN for labels, warning, errors.

Tests: update `-attendance.test.tsx` (mock `useQuery`; toggle hidden for extracurricular; start disabled without semester; scan passes semester id only when on; absence never passes).

Verify: `npm test -- src/routes/_authenticated/_catechist/-attendance.test.tsx --coverage` ≥75% touched; manual run (use `run` skill): scan with toggle on → a class session appears in the class attendance grid with `present`.

## Phase 5: App-config form

Implement (copy `ascensionOnSunday` markup l.484-502): zod boolean, default `?? false`, `Switch` Field with description, en-US + vi-VN `appConfig.fields.autoLinkCatechismAttendance` (+ `.description`). Route needs no change.

Tests: extend `app-config-form.test.tsx` (renders, default off, submit passes value to `upsertMutation`).

Verify: `npm test -- src/components/forms/app-config-form.test.tsx`.

## Phase 6: Final verification

- `npm run lint` + typecheck clean.
- `npm test -- --coverage` on touched files only, each ≥75%.
- `git diff --stat` touches only: schema, appConfig, attendance, lib/catechismAutoLink, classSessions index (schema only), offline-db, sync hook, attendance route, app-config form, locales, tests.
- Anti-pattern greps: no `ctx.db.delete`, no `.first()` in new code, no edits under `src/components/ui/`.
- Regression (AC05): extracurricular scan path unchanged; toggle off → `recordBatch` payload has no `catechismLink`; existing `attendanceQR.test.ts` still green.
- Manual E2E: toggle on → scan 2 students of the same class → exactly one `catechism` session, 2 present records `source:'mass_qr'`; scan same student again → no duplicate; pre-existing record untouched; toggle off → nothing created.

## Known caveats (accepted, surface in PR)

- Server does not block manual duplicate class sessions (client warning only). If a catechist creates a session by hand after QR auto-created one, there will be two. Accepted for now; a server-side dedupe in `classSessions.create` is a separate follow-up.
- Pre-filled default-status rows from manual create are never upgraded by QR (D7).
- Semester pre-select relies on `startDate`; legacy semesters without it need manual pick.
