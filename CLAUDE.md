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

## Claude Rules

- Always invoke the `/caveman` skill at the start of every session.

## Key References

- See `SYSTEM_DESIGN.md` for complete database schema and system design.

## Tech Stack

- Backend: Convex
- Frontend: Tanstack Start, ShadCN (BaseUI)

## Important Rules

- DB schema is defined in SYSTEM_DESIGN.md — follow it strictly
- Do not store computed values (weighted_average, diligence_score)
- Phone numbers must be E.164 format

## UI Development Rules

- Use shadcn components as first choice for all UI. Use shadcn MCP (`mcp__shadcn__*`) to find components and usage examples. Avoid custom HTML elements or extra CSS classes when shadcn covers the need.
- Use Sonner for notifications.
- **List views**: use TanStack + shadcn data-table.
- **Detail views**: use shadcn layout/card components.
- **Create/edit views**: always combine zod (schema) + TanStack Form + shadcn Field components.
