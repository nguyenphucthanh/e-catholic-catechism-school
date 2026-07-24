---
name: tanstack-form-submit-and-native-constraint-gotchas
description: Two gotchas hit while raising score-grid-board.tsx coverage from ~50% to 96%/92%/91%/96% (stmts/branch/func/lines) — TanStack Form's handleSubmit is async, and native input min/max attributes block jsdom form submission via a plain button click.
metadata:
  type: project
---

**`form.handleSubmit()` (TanStack Form, used throughout this project's
create/edit forms and popover forms like `score-grid-board.tsx`'s
`ScorePopoverContent`/`ColumnActionsPopover`) resolves asynchronously**, even
though the `onSubmit` callback body itself looks synchronous (a plain
`toast.error(...); return` or a direct `onSave(...)` call). A
`fireEvent.click(saveButton)` immediately followed by a synchronous
`expect(toast.error).toHaveBeenCalledWith(...)` reliably fails with "Number of
calls: 0" — the assertion runs before the microtask that actually invokes the
validation/`onSubmit` body flushes. Any assertion on side effects of a
TanStack Form submit (toast calls, mutation calls, state changes opening a
follow-up dialog) must be wrapped in `await vi.waitFor(() => expect(...))` (or
preceded by an `await screen.findBy...`). This bit 3 different tests in
`score-grid-board.test.tsx` (a `nameRequired` toast, a mutation call
assertion, and a `passFailRequired` toast) before the fix. Contrast with
[[baseui_interaction_gotchas]]'s AlertDialog/Popover open assertions, which
already use `screen.findByRole` and were unaffected.

**A number `<input>` with a native `max`/`min` attribute (e.g.
`<Input type="number" min={0} max={10} .../>` in `ScorePopoverContent`)
silently blocks a plain `fireEvent.click(submitButton)` from ever reaching the
form's `onSubmit` handler in jsdom**, because clicking a `type="submit"`
button triggers the browser's native constraint-validation pass first, and a
value like `"15"` fails the `max={10}` check — the same range check the
component's own JS `onSubmit` body was supposed to test independently
(`parseFloat(value.val) > 10 -> toast.error(...)`). The result looks
identical to the async-submit gotcha above (`toast.error` never called), but
no amount of `waitFor` fixes it since the submit event never fires at all.
Fix: bypass the button and dispatch `submit` directly on the form element,
which skips the native-validation-on-click path:
```ts
fireEvent.change(scoreInput, { target: { value: '15' } })
fireEvent.submit(scoreInput.closest('form')!)
```
Only needed when the out-of-range test value also violates the native
`min`/`max` HTML attribute mirroring the JS check (e.g. testing the
`scoreRangeError` branch specifically) — in-range values submitted via a
normal button click work fine and don't need this workaround.
