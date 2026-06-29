---
name: project-schema
description: Full table list, key fields, and index map for the e-Catholic Catechism School Convex schema (convex/schema.ts). 23 tables covering org structure, catechists, students, attendance, grading, and auth.
metadata:
  type: project
---

Schema lives at `convex/schema.ts`. Source of truth: `SYSTEM_DESIGN.md` sections 7, 8, 10.

## Tables (camelCase Convex names → design doc names)

| Convex table          | Design name       | Key fields                                                                                                       |
| --------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| `branches`            | Branch            | name, sortOrder, description?                                                                                    |
| `academicYears`       | AcademicYear      | name, startDate, endDate, timezone, isActive                                                                     |
| `semesters`           | Semester          | academicYearId, semesterNumber (1 or 2), name?                                                                   |
| `classes`             | Class             | branchId, name, description?                                                                                     |
| `classYears`          | ClassYear         | classId, academicYearId, classType                                                                               |
| `catechists`          | Catechist         | memberId, fullName, role, isActive, saintName?, dateOfBirth?, gender?, joinedDate?, notes?                       |
| `catechistAddresses`  | CatechistAddress  | catechistId, country, addressLine1?, city?, stateProvince?, postalCode?, hamlet?, subHamlet?                     |
| `catechistContacts`   | CatechistContact  | catechistId, label, contactType, value, isPrimary, notes?                                                        |
| `catechistClasses`    | CatechistClass    | catechistId, classYearId, role                                                                                   |
| `students`            | Student           | studentCode, fullName, isActive, createdAt, saintName?, dateOfBirth?, gender?, previousParish?, previousDiocese? |
| `studentAddresses`    | StudentAddress    | studentId, country, addressLine1?, city?, stateProvince?, postalCode?, hamlet?, subHamlet?                       |
| `guardians`           | Guardian          | fullName, saintName?, notes?                                                                                     |
| `guardianContacts`    | GuardianContact   | guardianId, contactType, value, isPrimary, notes?                                                                |
| `studentGuardians`    | StudentGuardian   | studentId, guardianId, relationship, contactPriority, notes?                                                     |
| `studentSacraments`   | StudentSacrament  | studentId, sacramentType, receivedDate?, receivedPlace?, notes?                                                  |
| `studentClasses`      | StudentClass      | studentId, classYearId, isPrimaryClass, enrolledDate, status, statusChangedDate?, leftDate?                      |
| `classSessions`       | ClassSession      | classYearId, semesterId, sessionDate, sessionType, isCancelled, notes?                                           |
| `attendanceRecords`   | AttendanceRecord  | sessionId, studentClassId, status, recordedBy, deviceQueuedAt, syncedAt?, notes?                                 |
| `scoreColumns`        | ScoreColumn       | classYearId, semesterId, columnName, columnType, weight?, isMandatory, sortOrder                                 |
| `scoreEntries`        | ScoreEntry        | studentClassId, scoreColumnId, score?, enteredBy, enteredAt, updatedAt?                                          |
| `scoreEntryHistories` | ScoreEntryHistory | scoreEntryId, oldScore?, newScore?, changedBy, changedAt, reason?                                                |
| `annualResults`       | AnnualResult      | studentClassId, conductGrade?, remark?, isCompleted?, recordedBy?, recordedAt?                                   |
| `accounts`            | Account           | loginId, passwordHash, accountType, userRefId, isActive, createdAt, lastLoginAt?                                 |

## Key enum values

- `classYears.classType`: primary | apostle | sacrament_review | supplemental_other
- `catechists.role`: catechist | branch_deputy | branch_leader | board
- `catechistClasses.role` / `catechistContacts.contactType` / `guardianContacts.contactType`: see design doc §8
- `studentClasses.status`: active | on_leave | withdrawn
- `classSessions.sessionType`: mass | catechism | supplemental | extracurricular
- `attendanceRecords.status`: present | excused_absence | unexcused_absence | late
- `scoreColumns.columnType`: short_quiz | midterm_test | semester_exam | diligence
- `annualResults.conductGrade`: excellent | good | average | below_average | poor
- `accounts.accountType`: catechist | student

## Indexes defined (summary of non-obvious ones)

- `guardianContacts.by_value` — phone-number lookup flow
- `attendanceRecords.by_synced_at` — monitor unsynced offline records
- `studentClasses.by_student_id_and_is_primary_class` — find student's primary class
- `classYears.by_class_id_and_academic_year_id` — uniqueness enforcement
- All composite uniqueness constraints are enforced at application layer (Convex has no DB-level unique constraint)

## Computed values — NEVER stored

- `weighted_average` = SUM(score × weight) / SUM(weight) over ScoreEntry
- `diligence_score` = COUNT(present|late) / COUNT(non-cancelled sessions) × 10
