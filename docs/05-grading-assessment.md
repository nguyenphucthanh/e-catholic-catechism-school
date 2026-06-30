[← Back to index](README.md)

## 5. Grading & Assessment Logic

### Score Column Configuration

`ScoreColumn` defines the grading structure per class per semester. Two columns are auto-seeded at semester creation and flagged `is_mandatory = true`: `semester_exam` and `diligence`. These cannot be deleted. All other columns are optional and configurable by the homeroom teacher.

`conduct` is **not** a `ScoreColumn` — it is a qualitative annual assessment stored in `AnnualResult`.

### Score Entry

`ScoreEntry` stores one numeric score per student per column. Only applies to `short_quiz`, `midterm_test`, and `semester_exam`. `diligence` never has `ScoreEntry` rows.

### Score Audit Trail

Every modification to a `ScoreEntry` appends a row to `ScoreEntryHistory`, recording the old value, new value, who changed it, and when. This is append-only and immutable.

### Annual Result

`AnnualResult` is written once per student per class year. It is the only persisted evaluation record. Computed values (`weighted_average`, `diligence_score`) are never stored here.
