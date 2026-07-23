# Design: Extracurricular Program Participant Enrollment

## UI & UX Specification

### Enrollment Dialog (`EnrollParticipantDialog`)
- **Trigger**: "Enroll Participants" button in the program detail page action bar or enroll section (visible when user is Admin, Board Member, Branch Head, or Class Catechist).
- **Dialog Layout**:
  - **Header**: Title "Enroll Participants" (`extracurricular.enrollParticipantsTitle`), Description explaining target scope.
  - **Tabs Container**:
    - Controlled or uncontrolled tab state defaulting to available target tab (`catechist` or `student`).
    - Standard shadcn/Base UI `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`.
    - Tab 1: **Catechists** (`t('extracurricular.type.catechist')`) — shown when `program.target === 'catechist'` or `'all'`.
    - Tab 2: **Students** (`t('extracurricular.type.student')`) — shown when `program.target === 'student'` or `'all'`.
  - **Tab Content**:
    - Search Input field with search icon (`Search` from `lucide-react`) and placeholder e.g. "Search by name or code...".
    - Search State handling:
      - **Empty / Short Search Query (< 2 chars)**: Card or alert message stating "Please type at least 2 characters to search...". No backend query triggered.
      - **Loading State**: Spinner / Skeleton table rows during Convex query fetch.
      - **No Results**: Clean empty table state "No matching participants found".
      - **Results Table**: TanStack / Shadcn DataTable:
        - Column 1: Participant (Avatar + Saint Name & Full Name)
        - Column 2: Code / Class (Member ID for Catechist, Student Code + Class Name for Student)
        - Column 3: Action:
          - If `isAlreadyEnrolled === true`: Disabled Badge "Enrolled" (`extracurricular.enrolled`)
          - If `isAlreadyEnrolled === false`: Button "Enroll" (`extracurricular.enroll`), loading spinner when submitting.
  - **Footer**: Close button.

## Backend Schema & API Interface

### Query: `api.extracurricularPrograms.searchEligibleCandidates`
- **Arguments**:
  - `programId`: `Id<'extracurricularPrograms'>`
  - `requesterId`: `Id<'catechists'>`
  - `type`: `'catechist' | 'student'`
  - `search`: `v.optional(v.string())`
- **Return Type**: `Array<CandidateRow>`
  ```ts
  interface CandidateRow {
    id: Id<'catechists'> | Id<'students'>
    userType: 'catechist' | 'student'
    saintName?: string
    fullName: string
    code?: string // memberId or studentCode
    className?: string // For students
    tokenIdentifier: string
    isAlreadyEnrolled: boolean
  }
  ```

### Mutation: `api.extracurricularPrograms.enrollParticipant`
- **Arguments**:
  - `programId`: `Id<'extracurricularPrograms'>`
  - `requesterId`: `Id<'catechists'>`
  - `targetType`: `'catechist' | 'student'`
  - `targetId`: `string` (Id<'catechists'> or Id<'students'>)
- **Return Type**: `Id<'extracurricularEnrollments'>`
- **Error Codes**:
  - `PROGRAM_NOT_FOUND`
  - `INACTIVE_ACADEMIC_YEAR`
  - `ENROLLMENT_EXPIRED`
  - `CAPACITY_EXCEEDED`
  - `ALREADY_ENROLLED`
  - `UNAUTHORIZED` (requester not permitted to enroll this target)

## Security & Access Control Scoping Matrix

| Role | Program Target: Catechist | Program Target: Student |
|---|---|---|
| **Admin / Board Member** | All active catechists matching program branch (if branch filter set) | All active students matching program branch (if set) |
| **Branch Head** | Active catechists assigned to or in classes of branch lead by user | Active students in primary classes of branch lead by user |
| **Class Catechist** | None (cannot enroll catechists) | Active students enrolled in class(es) taught by user |
