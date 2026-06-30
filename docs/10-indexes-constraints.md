[← Back to index](README.md)

## 10. Indexes & Constraints

### Uniqueness Constraints

| Collection         | Unique on                             | Notes                                         |
| ------------------ | ------------------------------------- | --------------------------------------------- |
| `Account`          | `login_id`                            |                                               |
| `Student`          | `student_code`                        |                                               |
| `Catechist`        | `member_id`                           |                                               |
| `AcademicYear`     | `name`                                |                                               |
| `Semester`         | `(academic_year_id, semester_number)` | Composite                                     |
| `ClassYear`        | `(class_id, academic_year_id)`        | Composite                                     |
| `CatechistAddress` | `catechist_id`                        |                                               |
| `CatechistClass`   | `(catechist_id, class_year_id)`       | Composite                                     |
| `StudentAddress`   | `student_id`                          |                                               |
| `StudentGuardian`  | `(student_id, guardian_id)`           | Composite                                     |
| `StudentGuardian`  | `(student_id, contact_priority)`      | Composite — no duplicate priority per student |
| `StudentClass`     | `(student_id, class_year_id)`         | Composite                                     |
| `StudentSacrament` | `(student_id, sacrament_type)`        | Composite                                     |
| `AttendanceRecord` | `(session_id, student_class_id)`      | Composite                                     |
| `ScoreEntry`       | `(student_class_id, score_column_id)` | Composite                                     |
| `AnnualResult`     | `student_class_id`                    |                                               |

### Query Indexes

| Collection          | Index on                         | Used for                                                               |
| ------------------- | -------------------------------- | ---------------------------------------------------------------------- |
| `Student`           | `is_active`                      | Filtering active students                                              |
| `ClassYear`         | `academic_year_id`               | All classes in a year                                                  |
| `ClassYear`         | `class_id`                       | All year instances of a class                                          |
| `CatechistClass`    | `catechist_id`                   | All classes a catechist teaches                                        |
| `CatechistClass`    | `class_year_id`                  | All catechists in a class                                              |
| `StudentClass`      | `student_id`                     | All enrollments for a student                                          |
| `StudentClass`      | `class_year_id`                  | All students in a class                                                |
| `StudentClass`      | `(student_id, is_primary_class)` | Student's primary class                                                |
| `StudentClass`      | `status`                         | Filter by enrollment status                                            |
| `StudentGuardian`   | `student_id`                     | All guardians for a student                                            |
| `StudentGuardian`   | `guardian_id`                    | All students linked to a guardian                                      |
| `GuardianContact`   | `guardian_id`                    | All contacts for a guardian                                            |
| `GuardianContact`   | `value`                          | **Phone-number lookup**                                                |
| `ClassSession`      | `(class_year_id, semester_id)`   | All sessions for a class in a semester                                 |
| `ClassSession`      | `session_date`                   | Sessions by date                                                       |
| `ClassSession`      | `(session_type, session_date)`   | Find-or-create parish session for mass/extracurricular on a given date |
| `AttendanceRecord`  | `session_id`                     | All attendance for a session                                           |
| `AttendanceRecord`  | `student_class_id`               | All attendance for a student                                           |
| `AttendanceRecord`  | `synced_at`                      | Monitor unsynced offline records                                       |
| `ScoreColumn`       | `(class_year_id, semester_id)`   | Grade structure for a class semester                                   |
| `ScoreEntry`        | `student_class_id`               | All scores for a student                                               |
| `ScoreEntry`        | `score_column_id`                | All scores for a column                                                |
| `ScoreEntryHistory` | `score_entry_id`                 | Audit trail for a score                                                |
| `AnnualResult`      | `student_class_id`               | Year-end evaluation                                                    |
| `StudentSacrament`  | `student_id`                     | All sacraments for a student                                           |
| `CatechistContact`  | `catechist_id`                   | All contacts for a catechist                                           |
