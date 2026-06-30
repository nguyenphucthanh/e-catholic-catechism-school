---
name: project-design-system
description: Design system details for e-catholic-catechism-school — component library, tokens, styling approach
metadata:
  type: project
---

## Tech stack

- shadcn/ui style: `base-nova`, zinc base color, CSS variables, Inter Variable font
- Tailwind CSS v4 (via `@import 'tailwindcss'`), tw-animate-css, shadcn/tailwind.css
- Icons: Lucide
- Notifications: Sonner (toast)
- Forms: TanStack Form + zod validators + shadcn Field components (per CLAUDE.md rule)
- Lists: TanStack + shadcn data-table
- State management: React state (no external lib)
- i18n: react-i18next, locales at `src/locales/en.json` and `src/locales/vi.json`

## Currently installed UI components (src/components/ui/)

avatar, breadcrumb, button, card, collapsible, dropdown-menu, input, label, select, separator, sheet, sidebar, skeleton, sonner, textarea, tooltip

## NOT yet installed (available in shadcn registry)

dialog, alert-dialog, badge, checkbox, field, switch, separator (already installed), spinner

## Design tokens (app.css)

- Uses CSS variable tokens: `--color-primary`, `--color-muted`, `--color-muted-foreground`, `--color-destructive`, `--color-border`, `--color-foreground`, `--color-background`, `--color-card`, etc.
- Body: `bg-background text-foreground`, gray-50/gray-950 dark mode
- Font: Inter Variable (sans-serif)

## Layout patterns observed

- Profile page: `flex flex-col gap-6` container, each section is a `<Card>` with `<CardHeader>` + `<CardContent>`
- Forms: `flex flex-col gap-4` inside CardContent; field groups use `grid grid-cols-2 gap-4`
- Field pattern (current): raw `div.flex.flex-col.gap-1.5` + Label + Input + FieldError — CLAUDE.md says should use shadcn Field component instead
- CardHeader with action button: `flex flex-row items-center justify-between`
- Buttons: primary (`default` variant), secondary (`outline`), destructive actions (`ghost` with `text-destructive`)
- Spacing scale: gap-1, gap-1.5, gap-4, gap-6 are the main values used

## Page structure

- `src/routes/_authenticated/profile.tsx` — catechist profile page with Personal Info, Address, and Contacts sections
- Each section is a self-contained component with its own Convex query/mutation hooks

**Why:** Institutional knowledge for consistent future design decisions.
**How to apply:** Always check this before proposing new components or patterns. Favor installed components. When adding new shadcn components, note them here.
