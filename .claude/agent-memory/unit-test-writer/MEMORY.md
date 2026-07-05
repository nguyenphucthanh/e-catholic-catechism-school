# Memory Index

- [Convex useQuery mocking](convex_useQuery_mocking.md) — multi-query branch pattern via Symbol.for('functionName'), reference test files, provider-effect testing gotcha
- [BaseUI interaction gotchas](baseui_interaction_gotchas.md) — pointerDown-before-click for Select, Popover opens on plain click, i18n mock ignores defaultValue, useMutation mock needs `as any`, flatMap reorder gotcha
- [Pre-existing test failures](project_pre_existing_test_failures.md) — 7 known-flaky blur-validation tests unrelated to unit-test-writer's changes, confirmed via git stash as of 2026-07-02
- [Date mocking with fake timers](date_mocking_fake_timers.md) — vi.useFakeTimers/setSystemTime pattern for components computing "today"/week-range from new Date() internally
