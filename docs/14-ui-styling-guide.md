[← Back to index](README.md)

## 14. UI Styling Guide

### 14.0 Important Rules

- Shadcn comes with BaseUI under the hood, not radix.
- **Never edit files in `src/components/ui/`** — these are shadcn-generated base components. Fix type/usage mismatches at the call site instead. If a base component genuinely needs changing, regenerate/update it via shadcn CLI, don't hand-edit.


### 14.1 UI Development Rules

- Shadcn as first choice. Use shadcn MCP to find components and examples. Skip custom HTML/CSS when shadcn covers need.
- Notifications via Sonner.
- All views: page header with title (+ description optional).
- **List views** (/<entities>/): TanStack + shadcn data-table, backend pagination/filter/sort.
  - Global search input above table.
  - Grouping dropdown (default: first column).
  - Sorting enabled.
  - Badges for indicator fields.
  - Actions in dropdown menu.
- **Detail views** (/<entities>/$id): shadcn layout/card components.
- **Create/edit views** (/<entities>/create, /<entities>/<id>/edit): zod + TanStack Form + shadcn Field.
  - Confirmation to leave before save.
  - Fields split by group with descriptions.
  - Pattern: see `/shadcn-baseui` skill for form anatomy example.
- **Delete**: shadcn dialog confirmation.
- **Breadcrumbs**: set `staticData: { crumb: '<i18n-key>' }` in `createFileRoute(...)`. Trail built from `useMatches()` in `_authenticated.tsx`, rendered above `<Outlet />`.

### 14.2 Attendance Type Styling

Attendance status is displayed across attendance views (QR scanning, attendance records, reports). Each status type has a consistent color scheme and icon pairing from `lucide-react`.

| Status             | Color  | Hex Code | Icon             | Icon Name         | Use Case                              |
| ------------------ | ------ | -------- | ---------------- | ----------------- | ------------------------------------- |
| `unset`            | Grey   | #9CA3AF  | ⭕ (outline)     | `Circle`          | No attendance record entered          |
| `present`          | Green  | #10B981  | ✓ (filled)       | `CheckCircle2`    | Student present                       |
| `late`             | Yellow | #F59E0B  | 🕐 (clock)       | `Clock`           | Student arrived late                  |
| `excused_absence`  | Purple | #8B5CF6  | ⚠️ (info)        | `AlertCircle`     | Absence with valid reason (sick, etc) |
| `unexcused_absence`| Red    | #EF4444  | ⚠️ (warning)     | `AlertTriangle`   | Absence without valid reason          |

**Tailwind Color Mapping:**
- Grey: `text-gray-400` / `bg-gray-100`
- Green: `text-green-600` / `bg-green-100`
- Yellow: `text-yellow-500` / `bg-yellow-100`
- Purple: `text-purple-500` / `bg-purple-100`
- Red: `text-red-500` / `bg-red-100`

**Implementation Example:**

```tsx
import { Circle, CheckCircle2, Clock, AlertCircle, AlertTriangle } from 'lucide-react'

const attendanceIcons = {
  unset: { Icon: Circle, color: 'text-gray-400', bg: 'bg-gray-100' },
  present: { Icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100' },
  late: { Icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-100' },
  excused_absence: { Icon: AlertCircle, color: 'text-purple-500', bg: 'bg-purple-100' },
  unexcused_absence: { Icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-100' }
}

// Usage
const { Icon, color, bg } = attendanceIcons[status]
<div className={`flex items-center gap-2 ${bg} px-3 py-1 rounded`}>
  <Icon className={`${color} w-4 h-4`} />
  <span className="text-sm">{i18n.t(`attendance.status.${status}`)}</span>
</div>
```

### 14.3 Export Standard (CSV / PDF)

**Packages:**
- CSV: native `Blob` + `URL.createObjectURL` (no external lib)
- PDF: `pdfmake` (v0.2.x, browser build + bundled Roboto font — required for correct Vietnamese diacritic rendering; jsPDF's built-in fonts lack Vietnamese glyph coverage and render diacritics as garbled glyphs)

**Pattern:** Place export logic in `src/lib/export.ts`. Each view's export dropdown uses `DataTable`'s `filterExtra` prop. Export only data visible in the table (filtered/sorted), not raw API response.

**CSV example:**

```ts
import { exportCsv, type ExportRow } from '~/lib/export'

const rows: Array<ExportRow> = data.map((item, i) => ({
  order: i + 1,
  saintName: item.saintName ?? '—',
  fullName: item.fullName,
  gender: t(`gender.${item.gender}`),
  dob: formatDate(item.dateOfBirth),
}))

exportCsv(rows, 'filename.csv')
```

**PDF example:**

```ts
import { exportPdf, type ExportRow, type PdfClassMeta } from '~/lib/export'

const meta: PdfClassMeta = {
  className: class.name,
  catechistNames: catechists.map(formatPersonName).join(', '),
  studentCount: students.length,
}

exportPdf(rows, meta, 'filename.pdf')
```

**Reference implementation:** `src/routes/_authenticated/_catechist/classes_.$id.tsx` (students tab).

---
