---
name: baseui-interaction-gotchas
description: BaseUI/shadcn component interaction quirks discovered while raising coverage on academic-years.tsx, profile.tsx, year-switcher.tsx, date-input.tsx, attendance-summary-report.tsx, enrollment-summary.tsx (Tabs), header-search.tsx (Combobox) — fireEvent patterns that actually trigger the underlying behavior.
metadata:
  type: project
---

**BaseUI `Combobox` (`~/components/ui/combobox.tsx`) opens its popup on
`mousedown`, not `click` or `pointerDown`.** Internally it wires
`useClick(floatingRootContext, { event: 'mousedown-only', toggle: false, ... })`
(see `node_modules/@base-ui/react/combobox/root/AriaCombobox.js` around line
823). A plain `fireEvent.click(input)` or even `fireEvent.pointerDown(input)` +
`fireEvent.click(input)` (the `Select` pattern from below) leaves
`aria-expanded="false"` and the popup content (`ComboboxContent`/`ComboboxList`/
items) never mounts — `screen.getByText(...)` on any group label or item then
fails with the popup's DOM printed but empty of list content. Fix: fire
`fireEvent.mouseDown(input)` (a real synthetic `mousedown`) before/with
`fireEvent.change(input, { target: { value: '...' } })`. Once open, individual
`ComboboxItem`s (plain text nodes, no button role) can be selected with a plain
`fireEvent.pointerDown(option); fireEvent.click(option)` — that combo (not
`mousedown`) is what triggers `onValueChange`/selection, confirmed in
`src/components/header-search.test.tsx`.

