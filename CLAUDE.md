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

- Always invoke the `/caveman` skill at the start of every session.
- Every component/function creation or update must include unit tests — delegate to the `unit-test-writer` agent.
- Code review should be handled by `ts-react-reviewer` agent.
- **Test coverage**: The `unit-test-writer` agent must ensure a minimum of **85% coverage** across statements, branches, functions, and lines. Tests are only considered complete when `npm test -- --coverage` reports all four metrics at or above 85%. If any metric falls below 85%, add more tests before marking the task done.

## Key References

- See `docs/README.md` for complete database schema and system design, broken into per-section files.

## Tech Stack

- Backend: Convex
- Frontend: Tanstack Start, ShadCN (BaseUI)

## Important Rules

- DB schema is defined in `docs/schema/` (see `docs/README.md`) — follow it strictly
- Do not store computed values (weighted_average, diligence_score)
- Phone numbers must be E.164 format

## UI Development Rules

- Use shadcn components as first choice for all UI. Use shadcn MCP (`mcp__shadcn__*`) to find components and usage examples. Avoid custom HTML elements or extra CSS classes when shadcn covers the need.
- Use Sonner for notifications.
- **All Views**: Should have page header with title and description (optional).
- **List views** (at route /<entities>/): use TanStack + shadcn data-table. Backend pagination / filter / sorting is prefered
  - Always have a global search input above data table
  - If data is possible to group by a specific field, add dropdown to select group field (by default group by first column)
  - Always enable sorting
  - Use **Badge** component for indicator fields
  - If each row have actions buttons, group actions in a dropdown menu
- **Detail views** (at route /<entities>/$id): use shadcn layout/card components.
- **Create/edit views** (at route /<entities>/create, /<entities>/<id>/edit): always combine zod (schema) + TanStack Form + shadcn Field components.
  - Always have confirmation to leave before saving.
  - Split fields into sections based on field group. Always have a description for each section. Checkout anatony below

```
<form
  onSubmit={(e) => {
    e.preventDefault()
    form.handleSubmit()
  }}
>
  <FieldGroup>
    <form.Field
      name="title"
      children={(field) => {
        const isInvalid =
          field.state.meta.isTouched && !field.state.meta.isValid
        return (
          <Field data-invalid={isInvalid}>
            <FieldLabel htmlFor={field.name}>Bug Title</FieldLabel>
            <Input
              id={field.name}
              name={field.name}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              aria-invalid={isInvalid}
              placeholder="Login button not working on mobile"
              autoComplete="off"
            />
            <FieldDescription>
              Provide a concise title for your bug report.
            </FieldDescription>
            {isInvalid && <FieldError errors={field.state.meta.errors} />}
          </Field>
        )
      }}
    />
  </FieldGroup>
  <Button type="submit">Submit</Button>
</form>
```

- **Delete**: use shadcn dialog to confirm deletion.
- **Breadcrumbs**: every route must set `staticData: { crumb: '<i18n-key>' }` in `createFileRoute(...)` so it appears in trail. Breadcrumb trail built from `useMatches()` in `_authenticated.tsx`, rendered above `<Outlet />` (not in header).
