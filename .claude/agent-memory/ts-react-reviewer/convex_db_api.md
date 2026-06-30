---
name: convex_db_api
description: Convex db API signatures as shown in project guidelines vs. what the prompt author believes is correct — contradiction to surface in future reviews
metadata:
  type: project
---

The project's `convex/_generated/ai/guidelines.md` (line 261) documents the 3-arg form:
`await ctx.db.patch("tasks", taskId, { completed: true })`
`await ctx.db.replace("tasks", taskId, { ... })`
`await ctx.db.get("users", userId)`

The prompt author believes the 2-arg form is correct for Convex v1.41.0+:
`ctx.db.patch(id, fields)`

These contradict each other. The actual TypeScript types in `convex/_generated/server.ts` are definitive. Do NOT silently pick a side — surface the discrepancy and recommend the dev verify against the generated types.

**Why:** The project guidelines may have auto-generated incorrect example code. The linter "bug" reported in the prompt may actually be an improvement aligned with guidelines — or the guidelines may be wrong. Only the TS types can settle this.

**How to apply:** When reviewing any `ctx.db.patch`, `ctx.db.replace`, or `ctx.db.get` call, flag if the arity doesn't match what you see in existing Convex code in this repo, and recommend checking `convex/_generated/server.ts`.
