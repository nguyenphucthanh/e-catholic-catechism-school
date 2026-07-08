---
name: coverage_text_table_missing_row_quirk
description: vitest's v8 text coverage table can silently drop a fully-covered file's row — verify via lcov.info, not the printed table, before concluding a file lacks coverage
metadata:
  type: project
---

When running `npm test -- --coverage <pattern>` scoped to one test file, the printed text-reporter table for `convex/` sometimes omits a row for a file entirely (not "0%" — just missing from the list, e.g. `calendarEvents.ts` vanished between `branches.ts` and `catechistPermissions.ts` in the alphabetical listing) even though the file was fully exercised and instrumented.

**Why:** Confirmed via `coverage/lcov.info` (`awk '/^SF:convex\/foo.ts$/,/^end_of_record$/' coverage/lcov.info | grep -E "^LF:|^LH:|^FNF:|^FNH:|^BRF:|^BRH:"`) that the file's line/branch/function totals were baked into the parent directory subtotal and the "All files" grand total — the data is correct, only the per-file text row rendering dropped it. Root cause not identified (possibly a vitest v4 text-reporter width/truncation bug), but it is reproducible and not caused by test file changes.

**How to apply:** If a coverage threshold command claims a file is missing or 0% but you have reason to believe it's tested (e.g. tests reference `api.module.fn` and pass), don't trust the printed table — cross-check `coverage/lcov.info` directly with the awk command above, or grep `FNDA:`/`DA:` lines for the specific function/line ranges you added (e.g. new authz.ts permission functions). Report actual coverage numbers from lcov, not from the possibly-truncated console table.

See [[convex_backend_test_pattern]] for the test-writing convention this was discovered while verifying.
