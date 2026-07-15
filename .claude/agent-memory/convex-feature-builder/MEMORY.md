# Agent Memory Index

- [Schema structure](project_schema.md) — Full table/field/index map for all 23 Convex tables; camelCase field names; key type mappings from design doc
- [Project conventions](project_conventions.md) — Naming conventions, type mappings, uniqueness enforcement patterns, polymorphic ref pattern
- [Convex test patterns](project_convex_test_patterns.md) — mutations vs actions for CPU work (bcrypt), Date.now() trick for convex-test, coverage table quirks
- [Demo-data seeding system](project_demo_data_seeding.md) — convex/demoData.ts + seed.ts + crons.ts architecture, CONVEX_DEPLOYMENT gate, same-file ctx.runMutation circularity gotcha, seed.ts is coverage-excluded
- [Codegen side effects](feedback_codegen_side_effects.md) — `npx convex codegen` also uploads functions to the linked deployment, not purely local
