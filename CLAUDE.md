# Project: Trường Giáo Lý Management System

## Agents Rules

**IMPORTANT**: Before writing, reviewing, or refactoring any code, consult the `karpathy-guidelines` skill — avoids overcomplication, keeps changes surgical, surfaces assumptions.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

- **UI work**: Only invoke `/shadcn-baseui` skill when the user explicitly mentions it (to save tokens). This project uses Base UI (`@base-ui/react`), not Radix — patterns differ.
- Component/function creation requires unit tests via `unit-test-writer` agent.
- Test coverage minimum **75%** (statements, branches, functions, lines) — verified via `npm test -- --coverage`. Only need to test files that are related to current task and ignore the whole test suite.

## Coding Rules

### Frontend Anti-Patterns

- **Never edit** `src/components/ui/*` — these are shadcn-generated. Fix mismatches at call site. Regenerate via shadcn CLI if base component truly needs changing.
- **Shadcn (BaseUI) first** — use shadcn MCP to find components when you need to compose new component from shadcn components or when you was asked to call shadcn mcp. Skip custom HTML/CSS when shadcn covers need. Shadcn use BaseUI under the hood, **DO NOT** use RadixUI patterns.
- **Notifications** via Sonner.
- Shadcn Select, Combobox components need `items` prop to display selected value with correct label.
- **All views** need page header with title (+ description optional).
- **List views** (`/<entities>/`): TanStack + shadcn data-table, backend pagination/filter/sort.
  - Global search input above table.
  - Grouping dropdown (default: first column).
  - Sorting enabled. Badges for indicator fields. Actions in dropdown menu.
- **Detail views** (`/<entities>/$id`): shadcn layout/card components.
- **Create/edit views** (`/<entities>/create`, `/<entities>/<id>/edit`): zod + TanStack Form + shadcn Field.
  - Confirmation to leave before save. Fields split by group with descriptions.
- **Delete**: shadcn dialog confirmation.
- **Breadcrumbs**: set `staticData: { crumb: '<i18n-key>' }` in `createFileRoute(...)`. Trail built from `useMatches()` in `_authenticated.tsx`, rendered above `<Outlet />`.
- **Attendance status colors**: Grey#9CA3AF (unset), Green#10B981 (present), Yellow#F59E0B (late), Purple#8B5CF6 (excused), Red#EF4444 (unexcused). Use corresponding lucide-react icons (Circle, CheckCircle2, Clock, AlertCircle, AlertTriangle).
- **Exports (CSV/PDF)**: Place logic in `src/lib/export.ts`. Export only filtered/sorted table data, not raw response. PDF requires `pdfmake` + bundled Roboto font (Vietnamese diacritics); never jsPDF built-in fonts.
- **Person names**: always `${saintName} ${fullName}`. Use `formatPersonName()` from `src/lib/name.ts`. Put `saintName` field before `fullName` in forms.
- **Button navigation**: use TanStack Router `Link` (not `useNavigate()`), render via Button's `render` prop for `<a>` and tab support.
- Button should have `nativeButton={false}` if it's going to render as non-button.

### Data Model Anti-Patterns

- **Hard delete** — never `ctx.db.delete()` user-facing entities. Flip `is_deleted` flag. Queries filter `is_deleted = false`; historical resolves through soft-deleted rows.
- **Writing to locked academic year** — mutations touching year-scoped entities must check `academic_year.is_active = true`. Don't skip because UI prevents it — enforce at mutation layer.
- **Raw phone strings** — normalize with `parsePhoneNumber(value).format('E.164')` (`libphonenumber-js`) before writing.
- **Zero-padding IDs in storage** — `member_id`/`student_code` stored as raw integers. Padding is display-only; don't pad before storing/lookup.

### Testing Anti-Patterns

- **Skipping unit tests** — required per project rule. Written via `unit-test-writer` agent, not skipped for "small changes."
- **Chasing 100% coverage** — only files touched by current task need to clear 75% bar. Don't fix entire suite's coverage for unrelated changes.
- **Mocking to bypass real constraints** — OK for unrelated setup. Wrong when testing the constraint itself. Exercise actual mutation path.

## Key References

- Convex schema source of truth: `convex/schema.ts`
- TypeScript types source of truth: `src/**/*.ts` (use `FunctionReturnType` for Convex query types)
- See `docs/README.md` for system design orientation (conceptual, not prescriptive)
- Phone numbers must be E.164 format
