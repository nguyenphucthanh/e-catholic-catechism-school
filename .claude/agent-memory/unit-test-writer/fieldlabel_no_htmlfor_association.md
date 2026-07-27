---
name: fieldlabel-no-htmlfor-association
description: shadcn Field/FieldLabel (src/components/ui/field.tsx) does not auto-wire htmlFor/id to its sibling input — getByLabelText fails; query inputs by row scope + role order instead.
metadata:
  type: project
---

`FieldLabel` (`src/components/ui/field.tsx`) renders a `Label` with
`data-slot="field-label"` but no `htmlFor`/`id` linkage to the `Input` that
follows it inside the same `Field` — callers must wire `id`/`htmlFor`
manually, and most call sites (e.g. `sacrament-detail-dialog.tsx`'s
feastName/sponsorName/notes inputs) don't. `screen.getByLabelText('...')`
therefore fails to find these inputs even though the label text is visibly
adjacent.

**Fix used successfully**: scope to the repeated row/card container (e.g. via
`screen.getByText(studentCode).closest('div.p-4')`), then
`within(row).getAllByRole('textbox')` and index into the array in DOM/JSX
order (0 = first Field's input, 1 = second, etc.). Confirmed in
`src/components/forms/sacrament-detail-dialog.test.tsx`.

This is distinct from the `getByLabelText` "multiple elements" issue in
[[baseui_interaction_gotchas]] (that one is about `Checkbox` + `Label`
producing two matches) — this one is zero matches, because there's no
`htmlFor` at all.
