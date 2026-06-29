---
name: project-conventions
description: Convex schema and coding conventions for the e-Catholic Catechism School project — field naming, type mappings, uniqueness patterns, polymorphic refs, and what NOT to store.
metadata:
  type: project
---

## Field naming

camelCase field names in schema (e.g. `academicYearId`, `isPrimaryClass`, `deviceQueuedAt`).

## Type mappings from SYSTEM_DESIGN.md to Convex validators

| Design type       | Convex validator                          | Notes                   |
| ----------------- | ----------------------------------------- | ----------------------- |
| string / text     | `v.string()`                              |                         |
| integer / decimal | `v.number()`                              |                         |
| boolean           | `v.boolean()`                             |                         |
| date              | `v.string()`                              | ISO 8601 YYYY-MM-DD     |
| timestamp         | `v.number()`                              | Unix milliseconds       |
| enum              | `v.union(v.literal(...), ...)`            |                         |
| ref → Table       | `v.id("tableName")`                       |                         |
| optional field    | `v.optional(...)`                         |                         |
| polymorphic ref   | `v.union(v.id("tableA"), v.id("tableB"))` | e.g. accounts.userRefId |

## Uniqueness constraints

Convex has no DB-level unique constraint. All uniqueness rules from §10 of SYSTEM_DESIGN.md are:

1. Enforced at application layer (check before insert/update)
2. Supported by a corresponding index for the lookup (e.g. `by_login_id` on accounts)

## Polymorphic foreign key

`accounts.userRefId` is `v.union(v.id("catechists"), v.id("students"))`.
Use `accounts.accountType` to know which table to look up.

## Computed values — never stored

`weighted_average` and `diligence_score` are always computed at query time from
`scoreEntries` and `attendanceRecords` respectively. Do not add them to any table.

## Boilerplate

The original `convex/myFunctions.ts` (starter boilerplate referencing a `numbers` table) was
replaced with an empty comment file when the schema was introduced. New domain functions go in
purpose-named files under `convex/` (e.g. `convex/students.ts`, `convex/attendance.ts`).

## Testing

Guidelines specify `convex-test` + `vitest` + `@edge-runtime/vm`. No test files exist yet.
When writing tests: use `import.meta.glob("./**/*.ts")` module map, `environment: "edge-runtime"`
in vitest.config.ts.

## Seed / setup

`convex/seed.ts` contains `runSeed` (`internalMutation`) — seeds 6 branches and the first
board-level catechist (Admin) + matching account. Run via:
`npx convex run seed:runSeed --prod` (or without `--prod` for dev).

Password hashing in seed uses SHA-256 via `crypto.subtle` (V8-safe). bcryptjs is NOT installed.
For production-grade hashing, move to a Node.js action with `bcryptjs` + `"use node"`.

memberId is derived post-insert by patching the catechist with its own `_id` (string form)
because `memberId` is required by schema and can't be known before the insert.