Also for `Combobox`-based components debouncing input via `useEffect` +
`setTimeout` (see [[date-mocking-fake-timers]] for the fake-timer setup):
`vi.advanceTimersByTime(...)` that flushes a debounced `setState` must be
wrapped in `act(() => { vi.advanceTimersByTime(300) })` from
`@testing-library/react` — otherwise React logs "not wrapped in act" warnings
(not a hard failure, but noisy and can mask real problems). And when asserting
"the debounce hasn't fired yet", don't do
`expect(useQuery).not.toHaveBeenCalledWith(expect.anything(), {plainObject})`
— vitest's pretty-format can throw `PrettyFormatPluginError: Cannot convert
object to primitive value` trying to diff a Convex `FunctionReference` Proxy
(`expect.anything()` still needs to stringify the actual received args for the
failure message, and the proxy's `Symbol.toPrimitive`-less shape blows up).
Use `expect(useQuery).toHaveBeenLastCalledWith(expect.anything(), 'skip')`
instead (asserting on the concrete last-call args, which is a plain string/
object without the proxy) to sidestep the formatter bug entirely.

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

This bit `src/components/year-switcher.test.tsx` and was reused successfully in
`src/components/custom/attendance-summary-report.test.tsx`'s semester-filter
`Select` (also built via the `items` prop). Note: `DataTable`'s page-size
`Select` (`src/components/custom/data-table.test.tsx`) uses plain `fireEvent.click`
successfully — that one renders raw `SelectItem` values (not the `items` prop
variant), so the interaction path differs. If a `Select`/`option` click test isn't
firing, try adding `fireEvent.pointerDown(option)` first before assuming the test
logic is wrong.

**Summary-card / KPI-tile numeric values need to be queried scoped to their card,
not with a bare `screen.getByText(number)`.** In components with a row of shadcn
`Card`s showing big numbers above a data table (e.g.
`attendance-summary-report.tsx`'s "Total Sessions" / "Class Avg Rate" / "Perfect
Attendance" cards), the same digit (e.g. `'5'`, `'1'`) very often also appears in
a table cell, causing "Found multiple elements" errors. Scope by the card's
`CardTitle` (an i18n key) instead:

```ts
function cardValue(titleKey: string): string {
  const title = screen.getByText(titleKey)
  const card = title.closest('[data-slot="card"]') as HTMLElement
  const valueEl = card.querySelector('.text-3xl') as HTMLElement
  return valueEl.textContent
}
// cardValue('attendance.summary.totalSessions') === '5'
```
Note: when a card's value is a number immediately followed by a sibling `<span>`
(e.g. perfect-attendance's `{count}<span>/ {total}</span>`), `textContent`
concatenates them with no inserted space: `'1/ 2'`, not `'1 / 2'` — assert the
exact concatenated string.

**`@typescript-eslint/no-unnecessary-condition` / `no-unnecessary-type-assertion`
on `element.textContent`**: in this project's tsconfig/lib setup, a DOM
element's `.textContent` is apparently narrowed to non-nullable `string` by the
type-aware linter (not the standard-lib `string | null`), so both `?? ''` and
`as string` / `!` get flagged as unnecessary by eslint even though the DOM lib
type nominally allows `null`. Just return `.textContent` directly with no
fallback/assertion when reading it off a `querySelector` result already cast to
`HTMLElement`.

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
`src/lib/locale.ts` does `import.meta.env.VITE_DEFAULT_LOCALE ?? 'vi-VN'`. Stubbing
with `''` (empty string) is falsy-looking but NOT nullish, so `??` keeps the empty
string and the "fallback to default" test fails. Stub with `undefined` to actually
hit the fallback: `vi.stubEnv('VITE_DEFAULT_LOCALE', undefined)`, then
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
`vi.mocked(useMutation).mockReturnValue(mockFn as any)`. When a component
calls `useMutation` for several distinct mutations, see [[convex-usequery-mocking]]
for the `Symbol.for('functionName')` branch pattern instead of a single
`mockReturnValue`.

**shadcn's `AlertDialog` (`~/components/ui/alert-dialog.tsx`, wrapping
`@base-ui/react/alert-dialog`) renders its popup with `role="alertdialog"`**
(confirmed via `node_modules/@base-ui/react/alert-dialog/handle.js`) and,
like `Popover`, is not mounted in the DOM at all while closed — no
`keepMounted` workaround needed. `screen.getByRole('alertdialog')` /
`screen.findByRole('alertdialog')` (portaled, but `screen` searches
`document.body` so it's found with no extra setup) is the reliable way to
scope queries to the confirm dialog and disambiguate its buttons from
same-labeled buttons elsewhere in the tree — e.g. in
`attendance-grid-board.tsx`, both the `SessionActionsPopover`'s inline "Save
fields" button and the `AlertDialogAction` confirm button use the bare
`common.save` key; without `within(screen.getByRole('alertdialog'))` a plain
`getByRole('button', { name: 'common.save' })` would be ambiguous once the
confirm dialog opens (both remain mounted simultaneously — opening the
`AlertDialog` does not unmount the still-open `Popover` behind it).

**BaseUI `Tabs` (`~/components/ui/tabs.tsx`, wrapping `@base-ui/react/tabs`)
switches with a plain `fireEvent.click` on the trigger — no `pointerDown`
needed** (unlike `Select`). Roles are standard ARIA: `TabsList` → `tablist`,
`TabsTrigger` → `tab`, `TabsContent` → `tabpanel`. Confirmed in
`src/components/custom/enrollment-summary.test.tsx` (first test file in this
repo to exercise `Tabs`):

```ts
fireEvent.click(screen.getByRole('tab', { name: 'my.i18n.key' }))
```

Critically, `TabsPanel` defaults `keepMounted = false`
(`node_modules/@base-ui/react/tabs/panel/TabsPanel.js`), so **inactive tab
panels are fully unmounted, not just visually hidden** — a query for content
in a non-active tab (e.g. `screen.queryByText(...)`) correctly returns
nothing before that tab is clicked, and content from the previously active
tab disappears once you switch away. No `{ hidden: true }` query workaround
is needed the way it sometimes is for CSS-hidden content in other libraries.

**BaseUI `Select` trigger's accessible name is EMPTY, not the placeholder
text** — confirmed by dumping `logRoles`/`getByRole` error output in
`students_.promote.test.tsx`. Per the ARIA accname spec, `role="combobox"`
does not allow "name from content", so even though the trigger `<button>`
visibly contains the `SelectValue`'s placeholder/selected-label text as a
child span, `computeAccessibleName` returns `""` — `getByRole('combobox',
{ name: ... })` NEVER matches on that text, exact or regex, and silently
throws "Unable to find an accessible element" for every attempt. This only
bites when a page renders **multiple** Selects (a single-Select page like
`year-switcher.tsx` gets away with bare `getByRole('combobox')` with no name
filter). Fix: locate the trigger by its still-visible placeholder text and
walk up to the button, e.g. `screen.getByText('my.placeholder.key').closest('button')`
— valid only before a value has been picked (afterward the text changes to
the selected item's label, which is fine since each trigger is only opened
once per test in practice). See `students_.promote.test.tsx`'s `selectOption()`
helper.

**A native `<button disabled>`'s onClick truly does not fire under
`fireEvent.click` in jsdom** (matches real browser behavior) — so testing a
handler's internal early-return guard clauses (e.g. `if (!targetClassYearId)
{ toast.error(...); return }`) is unreachable through the DOM once the
button's `disabled` prop is already `true` for that same condition. Don't
try to force it by calling the handler directly (that's testing
implementation, not behavior) — just assert the mutation was never called
and the button is disabled; the "toast on guard clause" lines are simply
dead/defensive code from the DOM's perspective and will show as uncovered
branches, which is fine as long as the overall file clears the 75% branch
threshold.

**DataTable's built-in `"N of M row(s) selected."` footer text is split
across three JSX-expression text nodes** (`{count}`, `" of "` literal,
`{total}`), so `screen.getByText('0 of 2 row(s) selected.')` fails with
"text is broken up by multiple elements". It's also NOT i18n-gated (unlike
a page's own `t('foo.selectedCount', {count})` label, which the globally
mocked `t` renders as the raw key regardless of actual count — useless for
asserting a count actually changed). To verify a row-selection count changed,
read the real DOM text instead: the footer div has class `flex-1`, but that
class isn't unique doc-wide (e.g. `PageHeader`'s title wrapper also uses it)
— filter by content:
```ts
Array.from(document.querySelectorAll('.flex-1'))
  .find((el) => el.textContent.includes('row(s) selected'))?.textContent
