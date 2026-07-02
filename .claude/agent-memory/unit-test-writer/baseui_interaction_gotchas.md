---
name: baseui-interaction-gotchas
description: BaseUI/shadcn component interaction quirks discovered while raising coverage on academic-years.tsx, profile.tsx, year-switcher.tsx, date-input.tsx — fireEvent patterns that actually trigger the underlying behavior.
metadata:
  type: project
---

Discovered 2026-06-30 while raising frontend coverage from ~78% to ~93% (all four
metrics) per the CLAUDE.md 85% threshold rule. See [[convex-usequery-mocking]] for
the underlying useQuery/useMutation mock pattern these tests build on.

**BaseUI `Select` with an `items` prop (listbox `option` role) needs `pointerDown`
before `click` to fire `onValueChange`.** A plain `fireEvent.click(option)` on a
`role="option"` div is silently swallowed — BaseUI's listbox selects on pointer
interaction, not a synthetic click alone. Pattern that works:

```ts
fireEvent.click(screen.getByRole('combobox'))
const option = screen.getByRole('option', { name: /2025-2026/ })
fireEvent.pointerDown(option)
fireEvent.click(option)
expect(handleSelect).toHaveBeenCalledWith('year2')
```

This bit `src/components/year-switcher.test.tsx`. Note: `DataTable`'s page-size
`Select` (`src/components/custom/data-table.test.tsx`) uses plain `fireEvent.click`
successfully — that one renders raw `SelectItem` values (not the `items` prop
variant), so the interaction path differs. If a `Select`/`option` click test isn't
firing, try adding `fireEvent.pointerDown(option)` first before assuming the test
logic is wrong.

**BaseUI `Checkbox` + shadcn `Label` creates two elements matched by
`getByLabelText`** (a visually-hidden native `<input type="checkbox">` plus the
visible `<span role="checkbox">`). `screen.getByLabelText('the label')` throws
"Found multiple elements". Use `screen.getByRole('checkbox')` instead, and assert
state via `toHaveAttribute('aria-checked', 'true'|'false')` (not `toBeChecked()`,
which doesn't reliably read the BaseUI custom checkbox's checked state in jsdom).

**`Date.prototype.toLocaleDateString` does NOT throw for `new Date(NaN)`** — it
returns the literal string `"Invalid Date"`. A test asserting the `date-input.tsx`
catch-branch (line ~49, `formattedDate` try/catch) falls back to the placeholder
must force a real throw, e.g.:

```ts
const throwingSpy = vi.spyOn(Date.prototype, 'toLocaleDateString')
  .mockImplementation(() => { throw new RangeError('Invalid time value') })
render(<DateInput value={someValidDate} placeholder="Pick a date" />)
expect(screen.getByText('Pick a date')).toBeInTheDocument()
throwingSpy.mockRestore()
```

Don't pass `new Date(NaN)` expecting the catch path — it exercises the success
path with a weird string instead.

**`vi.stubEnv(KEY, '')` does not exercise a `??` (nullish-coalescing) fallback.**
`src/lib/locale.ts` does `import.meta.env.VITE_DEFAULT_LANGUAGE ?? 'vi'`. Stubbing
with `''` (empty string) is falsy-looking but NOT nullish, so `??` keeps the empty
string and the "fallback to default" test fails. Stub with `undefined` to actually
hit the fallback: `vi.stubEnv('VITE_DEFAULT_LANGUAGE', undefined)`, then
`vi.resetModules()` and re-`import('./locale')` to get a fresh module evaluation.

**Sonner toast is globally mocked in `src/vitest.setup.ts`** (`vi.mock('sonner', ...)`
returning `{ toast: { success: vi.fn(), error: vi.fn() } }`). Since there's no
global `clearMocks`/`restoreMocks` in `vitest.config.ts`, toast call assertions
leak across tests in the same file unless you reset manually:

```ts
beforeEach(() => {
  vi.mocked(toast.success).mockClear()
  vi.mocked(toast.error).mockClear()
})
```

