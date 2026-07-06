# Memory Index

- [Convex useQuery mocking](convex_useQuery_mocking.md) — multi-query branch pattern via Symbol.for('functionName'), reference test files, provider-effect testing gotcha
- [BaseUI interaction gotchas](baseui_interaction_gotchas.md) — pointerDown-before-click for Select, Combobox opens on mousedown only, Popover opens on plain click, i18n mock ignores defaultValue, useMutation mock needs `as any`, pretty-format crash on Convex proxy diffs
- [Pre-existing test failures](project_pre_existing_test_failures.md) — RESOLVED 2026-07-05, full suite now green; history of 3 old failure clusters kept for context only
- [Date mocking with fake timers](date_mocking_fake_timers.md) — vi.useFakeTimers/setSystemTime pattern for components computing "today"/week-range from new Date() internally
- [Pure hook + CSV parser gotchas](pure_hook_and_csv_parser_gotchas.md) — renderHook needs no provider for plain useMemo hooks; duplicate inline arrow coerce fns in field-def tables need per-entry tests; coverage table can drop a folder's row