```
Confirmed in `students_.promote.test.tsx`.

**BaseUI `Checkbox`'s hidden native `<input type="checkbox">` is
`aria-hidden="true"`**, so `getByRole('checkbox')` only ever matches the
visible `role="checkbox"` `<span>` — no duplicate-match issue for role
queries (unlike the `getByLabelText` duplicate noted below). A disabled
checkbox renders `aria-disabled="true"` on that span (assert
`toHaveAttribute('aria-disabled', 'true')`) and a plain `fireEvent.click`
on it is correctly swallowed (`onCheckedChange` never fires) — no
`pointerDown` needed for Checkbox specifically (unlike Select/Combobox
above). On an enabled checkbox, `fireEvent.click` fires
`onCheckedChange(true, eventDetails)` — a real BaseUI event-details object as
the 2nd arg, so assert with `toHaveBeenCalledWith(true, expect.anything())`
or just check the first arg if using a state-toggling callback like
`(value) => row.toggleSelected(!!value)`. Verified in
`students_.promote.test.tsx`.

**Locating an unlabeled `PopoverTrigger` that wraps plain text (not an
icon)** — e.g. `attendance-grid-board.tsx`'s date-header cell, a `<button>`
(BaseUI `PopoverTrigger` renders a real native `<button>`) containing two
`<div>`s (`dd` and `EEE` formatted date text, no aria-label): find it via
`screen.getByText(dayText).closest('button')!` and `fireEvent.click(...)`,
mirroring the existing `within(row).getAllByRole('button')[cellIndex]`
pattern used for the per-student attendance cells. To assert header column
*order* after a client-side sort toggle, don't rely on `getAllByRole` (order
across the two `<thead>` rows can be ambiguous) — instead scope a
`querySelectorAll` to the specific header row and pluck first-child text,
e.g. `container.querySelectorAll('thead tr:nth-child(2) button > div:first-child')`,
which stays correct across re-sorts since it reads live DOM order.
