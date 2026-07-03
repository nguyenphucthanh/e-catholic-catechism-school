---
name: baseui_select_items_prop
description: Correction — Base UI's Select.Root `items` prop IS real and consumed (drives <Select.Value> label lookup); do not assume it's dead without checking for SelectValue children override
metadata:
  type: project
---

Earlier review of `assignments_.edit.tsx` (see [[project_assignments_patterns]])
concluded that `items={[...]}` passed to `<Select>` "silently does nothing."
Verified against the installed package (`node_modules/@base-ui/react`
v1.6.0, `select/root/SelectRoot.d.ts` and
`docs/react/components/select.md`) that this is **not generally true**:
`items` is a first-class `Select.Root` prop —
`Record<string, ReactNode> | ReadonlyArray<{label, value}> | ReadonlyArray<Group<...>>`
— and the docs state explicitly: *"By default, the `<Select.Value>`
component renders the raw `value`. Passing the `items` prop to
`<Select.Root>` instead renders the matching label for the rendered value."*
Since this project's wrapper (`src/components/ui/select.tsx`) defines
`Select = SelectPrimitive.Root` as a direct alias (no interception), `items`
flows straight through and does drive the trigger's label — confirmed
correct usage in `src/components/custom/attendance-summary-report.tsx`
(semester filter Select, reviewed 2026-07-03) and
`src/components/year-switcher.tsx`.

**Why:** The old memory's conclusion may have been right for that specific
file (if `<SelectValue>` there was given children that override item-driven
label lookup — children win over `items`), but stated as a general fact it
is wrong and would cause future reviews to wrongly wave through `<SelectValue
placeholder=... />` (no children) with no `items` prop — which per the docs
actually renders the **raw value** (e.g. a Convex doc id) in the trigger
instead of a human label. That is the real bug shape to look for, not
"items is dead."

**How to apply:** When reviewing any `<Select>` usage in this codebase:
1. If `<SelectValue>` has no children and no `items` prop is passed on
   `<Select>`, flag it — the trigger will show the raw value, not a label.
2. If `items` is passed, confirm the array's `{label, value}` shape matches
   what `<SelectItem value=...>` children use, and that it's rebuilt (memoized
   or freshly derived) whenever the underlying option list changes.
3. Don't assume `items` is inert — verify per-instance rather than citing
   this file's earlier blanket claim.
