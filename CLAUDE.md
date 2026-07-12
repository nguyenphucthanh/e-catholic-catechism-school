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

## Key References

- See `docs/README.md` for complete database schema and system design, broken into per-section files.
- DB schema is defined in `docs/schema/` (see `docs/README.md`) — follow it strictly
- Phone numbers must be E.164 format

## Tech Stack

- Backend: Convex
- Frontend: Tanstack Start, ShadCN (BaseUI)