Without this, a later test's `expect(toast.success).not.toHaveBeenCalled()` will
fail because an earlier test in the same file already called it and nothing reset
the call history.

**Row-actions dropdown pattern for both academic-years.tsx and profile.tsx**: the
`DropdownMenuTrigger` button has `aria-label`/name `common.moreActions`. Open it
with `fireEvent.click(screen.getByRole('button', { name: 'common.moreActions' }))`,
then `await screen.findByText('common.edit' | 'common.delete' | ...)` before
clicking the menu item (BaseUI portals the menu content asynchronously).

**Contact dialog form's submit button text is the bare `common.save` key**
(not `profile.contacts.save`), which makes it ambiguous to query by `name` when the
personal-info (`profile.personal.save`) and address (`profile.address.save`)
section save buttons are also rendered in the same document (ProfilePage renders
all three sections). `screen.getByRole('button', { name: 'common.save' })` is
actually unique in practice since those two other buttons have distinct keys — no
need for `{ form: 'contact-dialog-form' }` (that's not a valid Testing Library
`ByRoleOptions` key and causes a TS error).

**Disabled state on shadcn `DropdownMenuItem`** is exposed via the
`data-disabled` attribute (truthy presence), not the native `disabled` attribute —
assert with `.toHaveAttribute('data-disabled')`, found via
`.closest('[role="menuitem"]')` from the text node.

**BaseUI `Popover` opens with a plain `fireEvent.click` on the trigger** — unlike
`Select`, no `pointerDown` is needed first. Confirmed in both
`src/components/custom/date-input.test.tsx` (opens the calendar popover) and
`src/components/custom/attendance-grid-board.test.tsx` (opens the attendance-edit
popover). `PopoverContent` renders via `PopoverPrimitive.Portal` to `document.body`
but `screen`/`within(document.body)` queries find it fine with no extra setup —
portals "just work" in this project's jsdom test environment.

**Finding an unlabeled `PopoverTrigger` button inside a repeated grid/table
cell** (e.g. `AttendanceGridBoard`'s per-student-per-session trigger, which wraps
only an icon with no accessible name): don't rely on `getAllByRole('button')`
index math across the whole document — grouping/ordering of grid cells can differ
from visual order (e.g. sessions get reordered into month-year buckets, see
below). Instead scope the query to the row: `screen.getByText(studentCode).closest('tr')`
then `within(row).getAllByRole('button')[cellIndex]`. This stays correct even if
column ordering logic changes.

**Gotcha: `Object.keys()`-based grouping reorders flat lists.** In
`attendance-grid-board.tsx`, sessions are grouped into `sessionsByMonth` by
first-seen month, then re-flattened via
`monthYearOrder.flatMap(my => sessionsByMonth[my])`. If input sessions aren't
already contiguous by month (e.g. `[JanA, FebB, JanC]`), the rendered column
order becomes `[JanA, JanC, FebB]` — NOT the original array order. Tests that
assert on cell position by index must either keep fixture sessions grouped
contiguously by month, or scope queries by row/text content instead of index.

**`react-i18next` is globally mocked as `t: (key) => key`** (see
`src/vitest.setup.ts`) — it ignores the second `options` argument entirely,
including `defaultValue`. A call like `t('foo.bar', { defaultValue: 'Foo Bar' })`
renders the literal string `'foo.bar'` in tests, never `'Foo Bar'`. Always assert
on the raw i18n key, not the defaultValue text.

**`useMutation` mock return values need `as any`.** The global mock in
`vitest.setup.ts` types `useMutation: vi.fn(() => vi.fn())`, so
`vi.mocked(useMutation).mockReturnValue(myMockFn)` fails type-checking (`Mock` is
not assignable to `ReactMutation<FunctionReference<'mutation'>>`). Established
project pattern (`profile.test.tsx`, `enrollment-dialog.test.tsx`,
`attendance-grid-board.test.tsx`): cast with
`vi.mocked(useMutation).mockReturnValue(mockFn as any)`.
