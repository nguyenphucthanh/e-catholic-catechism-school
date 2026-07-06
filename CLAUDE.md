<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

# Project: Trường Giáo Lý Management System

## Agents Rules

- **UI work**: Only invoke `/shadcn-baseui` skill when the user explicitly mentions it (to save tokens). This project uses Base UI (`@base-ui/react`), not Radix — patterns differ.
- Component/function creation requires unit tests via `unit-test-writer` agent.
- Test coverage minimum **75%** (statements, branches, functions, lines) — verified via `npm test -- --coverage`. Only need to test files that are related to current task and ignore the whole test suite.

## Key References

- See `docs/README.md` for complete database schema and system design, broken into per-section files.

## Tech Stack

- Backend: Convex
- Frontend: Tanstack Start, ShadCN (BaseUI)

## Important Rules

- DB schema is defined in `docs/schema/` (see `docs/README.md`) — follow it strictly
- Do not store computed values (weighted_average, diligence_score)
- Phone numbers must be E.164 format
- **Never edit files in `src/components/ui/`** — these are shadcn-generated base components. Fix type/usage mismatches at the call site instead. If a base component genuinely needs changing, regenerate/update it via shadcn CLI, don't hand-edit.

## UI Development Rules

- shadcn as first choice. Use shadcn MCP to find components and examples. Skip custom HTML/CSS when shadcn covers need.
- Notifications via Sonner.
- All views: page header with title (+ description optional).
- **List views** (/<entities>/): TanStack + shadcn data-table, backend pagination/filter/sort.
  - Global search input above table.
  - Grouping dropdown (default: first column).
  - Sorting enabled.
  - Badges for indicator fields.
  - Actions in dropdown menu.
- **Detail views** (/<entities>/$id): shadcn layout/card components.
- **Create/edit views** (/<entities>/create, /<entities>/<id>/edit): zod + TanStack Form + shadcn Field.
  - Confirmation to leave before save.
  - Fields split by group with descriptions.
  - Pattern: see `/shadcn-baseui` skill for form anatomy example.
- **Delete**: shadcn dialog confirmation.
- **Breadcrumbs**: set `staticData: { crumb: '<i18n-key>' }` in `createFileRoute(...)`. Trail built from `useMatches()` in `_authenticated.tsx`, rendered above `<Outlet />`.
