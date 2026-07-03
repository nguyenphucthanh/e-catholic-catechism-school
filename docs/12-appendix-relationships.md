[← Back to index](README.md)

## 12. Appendix: Table Relationship Summary

```
AcademicYear ──< Semester
AcademicYear ──< ClassYear >── Class >── Branch

ClassYear ──< CatechistClass >── Catechist
ClassYear ──< StudentClass   >── Student
ClassYear ──< ClassSession

ClassSession ──< AttendanceRecord >── StudentClass
ClassSession ── Semester

Semester ──< ScoreColumn >── ClassYear
ScoreColumn ──< ScoreEntry >── StudentClass
ScoreEntry ──< ScoreEntryHistory

StudentClass ──── SemesterResult          (1 per student per semester, `(student_class_id, semester_id)` unique)
  ↑ attendance_summary: raw counts of present/late/excused_absence/unexcused_absence
                        computed from AttendanceRecord  (never stored)

StudentClass ──── AnnualResult           (1-to-1, written once at year end)

Student ──── StudentAddress             (1-to-1)
Student ──< StudentSacrament
Student ──< StudentGuardian >── Guardian
                                Guardian ──< GuardianContact
                                  (phone lookup: GuardianContact.value → Guardian → StudentGuardian → Student[])

Catechist ──── CatechistAddress         (1-to-1)
Catechist ──< CatechistContact

Account >── Catechist  (when account_type = 'catechist')
Account >── Student    (when account_type = 'student', parent login)
```

---

_Document version: 2.0 — consolidated from giao-ly-db-design.md (v1.4) + attendance-design.md (v1.0). Includes all design decisions from full requirements session._
