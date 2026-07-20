# E-Catholic Catechism School UI — conventions

A shadcn-style component library built on **Base UI** (`@base-ui/react`, NOT Radix) and **Tailwind CSS v4**. Every component is exported from `window.ECatholicUI.*` and styled with Tailwind utility classes that resolve against a token layer defined as CSS custom properties. Use the real components — never hand-roll markup that mimics them.

## No wrapper/provider needed

Components render standalone — there is no required theme provider or root wrapper. The design tokens live in `styles.css` (already loaded), so a component like `Button` or `Card` is styled the moment it mounts. (An optional `DirectionProvider` exists for RTL but is not needed for LTR layouts.)

## Styling idiom: Tailwind v4 utilities + semantic tokens

Style your own layout glue with **Tailwind utility classes**. Colors, radius, and spacing come from **semantic CSS variables** — always prefer the semantic token utility over a raw color, so light/dark and brand changes flow through automatically.

Color token utilities (each has a `bg-`, `text-`, and where sensible `border-` form):

| Token                                    | Utility examples                         | Use for                         |
| ---------------------------------------- | ---------------------------------------- | ------------------------------- |
| `primary` / `primary-foreground`         | `bg-primary text-primary-foreground`     | primary actions, brand (violet) |
| `secondary` / `secondary-foreground`     | `bg-secondary text-secondary-foreground` | secondary surfaces              |
| `muted` / `muted-foreground`             | `bg-muted text-muted-foreground`         | subtle backgrounds, helper text |
| `accent` / `accent-foreground`           | `bg-accent text-accent-foreground`       | hover/active highlights         |
| `destructive` / `destructive-foreground` | `bg-destructive text-destructive`        | delete/danger                   |
| `card` / `card-foreground`               | `bg-card text-card-foreground`           | card surfaces                   |
| `popover` / `popover-foreground`         | `bg-popover`                             | overlays, menus                 |
| `background` / `foreground`              | `bg-background text-foreground`          | page base                       |
| `border` / `input` / `ring`              | `border-border ring-ring`                | borders, focus rings            |
| `sidebar*`                               | `bg-sidebar text-sidebar-foreground`     | sidebar chrome                  |

Radius uses `--radius` (base `1rem`) via `rounded-lg`, `rounded-md`, `rounded-xl`. Font families: `--font-sans` (Inter Variable, shipped), `--font-serif`, `--font-mono`. Spacing/typography are standard Tailwind (`gap-3`, `p-4`, `text-sm`, `font-medium`).

Prefer semantic tokens over raw palette (`bg-primary`, not `bg-violet-600`). Don't invent class names — if a utility isn't in the compiled `styles.css` closure, it won't apply.

## Where the truth lives

- **`styles.css`** and its `@import` closure (incl. `_ds_bundle.css`) — the full token + utility set. Read it before styling.
- **`components/general/<Name>/<Name>.d.ts`** — the prop contract for each component.
- **`components/general/<Name>/<Name>.prompt.md`** — per-component usage/examples.

## Component API notes (Base UI specifics)

- **Compound components** export flat parts, e.g. `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter` — compose them, they are not `Dialog.Trigger` namespaced.
- **Anchored overlays** (`Popover`, `DropdownMenu`, `Tooltip`) require their `*Trigger` to position correctly — always include it.
- **`DropdownMenuLabel`** must sit inside a `DropdownMenuGroup`.
- **`Accordion`** multi-open uses the `openMultiple` prop (not `type="multiple"`).
- **`Select` / `Combobox`** are uncontrolled via `defaultValue`; the trigger text auto-syncs to the selection.
- Triggers commonly merge onto a styled `Button` via `render={<Button .../>}`.

## Idiomatic example

```tsx
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '...'
import { Button } from '...'
import { Badge } from '...'

;<Card className="w-80">
  <CardHeader>
    <CardTitle>Sơ Cấp 1</CardTitle>
    <CardDescription>24 students · Thứ Bảy 14:00</CardDescription>
  </CardHeader>
  <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
    <Badge>Enrolled</Badge>
    <span>Room Phòng 2B</span>
  </CardContent>
  <CardFooter className="justify-end gap-2">
    <Button variant="outline">Details</Button>
    <Button>Take attendance</Button>
  </CardFooter>
</Card>
```
