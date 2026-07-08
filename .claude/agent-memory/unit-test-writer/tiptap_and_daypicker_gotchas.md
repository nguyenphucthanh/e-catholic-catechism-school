---
name: tiptap-and-daypicker-gotchas
description: Testing a Tiptap-based RichTextEditor wrapper (mock @tiptap/react instead of driving real ProseMirror in jsdom) and react-day-picker Calendar day-cell click/query gotchas, first hit on KAN-225 calendar-manage-page tests.
metadata:
  type: project
---

**Real Tiptap/ProseMirror in jsdom is fast to render but unreliable to
interact with.** `useEditor`/`EditorContent` from `@tiptap/react` render fine
in jsdom (a spike confirmed `screen.getByLabelText('Bold')` etc. all work,
~1s per test file), and firing `fireEvent.input` on the `contenteditable` div
does call `onUpdate` — but real DOM selection (`Range`/`Selection` API,
`document.execCommand`) doesn't drive ProseMirror's internal doc state the
way a real browser does, so tests that depend on "select this text, verify
`isActive('bold')` becomes true after toggling" hang/timeout (`waitFor`
never resolves) or produce false content. Firing selection changes also
throws an unhandled `TypeError: target.getClientRects is not a function`
from `prosemirror-view`'s `DOMObserver.onSelectionChange` → `coordsAtPos`,
since jsdom doesn't implement `Range.getClientRects`.

**Fix used for `src/components/custom/richtext-editor.tsx`
(`src/components/custom/richtext-editor.test.tsx`):** mock `@tiptap/react`
entirely —
```ts
vi.mock('@tiptap/react', () => ({
  useEditor: vi.fn(),
  EditorContent: ({ editor }: { editor: any }) => (
    <div data-testid="editor-content" data-json={JSON.stringify(editor.getJSON())} />
  ),
}))
vi.mock('@tiptap/starter-kit', () => ({ StarterKit: {} }))
```
then build a `createMockEditor({ activeMarks, json })` factory returning a
plain object with `isActive`, `chain().focus().toggleBold().run()`-style
chainable spies (`chain` object with all toggle methods returning itself),
`getJSON`, `commands.setContent`, `setEditable`. Capture the config object
passed to `useEditor(config)` via `mockImplementation((config) => { lastConfig
= config; return mockEditor })` to assert on `content`/`editable`/
`editorProps.attributes['data-placeholder']`, and manually invoke
`lastConfig.onUpdate({ editor: mockEditor })` to test the `onChange` wiring
instead of trying to simulate real typing. This tests the wrapper
component's own logic (content parsing, onChange plumbing, toolbar
active-state rendering, command-chain calls, `editable` prop propagation via
`setEditable`) in isolation — exactly matching "mock external dependencies,
test the unit" since Tiptap/ProseMirror is a third-party library, not the
unit under test. Got 100%/88.9%/100%/100% stmt/branch/func/line coverage
this way, zero flakiness, ~2ms/test.

**Type gotcha:** `vi.mocked(useEditor).mockImplementation((config: any) =>
mockEditorShape)` fails `tsc` because the mock editor object doesn't
structurally satisfy Tiptap's real `Editor` class (missing dozens of
internal properties). Cast the whole mocked function instead of the
callback: `;(useEditor as any).mockImplementation((config: any) => {...})`
— matches the project's existing `useMutation` `as any` cast pattern from
[[baseui_interaction_gotchas]].

**react-day-picker (shadcn `Calendar`, `src/components/ui/calendar.tsx`)
day cells: when a custom `DayButton` override adds `data-day={iso}` on the
rendered `<button>`, react-day-picker's own wrapping `<td role="gridcell">`
ALSO carries a `data-day` attribute with the same value** (part of its
built-in day-cell metadata, not something the override controls). A plain
`container.querySelector('[data-day="2026-07-15"]')` matches the `<td>`
first (DOM order), not the button — clicking the `<td>` is a silent no-op
(no `onSelect` fires) since only the button has the click handler. Scope the
selector to the element tag: `container.querySelector('button[data-day="..."]')`.
Confirmed in `src/routes/_authenticated/_catechist/calendar.test.tsx`. For
simple day-of-month text matching without a custom `data-day` override, the
existing precedent `src/components/custom/date-input.test.tsx` uses
`screen.getByRole('button', { name: /15/ })` + plain `fireEvent.click` — no
`pointerDown` needed for Calendar day buttons (unlike Select/Combobox).

**`vi.useFakeTimers()` + real BaseUI `AlertDialog`/mutation-promise flows:
`waitFor`/`findByRole` can time out even with `{ advanceTimers:
vi.advanceTimersByTime }` passed** — in this repo's setup that option didn't
reliably unstick a `findByRole('alertdialog')` that should have resolved
synchronously. Working fix: only use fake timers to pin "today" for the
initial render/date-fixture matching, then call `vi.useRealTimers()` right
after the synchronous DOM assertions (`screen.getByRole('alertdialog')`,
button clicks) and before any `await waitFor(...)` that waits on an async
mutation promise resolving — real timers let `waitFor`'s internal
`setInterval` poll normally while the already-rendered component's state
(computed under the earlier fake "now") is untouched. See the `delete icon
button...` tests in `calendar.test.tsx`.

See also [[date_mocking_fake_timers]] for the general fake-timer setup
pattern this builds on, and [[convex_useQuery_mocking]] /
[[baseui_interaction_gotchas]] for the Symbol.for('functionName') query
branching and Select/AlertDialog interaction patterns reused here (Select
mocked as a native `<select>` per the `bulk-update-sacrament-dialog.test.tsx`
precedent when a dialog has several Select fields, to avoid BaseUI's
pointerDown-before-click Select quirk entirely).
