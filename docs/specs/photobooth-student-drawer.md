# Photobooth Student Drawer

## Problem Statement

Inside an active photobooth session (`/classes/$id/photobooth`), the
catechist sees only the current student, one at a time. There is no way to
see the full roster's progress mid-session, or to jump to a specific student
out of order (e.g. to retake a bad photo, or handle a student who just
arrived). The catechist has to rely on skip-and-wait to eventually cycle
back around.

## Solution

A floating button, fixed to the bottom-right of the screen (thumb reach on a
phone), visible on every photobooth screen (capture, preview, summary).
Tapping it opens a bottom-anchored swipeable Drawer listing the full class
roster with each student's status (pending / current / confirmed). Tapping
any student in the list jumps the queue to that student and closes the
drawer.

## User Stories

1. As a catechist mid-session, I want a button I can reach with my thumb
   while holding the phone one-handed, so that I can check roster progress
   without breaking my grip.
2. As a catechist, I want to see how many students are confirmed vs. total
   at a glance (on the button itself), so that I know progress without
   opening anything.
3. As a catechist, I want to open a list of the full class roster from
   anywhere in the session, so that I can see who's left.
4. As a catechist, I want each student in that list to show whether they're
   done, currently up, or still pending, so that I don't lose track of
   where I am.
5. As a catechist, I want to tap a student in the list to jump straight to
   them, so that I can retake a bad photo or handle someone out of order
   without skipping through the whole queue.
6. As a catechist, I want tapping a student who already has a photo
   confirmed this session to let me retake it, so that correcting a mistake
   doesn't require leaving the flow.
7. As a catechist, I want the list to close automatically after I pick a
   student, so that I land straight back in the capture flow.
8. As a catechist, I want to dismiss the list by swiping it down, so that
   backing out feels native on a phone.

## Implementation Decisions

- **Hook (`src/hooks/use-photobooth-queue.ts`)**:
  - Return the full `initialStudents` roster annotated with a computed
    status per student: `'pending' | 'current' | 'confirmed'`, derived from
    `state.queue` position and `state.confirmedIds` (no new state field —
    computed in the existing `React.useMemo`/render pass alongside
    `missingStudents`).
  - Add `jumpTo(studentId: string)`:
    - Student is the current head → no-op.
    - Student is elsewhere in `state.queue` (pending) → remove and reinsert
      at the front.
    - Student is in `confirmedIds` (already confirmed this session) →
      remove from `confirmedIds`, insert at the front of `state.queue`
      (re-enters the flow as current, effectively "retake").
  - Both operations use the existing `setState` updater pattern already used
    by `skip`/`confirm`.

- **Route component (`src/routes/classes.$id.photobooth.tsx`)**:
  - On `jumpTo`, clear any in-progress preview (`clearPreview()`) before
    calling `queue.jumpTo` — matches existing `handleSkip`/`handleRetake`
    pattern of clearing preview state on navigation. No confirmation dialog;
    the discarded preview was never uploaded, so nothing is lost server-side.
  - New floating trigger button: `position: fixed`, `bottom-*, right-*`
    (thumb zone), rendered at the top level of `PhotoboothSession` (outside
    the `queue.isDone` conditional) so it persists across capture/preview/
    summary screens. Icon button (`Users` from `lucide-react`, already
    imported elsewhere in the app) with a small badge showing
    `confirmedCount/total`.
  - Drawer built from `~/components/ui/drawer` (`Drawer`, `DrawerContent`,
    etc. — check current exports), `swipeDirection="down"`, no
    `snapPoints`. `max-h-[75vh]` content, internal `overflow-y-auto` list,
    header `Students (confirmedCount/total)`.
  - List item per student: name (`formatPersonName`), status indicator —
    confirmed = checkmark icon + muted text, current = highlighted
    row/background + label, pending = default row styling. `onClick` calls
    `handleJumpTo(studentId)` which clears preview, calls `queue.jumpTo`,
    and closes the drawer (controlled `open` state on `Drawer`).

- **i18n**: add keys under the existing `photobooth.*` namespace in both
  `en` and `vi` locale files — drawer title, status labels
  (pending/current/confirmed — reuse plain text, no icon-only labels for
  a11y), close/dismiss affordance if needed beyond the drawer's built-in
  swipe/backdrop dismiss.

- **No backend changes.** Purely client-side queue/UI logic.

## Testing Decisions

- Unit test `jumpTo` in the existing `use-photobooth-queue` test file:
  jumping to a pending student reorders correctly, jumping to the current
  student is a no-op, jumping to a confirmed student removes it from
  `confirmedIds` and reinserts at front, computed per-student status field
  matches queue/confirmedIds state in all three cases.
- Component test additions to the existing photobooth route test file:
  floating button renders with correct count badge, opening the drawer
  shows the full roster with correct status per student, tapping a student
  closes the drawer and advances `current` to that student, tapping while a
  preview is pending discards the preview.
- Coverage target: 75% (statements/branches/functions/lines) per repo
  CLAUDE.md, for files touched by this change.

## Out of Scope

- Reordering the roster within the drawer (drag-and-drop, manual sort).
- Filtering/searching the student list.
- Persisting jump/retake actions across page reloads (session state is
  already in-memory only, per the base photobooth spec).
- Any change to the underlying `skip`/`confirm` semantics for the base flow.

## Further Notes

- Builds directly on `docs/specs/photobooth.md`, which already established
  the queue model (`usePhotoboothQueue`), route structure, and full-screen
  layout this feature extends.
- `Drawer` component (`src/components/ui/drawer.tsx`, Base UI-backed,
  `swipeDirection` prop, optional `snapPoints`) was confirmed installed and
  unused elsewhere in the app before choosing it over `Sheet` with
  `side="bottom"`.
