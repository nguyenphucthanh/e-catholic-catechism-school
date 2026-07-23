---
name: orchestration
description: Entry point for structured task execution (planning, design, implementation). Use when executing multi-phase workflows, creating git worktrees, orchestrating planner/designer/coder steps, or invoking /orchestration.
---

# Orchestration Skill

Entry point for structured task execution: planning → design (if needed) → implementation.

## Usage

```
/orchestration <task-description>
```

Example:

```
/orchestration I want to build a student attendance dashboard showing real-time class status
```

## What This Skill Does

When you invoke `/orchestration`, Claude will:

1. **Parse task description** from your input
2. **Auto-slugify task name** (e.g., "student-attendance-dashboard")
3. **Create infrastructure**:
   - Git worktree for isolated work: `git worktree add <path> -b <branch>`.
   - `/.plan/<task-name>/` folder for artifacts
4. **Orchestrate multi-phase workflow** (sequential, blocking):
   - **Planner**: Interview to clarify goals → produce PLAN.md
   - **Designer**: Design decisions & mockups (if complex) → produce DESIGN.md
   - **Coder**: Implement code & tests → produce IMPLEMENTATION.md
5. **Finalize**:
   - Auto-commit changes in worktree
   - Push to new branch
   - Open GitHub PR
   - Write REPORT.md with full summary
   - Report results to you

## Artifacts Produced

All saved to `/.plan/<task-name>/`:

- `PLAN.md` — What to build (goals, scope, success criteria)
- `DESIGN.md` — How to design it (mockups, component structure, decisions)
- `IMPLEMENTATION.md` — What was built (files changed, test coverage, quality checks)
- `REPORT.md` — Complete execution summary

## Resume Mode

If something fails or needs changes:

1. Fix it manually (edit PLAN.md, DESIGN.md, code, etc.)
2. Tell the Orchestration: "resume from planner" / "resume from designer" / "resume from coder"
3. Orchestration skips completed phases and restarts from your point

## What NOT to Do

- Orchestration will NOT merge changes automatically — you review and decide
- Orchestration will NOT cleanup worktree — leave it for your manual testing
- Orchestration will NOT delete plan folder — keep it for reference

## Next Steps

Invoke with: `/orchestration your task description here`

The Orchestrator agent will take it from there.
