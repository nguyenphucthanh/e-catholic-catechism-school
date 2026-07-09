# Print QR Attendance Card — Design

## Problem

Catechists need a physical card per student, showing a QR code the existing
scanning app already reads to check in attendance. Cards must be printable
in bulk on A4 paper for hand-cutting.

## Scope

Card generation + printing only. The QR-scanning attendance-checkin app
already exists and is out of scope.

## Card Design

- **Size:** CR80 standard ID-card size, portrait, 54mm × 85.6mm.
- **Layout (approved via visual mockup, option "C"):**
  - Top: troop name (`appConfig.troopName`, optional) + parish name
    (`appConfig.parishName`, required), centered.
  - Center: QR code.
  - Bottom: student full name (`student.fullName`) + student code
    (`student.studentCode`), centered.
- No student photo.

## QR Payload

Raw `studentCode` string — the same identifier the scanning app already
resolves against manual/other lookups. No new backend field, no opaque
internal `_id` exposed.

## A4 Sheet Layout

- A4 portrait, 3 columns × 3 rows = 9 cards per sheet
  (3×54mm = 162mm ≤ 210mm width; 3×85.6mm = 257mm ≤ 297mm height).
- Thin dashed cut-guide lines between cards, ~5mm sheet margins.
- Auto-paginates across multiple A4 sheets when more than 9 students are
  selected.
- Built with `pdfmake` (already a project dependency) via a custom doc
  definition, using pdfmake's native `{ qr: <text>, fit: <size> }` content
  node — no new QR library needed.

## Entry Points (4)

1. **Class details page** — new header "Print cards" button opens a
   select-students dialog (all/part of the class roster) → generates PDF
   sheet(s) for the selected students.
2. **Class details page → students table row action** — new "Print card"
   item in the existing row dropdown menu → generates a single-student PDF
   directly (no dialog).
3. **Student detail page** — new header "Print card" button → single-student
   PDF directly, same as above.
4. **Outer (global) students list page** — same two additions: a row-action
   "Print card" (single) and a header "Print cards" button opening the same
   bulk select-students dialog, sourced from the full student list instead of
   a class roster. Troop/parish still come from the global `appConfig`.

## Implementation Notes

- **New file:** `src/lib/export/qr-card-pdf.ts` — `buildQrCardsPdfDocDefinition(students, appConfig)` and `exportQrCardsPdf(...)`, mirroring the existing patterns in `src/lib/export/pdf.ts`.
- **New file:** `src/components/forms/print-cards-dialog.tsx` — bulk student
  picker, cloned from the existing checkbox-list pattern in
  `src/components/forms/bulk-update-sacrament-dialog.tsx` (select-all +
  per-student checkboxes, tanstack-form `studentIds` field).
- **Wiring:** add the button/menu-item at the 4 entry points identified above:
  - `src/routes/_authenticated/_catechist/classes_.$id.tsx` (header button +
    row dropdown item, following the existing export-button pattern around
    line 445 and row-action dropdown around line 350).
  - `src/routes/_authenticated/_catechist/students_.$id.tsx` (header button,
    alongside existing Attendance/Edit buttons).
  - `src/routes/_authenticated/_catechist/students.tsx` (header button + row
    dropdown item).
- **No schema/backend changes.** All required fields (`studentCode`,
  `fullName`, `saintName`, `appConfig.troopName`, `appConfig.parishName`)
  are already fetched by the existing queries used on these pages.
- **i18n:** add English + Vietnamese strings for new labels/buttons per
  existing convention.
- **Tests:** unit tests for `qr-card-pdf.ts` (pure doc-definition builder)
  and `print-cards-dialog.tsx`, via the `unit-test-writer` agent, per
  CLAUDE.md's 75% coverage requirement for files touched by this task.
