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

### UI Development

- **Never edit** `src/components/ui/*` — these are shadcn-generated. Fix mismatches at call site. Regenerate via shadcn CLI if base component truly needs changing.
- **Shadcn first** — use shadcn MCP to find components. Skip custom HTML/CSS when shadcn covers need.
- **Notifications** via Sonner.
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

### Backend Anti-Patterns (Convex)

- **`.filter()` in queries** — never. Define index in schema, query with `.withIndex(...)`. `.filter()` full-scans.
- **`.collect().length` for counts** — maintain denormalized counter doc if count must stay cheap.
- **`.collect()` / `.take(n)` to delete** — batch with `.take(n)`, loop `ctx.db.delete()`, repeat until empty.
- **Unbounded array field** — hits 1MB doc limit. Use child table + foreign key instead.
- **`userId` passed as function arg** — never trust client identity. Always derive via `ctx.auth.getUserIdentity()` server-side.
- **`identity.subject` as key** — use `identity.tokenIdentifier` (guaranteed stable).
- **`ctx.db` inside action** — actions have no DB access. Call queries/mutations via `ctx.runQuery`/`ctx.runMutation`.
- **`"use node"` mixed with queries/mutations** — split into separate files. Only actions run in Node.
- **Eligibility-query / mutation predicate drift** — query predicate must mirror mutation's _actual_ check exactly. Seen bug: query flagged any active/on_leave enrollment, but mutation only rejected primary-class conflicts — blocked valid transfers.
- **`sortBy` validator drift** — frontend column IDs must exist in backend's `sortBy` union validator, or runtime `ArgumentValidationError`. When adding sortable column, check backend validator or disable sorting.
- **Read-side unscoped vs write-side scoped** — `getEligible*` queries must apply same authorization scope as their mutation counterpart.

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

## Tech Stack

- Backend: Convex
- Frontend: Tanstack Start, ShadCN (BaseUI)

## Agent skills

### Issue tracker

Issues tracked in GitHub Issues (`nguyenphucthanh/e-catholic-catechism-school`), via `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default 5 canonical labels (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.
