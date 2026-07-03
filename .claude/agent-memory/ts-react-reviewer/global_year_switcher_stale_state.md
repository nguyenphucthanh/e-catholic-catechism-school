---
name: global_year_switcher_stale_state
description: YearSwitcher (app-sidebar.tsx) stays mounted across route navigation; components deriving local state from academicYearId/classId props must reset it themselves or risk silently stale UI
metadata:
  type: project
---

`YearSwitcher` (`src/components/year-switcher.tsx`) is rendered inside
`src/components/app-sidebar.tsx`, part of the persistent `_authenticated` app
shell. It lets the user change the globally selected academic year
(`useSelectedAcademicYear()` from `src/lib/academic-year.tsx`) at any time,
from any page, without navigating away.

Separately, TanStack Router does **not** remount a route's component when
only a path param changes (e.g. `/classes_/$id` navigating from one class to
another reuses the same `ClassDetailPage` instance) — this is standard
router behavior, not a bug, but combined with the global year switcher it
means any descendant component that keeps **local React state scoped to a
specific `academicYearId` or `classId` value** (a selected semester, a
selected filter tied to IDs from that scope, etc.) will NOT have that state
reset when the id changes underneath it via props.

**Confirmed instance (2026-07-03, KAN-114 attendance summary report
review):** `AttendanceSummaryReport`
(`src/components/custom/attendance-summary-report.tsx`) keeps
`selectedSemester` (a `semesters` doc `_id` scoped to the current
`academicYearId`) in local `useState`, with no `useEffect` resetting it when
`academicYearId` or `classId` props change. Switching the global year via
`YearSwitcher`, or navigating from one class's detail page to another's
while the Summary Report tab is open, leaves `selectedSemester` pointing at
an id that no longer matches any semester in the new `semesterOptions` list.
The session filter `session.semesterId === selectedSemester` then silently
matches nothing, and the UI shows an empty-looking report (`0` sessions,
`—` rates) with no error and no obvious cause — the Select's displayed label
for the stale value is also undefined behavior once `items` no longer
contains a matching entry.

**Why:** Confirmed via reading `app-sidebar.tsx` (renders `<YearSwitcher />`
outside the route `Outlet`) and `classes_.$id.tsx` (no `key` prop tying
`AttendanceSummaryReport`/`AttendanceGridBoard` to `classId`/`academicYearId`,
no reset effect either). `AttendanceGridBoard`'s own local state
(`showCancelled`, `dateOrder`, `savingCell`, `confirmAction`) doesn't carry
this risk since none of it is keyed to a specific id value from a stale
scope — only newly-added components that key filter state off scoped ids
are exposed.

**How to apply:** When reviewing any new component that takes
`academicYearId` and/or `classId` (or similar scoped id) as a prop and
keeps local state derived from data scoped to that id (a selected child
entity, a selected filter value, etc.), check whether that state is reset
when the prop changes — either via `useEffect(() => reset(), [scopedId])`
or by the parent keying the component (`key={classId}` /
`key={`${classId}:${academicYearId}`}`) to force a remount. Flag if neither
exists. This is a recurring risk anywhere `YearSwitcher` can be active
concurrently with the component in question (i.e. almost every
`_authenticated` page).
