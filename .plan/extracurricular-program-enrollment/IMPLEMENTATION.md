# Implementation: Extracurricular Program Participant Enrollment

## Summary of Changes

### 1. Backend (`convex/extracurricularPrograms.ts` & `convex/extracurricularPrograms.test.ts`)
- Added `searchEligibleCandidates` query:
  - Requires search term length >= 2 to avoid fetching full database collections.
  - Dynamically scopes results based on requester authorization:
    - **Admin / Board Member**: Search any active candidate matching target and branch scope.
    - **Branch Head**: Search active candidates in branches led by user.
    - **Class Catechist**: Search active students in primary class(es) taught by user.
  - Includes `isAlreadyEnrolled` flag for each search result candidate.
- Added `enrollParticipant` mutation:
  - Enrolls a target participant (catechist or student) into a program.
  - Enforces program expiration date, active academic year, capacity limit, target scope, branch eligibility, and role-based authorization.
  - Prevents duplicate enrollments.
- Added Vitest unit test suite covering candidate searching, role-based scoping, manager enrollment, and duplicate prevention in `convex/extracurricularPrograms.test.ts`.

### 2. Frontend Components (`src/components/extracurricular/enroll-participant-dialog.tsx`)
- Built `EnrollParticipantDialog` modal dialog:
  - Renders tabs dynamically based on `program.target`:
    - `'catechist'`: Catechists tab only.
    - `'student'`: Students tab only.
    - `'all'`: Both Catechists and Students tabs.
  - Search input with clear button and min 2 characters prompt for optimal performance.
  - Candidate table displaying Avatar, Name, Member Code / Student Code, Class Name (for students), and enrollment status action button ("Enroll" vs "Enrolled").

### 3. Program Detail Page Integration (`src/routes/_authenticated/_catechist/extracurricular-programs_.$id.tsx`)
- Added "Enroll Participants" button in action bar and enrollments card header for authorized managers.
- Renders `EnrollParticipantDialog` when triggered.

### 4. Internationalization (`src/locales/vi-VN.json` & `src/locales/en-US.json`)
- Added Vietnamese and English translation strings for dialog titles, tabs, search prompts, placeholders, action buttons, and notifications.

## Verification & Quality Assurance
- **TypeScript**: `npx tsc --noEmit` passed cleanly with 0 errors.
- **Unit Tests**: `npx vitest run convex/extracurricularPrograms.test.ts` passed 16/16 tests successfully.
