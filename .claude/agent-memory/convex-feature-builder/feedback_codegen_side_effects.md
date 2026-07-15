---
name: codegen-side-effects
description: npx convex codegen actually uploads functions to the linked Convex deployment, not just local type generation
metadata:
  type: feedback
---

`npx convex codegen` is needed after adding/removing/renaming Convex modules (new files under `convex/`) so `convex/_generated/api.d.ts` picks up the new `api.<module>.*` references — plain `tsc --noEmit` will show false "Property does not exist" errors on `api.*` until codegen runs.

**Why it matters:** the command's output shows it also does "Downloading current deployment state..." / "Uploading functions to Convex..." — it is not a pure offline codegen step, it syncs against whatever Convex deployment is linked in this project. Confirmed during the attendance.ts module-split refactor (2026-07-15) when new files (attendanceQueries.ts, attendanceHealth.ts, parishAttendance.ts) needed picking up.

**How to apply:** if the user cares about not touching the linked deployment (e.g. a shared dev/staging backend), flag this before running codegen, or ask whether they'd prefer `npx convex dev --once` / a different flag. When just doing a structural refactor with no deploy intent, it's still the only practical way to refresh `_generated/api.d.ts` locally in this repo.
