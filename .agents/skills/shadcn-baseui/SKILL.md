---
name: shadcn-baseui
description: >
  Guidelines for using shadcn UI components in this project. The UI layer is
  built on Base UI (@base-ui/react), NOT Radix UI. Always reference Base UI
  docs and follow the patterns in src/components/ui/. Invoke whenever writing
  or reviewing any UI component code.
---

# shadcn + Base UI Development

This project uses shadcn-style component wrappers built on top of
**Base UI (`@base-ui/react`)** — not Radix UI. All UI primitives import from
`@base-ui/react/*`. Do not reference Radix patterns, Radix props, or Radix docs.

## Component Location

All wrapped components live in `src/components/ui/`. Always import from there:

```tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '~/components/ui/dialog'
// etc.
```

## Critical: Select `items` Prop

Base UI's `Select.Root` requires an `items` prop to display the correct label
for the selected value inside the trigger. Without it, `<SelectValue>` renders
blank after selection.

**Always pass `items` on every `<Select>`:**

```tsx
<Select
  value={value}
  onValueChange={setValue}
  items={options.map((o) => ({ label: o.name, value: o.id }))}
>
  <SelectTrigger>
    <SelectValue placeholder="Select..." />
  </SelectTrigger>
  <SelectContent>
    {options.map((o) => (
      <SelectItem key={o.id} value={o.id}>
        {o.name}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

`items` shape: `Array<{ label: string; value: string }>`. The `label` must match
what the `<SelectItem>` renders as text so the trigger shows the right string.

**Common mistake — missing `items`:**

```tsx
// WRONG — trigger shows blank after selection
<Select value={val} onValueChange={setVal}>
  ...
</Select>

// CORRECT
<Select value={val} onValueChange={setVal} items={opts.map(o => ({ label: o.name, value: o.id }))}>
  ...
</Select>
```

## Base UI vs Radix Differences

| Concern | Radix (DON'T use) | Base UI (use this) |
|---|---|---|
| Select value display | auto from children text | requires `items` prop on root |
| Data attributes | `data-state="open"` | `data-open` / `data-closed` |
| Render prop | `asChild` | `render={<el />}` |
| Item indicator | `SelectItemIndicator` | `Select.ItemIndicator` inside `Select.Item` |
| Scroll buttons | `SelectScrollUpButton` | `Select.ScrollUpArrow` / `ScrollDownArrow` |
| Popup positioning | `SelectContent` side/align | `Select.Positioner` wraps `Select.Popup` |

When in doubt, read the actual component file in `src/components/ui/` — it shows
the exact Base UI API being used.

## Critical: Combobox `items` Prop

Same rule as Select. `Combobox.Root` requires `items` to display the correct
label for selected value(s). Without it, `<ComboboxValue>` renders blank.

```tsx
import {
  Combobox, ComboboxInput, ComboboxContent,
  ComboboxList, ComboboxItem, ComboboxValue, ComboboxEmpty,
} from '~/components/ui/combobox'

<Combobox
  value={value}
  onValueChange={setValue}
  items={options.map((o) => ({ label: o.name, value: o.id }))}
>
  <ComboboxInput placeholder="Search..." />
  <ComboboxContent>
    <ComboboxList>
      <ComboboxEmpty>No results.</ComboboxEmpty>
      {options.map((o) => (
        <ComboboxItem key={o.id} value={o.id}>
          {o.name}
        </ComboboxItem>
      ))}
    </ComboboxList>
  </ComboboxContent>
</Combobox>
```

For multi-select (chips mode), `value` is an array and `items` still required:

```tsx
<Combobox
  value={selected}          // string[]
  onValueChange={setSelected}
  items={options.map((o) => ({ label: o.name, value: o.id }))}
  multiple
>
  <ComboboxChips ref={anchorRef}>
    {selected.map((id) => (
      <ComboboxChip key={id} value={id}>{labelFor(id)}</ComboboxChip>
    ))}
    <ComboboxChipsInput placeholder="Add..." />
  </ComboboxChips>
  ...
</Combobox>
```

## Other Components: Key Base UI Patterns

### Dialog
```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '~/components/ui/dialog'
// Base UI: data-open/data-closed, not data-state
```

### Checkbox
```tsx
import { Checkbox } from '~/components/ui/checkbox'
// Base UI Checkbox.Root — checked prop, not defaultChecked for controlled
```

### Tooltip
```tsx
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip'
// Base UI: no TooltipProvider needed
```

### DropdownMenu (maps to Base UI Menu)
```tsx
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from '~/components/ui/dropdown-menu'
// Underlying: @base-ui/react/menu
```

## Render Prop Pattern

Base UI uses `render` prop instead of Radix's `asChild`:

```tsx
// WRONG (Radix pattern)
<SelectPrimitive.Icon asChild>
  <ChevronDownIcon />
</SelectPrimitive.Icon>

// CORRECT (Base UI pattern)
<SelectPrimitive.Icon render={<ChevronDownIcon />} />
```

## Data Attributes for Styling

Base UI uses boolean data attributes, not string state:

```tsx
// WRONG
.className="data-[state=open]:animate-in"

// CORRECT
.className="data-open:animate-in data-closed:animate-out"
```

## Checklist Before Submitting UI Code

- [ ] All imports from `~/components/ui/*`, not `@base-ui/react/*` directly
- [ ] Every `<Select>` has `items` prop with `{ label, value }[]`
- [ ] Every `<Combobox>` has `items` prop with `{ label, value }[]`
- [ ] No `asChild` — use `render={<el />}` if needed at primitive level
- [ ] Styling uses `data-open`/`data-closed` not `data-[state=open]`
- [ ] No Radix imports anywhere (`@radix-ui/*`)
