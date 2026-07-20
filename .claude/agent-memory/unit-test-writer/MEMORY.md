# Memory Index

- [Convex useQuery mocking](convex_useQuery_mocking.md) — multi-query branch pattern via Symbol.for('functionName'), reference test files, provider-effect testing gotcha
- [BaseUI interaction gotchas](baseui_interaction_gotchas.md) — pointerDown-before-click for Select, Combobox opens on mousedown only, Popover opens on plain click, i18n mock ignores defaultValue, useMutation mock needs `as any`, pretty-format crash on Convex proxy diffs
- [Pre-existing test failures](project_pre_existing_test_failures.md) — RESOLVED 2026-07-05, full suite now green; history of 3 old failure clusters kept for context only
- [Date mocking with fake timers](date_mocking_fake_timers.md) — vi.useFakeTimers/setSystemTime pattern for components computing "today"/week-range from new Date() internally
- [Pure hook + CSV parser gotchas](pure_hook_and_csv_parser_gotchas.md) — renderHook needs no provider for plain useMemo hooks; duplicate inline arrow coerce fns in field-def tables need per-entry tests; coverage table can drop a folder's row
- [Testing root beforeLoad guard](testing_root_beforeLoad_guard.md) — per-file vi.mock override of @tanstack/react-router + react-i18next to unit-test __root.tsx's beforeLoad redirect logic despite global stub mocks
- [CSV export testing pattern](csv_export_testing_pattern.md) — mock `~/lib/export`'s exportCsv, assert rows/headers/filename, name-sort verification trick, import/order eslint gotcha
- [Convex backend test pattern](convex_backend_test_pattern.md) — convex-test/vitest boilerplate, shared seed helpers, `.rejects.toThrow('ERROR_CODE')` style, reference files
- [Coverage table missing row quirk](coverage_text_table_missing_row_quirk.md) — verify via `coverage/lcov.info` when a fully-tested file's row vanishes from the printed text table
- [Photobooth queue end-state gotcha](photobooth_queue_end_state_gotcha.md) — usePhotoboothQueue only reaches isDone via confirm(); missingStudents branch needs a mocked hook return, not real fireEvent clicks
