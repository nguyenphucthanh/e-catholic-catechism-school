---
name: date-mocking-fake-timers
description: How to test components that compute "today"/date-range logic from `new Date()` internally (not via props), first done for today-this-week-widget.tsx.
metadata:
  type: project
---

Some components compute date-derived values (e.g. `today`, a Mon-Sun week
range via `date-fns` `startOfWeek`/`endOfWeek`) directly from `new Date()`
inside the component body, with no way to inject "now" via props. As of
2026-07-05 no test file in this repo had exercised `vi.useFakeTimers()` yet —
`today-this-week-widget.test.tsx` is the first. Established pattern:

```ts
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-07-08T09:00:00')) // a Wednesday
})

afterEach(() => {
  vi.useRealTimers()
})
```

Picking a mid-week fixed date (not Mon/Sun) makes the Mon-Sun week boundary
unambiguous when writing fixture `sessionDate` values relative to it (e.g.
"past date within the same week" vs "future date within the same week").
No need to mock `date-fns` itself — `useFakeTimers` intercepts `Date` globally
so `startOfWeek`/`endOfWeek`/`format(new Date(), ...)` all see the fixed time.

For asserting rendered formatted-date text, don't hardcode a locale string —
import and call the same `formatDate` helper (`~/lib/locale`) the component
uses, e.g. `screen.getByText(formatDate('2026-07-08'))`. This mirrors
`src/components/custom/enrollment-summary.test.tsx`, the existing precedent
for asserting on `formatDate(...)` output rather than a guessed string.

See [[convex-usequery-mocking]] for the single-query-with-skip mock pattern
(`today-this-week-widget.tsx` follows the same one-`useQuery`-with-`'skip'`
shape as `my-classes-widget.tsx`) and [[baseui-interaction-gotchas]] for the
`Link` params/search override used alongside it.

**Same fake-timer pattern applies one level up, in a parent component's test,
when the parent (not the child) computes date-derived props to pass down.**
`catechist-dashboard.tsx` computes `dateFrom`/`dateTo` via
`date-fns` `format`/`subDays(new Date(), 27)` and passes them as props to
`AttendanceHealthWidget` (mocked in `catechist-dashboard.test.tsx` the same
way `MyClassesWidget`/`TodayThisWeekWidget` already were — render a `<div>`
stamping the received props as `data-*` attributes, then assert on those
attributes). Wrap the parent test file's `describe` in the same
`beforeEach(vi.useFakeTimers() + vi.setSystemTime(...))` /
`afterEach(vi.useRealTimers())` pair so the computed `dateFrom`/`dateTo`
strings are deterministic, then assert the exact expected date strings, e.g.
system time `2026-07-08T09:00:00` → `dateTo` `'2026-07-08'`, `dateFrom`
(27 days earlier) `'2026-06-11'`. Confirmed working (tests + `tsc --noEmit` +
eslint clean, full suite green, `attendance-health-widget.tsx` itself at
100%/100%/100%/100% coverage) as of 2026-07-05.
