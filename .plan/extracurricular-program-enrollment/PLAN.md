# Plan: Extracurricular Program Enrollment Dialog & Role-Based Candidate Search

## Problem Description
Currently, extracurricular program detail view allows a catechist or student to enroll themselves (`enrollProgram`). However, managers (Admins, Board Members, Branch Heads, and Class Catechists) do not have a feature to search and enroll other catechists or students into an extracurricular program. 

## Objectives & Scope

1. **Backend Candidate Search & Enrollment Mutations (`convex/extracurricularPrograms.ts`)**:
   - `searchEligibleCandidates`: Async query to search candidate participants (catechists or students) for a given program.
     - **Performance**: Require non-empty search query (min 2 chars) so all database candidates are not returned unconditionally.
     - **Program Scope Filtering**: Filter candidate pool based on `program.target` (`'catechist'`, `'student'`, `'all'`) and `program.branches` (if program is restricted to specific branches).
     - **Role-Based Authorization Scoping**:
       - **Admin / Board Member**: Can search & enroll any candidate matching program's target and branch scope.
       - **Branch Head**: Can search & enroll candidates belonging to branch(es) they lead (for students: primary class in led branch; for catechists: branch assignment in led branch).
       - **Class Catechist**: Can search & enroll students belonging to primary class(es) they teach in the active academic year.
   - `enrollParticipant`: Mutation allowing managers to enroll a target participant (catechist ID or student ID) into the program with same authorization checks, capacity check, and enrollment expiration check.

2. **Frontend UI - Participant Enrollment Dialog (`src/components/extracurricular/enroll-participant-dialog.tsx`)**:
   - Add "Enroll Participants" (`extracurricular.enrollOthers`) button on `src/routes/_authenticated/_catechist/extracurricular-programs_.$id.tsx` for authorized managers.
   - Render a large modal dialog containing:
     - **Tabs**: `catechists` and `students`. Tabs conditionally render or switch based on `program.target`:
       - `target === 'catechist'`: Display only Catechists tab.
       - `target === 'student'`: Display only Students tab.
       - `target === 'all'`: Display both Catechists and Students tabs (default to Catechists or Students).
     - **Async Search Input**: Search bar with debounced input.
     - **Empty Search State**: Prompt user to type (e.g. at least 2 characters) before executing query to protect system performance.
     - **Candidate DataTable**: Display Avatar, Name (Saint + Full Name), Code / Class Name, and Enrollment Action ("Enroll" button or "Enrolled" badge).

3. **i18n Translations (`src/locales/vi-VN.json`, `src/locales/en-US.json`)**:
   - Add localized keys for dialog title, tabs, search placeholders, action buttons, role descriptions, and error notifications.

4. **Testing (`convex/extracurricularPrograms.test.ts`)**:
   - Comprehensive unit tests covering:
     - Async search queries for Admin, Branch Head, and Class Catechist roles.
     - Target scope filtering (`catechist`, `student`, `all`).
     - Branch scope restrictions.
     - Manager enrollment mutation and duplicate enrollment prevention.

## Target Files
- `convex/extracurricularPrograms.ts`
- `src/routes/_authenticated/_catechist/extracurricular-programs_.$id.tsx`
- `src/components/extracurricular/enroll-participant-dialog.tsx`
- `src/locales/vi-VN.json`
- `src/locales/en-US.json`
- `convex/extracurricularPrograms.test.ts`
