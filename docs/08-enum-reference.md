[← Back to index](README.md)

## 8. Enum Reference

| Table              | Column           | Allowed Values                                                   |
| ------------------ | ---------------- | ---------------------------------------------------------------- |
| `ClassYear`        | `class_type`     | `primary`, `apostle`, `sacrament_review`, `supplemental_other`   |
| `Catechist`        | `role`           | `catechist`, `branch_deputy`, `branch_leader`, `board`           |
| `CatechistClass`   | `role`           | `homeroom`, `co_teacher`                                         |
| `CatechistContact` | `contact_type`   | `phone`, `email`, `zalo`, `other`                                |
| `GuardianContact`  | `contact_type`   | `phone`, `email`, `zalo`, `other`                                |
| `StudentSacrament` | `sacrament_type` | `baptism`, `first_confession`, `first_communion`, `confirmation` |
| `StudentClass`     | `status`         | `active`, `on_leave`, `withdrawn`                                |
| `ClassSession`     | `session_type`   | `mass`, `catechism`, `supplemental`, `extracurricular`           |
| `AttendanceRecord` | `status`         | `present`, `excused_absence`, `unexcused_absence`, `late`        |
| `ScoreColumn`      | `column_type`    | `short_quiz`, `midterm_test`, `semester_exam`, `diligence`       |
| `AnnualResult`     | `conduct_grade`  | `excellent`, `good`, `average`, `below_average`, `poor`          |
| `Account`          | `account_type`   | `catechist`, `student`                                           |
