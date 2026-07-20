# Photobooth

## Problem Statement

Catechists need to capture profile photos for a whole class roster during a
single session (e.g. first day of catechism year). Doing this one student at
a time through the existing student edit form — navigate to student, open
edit, scroll to photo field, upload, save, navigate back, repeat — is too
slow on a phone and breaks flow between shots.

## Solution

A dedicated "Photobooth" mode reachable from the class details page. It
walks the catechist through the class roster one student at a time,
optimized for rapid mobile capture: student name front and center, one tap
to open camera or gallery, a preview/confirm/retake step, then automatic
advance to the next student. Students missing a photo are queued first;
students who already have one can still be reached to retake. A summary
screen closes out the session.

## User Stories

1. As a catechist, I want a "Photobooth" button on the class details page, so that I can start a photo session for the whole class in one tap.
2. As a catechist, I want the photobooth queue to prioritize students without a photo, so that I spend my time on the students who actually need one first.
3. As a catechist, I want to still be able to reach students who already have a photo, so that I can retake a bad one without leaving the flow.
4. As a catechist, I want to see the current student's name clearly while in photobooth, so that I don't attach the wrong photo to the wrong student.
5. As a catechist, I want a single tap to open my camera, so that I can shoot a photo without hunting through menus.
6. As a catechist, I want the option to pick an existing photo from my gallery instead of shooting live, so that I can reuse a photo I already took.
7. As a catechist, I want to preview the photo I just took before it's saved, so that I can catch a blurry or wrong shot.
8. As a catechist, I want a retake button on the preview, so that I can redo a bad shot without restarting the whole session.
9. As a catechist, I want a confirm button on the preview, so that the photo only saves once I've approved it.
10. As a catechist, I want confirming a photo to automatically advance to the next student, so that I don't have to manually navigate between students.
11. As a catechist, I want to skip a student and come back to them later in the same session, so that I'm not blocked if a student steps away momentarily.
12. As a catechist, I want photos to be compressed automatically, so that I don't have to think about file size limits.
13. As a catechist, I want a summary screen at the end of the queue showing how many photos were captured and which students (if any) are still missing one, so that I know whether the session is complete.
14. As a catechist, I want a way to exit photobooth mid-session and return to class details, so that I'm not locked into finishing every student in one sitting.
15. As a catechist without edit permission on this class's students, I want the Photobooth entry point hidden or disabled, so that I don't attempt a flow I'm not authorized to complete.

## Implementation Decisions

- New route `/classes/$id/photobooth`, rendered without the app's normal
  sidebar/header chrome — full-screen, mobile-first layout. Back/exit
  control returns to `/classes/$id`.
- Entry point: a "Photobooth" button on the class details page (students
  tab action row, next to the existing "Print cards" button), visible only
  when `canManage && !isInactive` (same gate already used for the other
  roster-management actions on that page).
- Queue source: the same roster already fetched by `classes.getClassDetails`
  (`classDetails.students`), scoped to `enrollment.status === 'active'`.
  Client-side ordering: students with no `profilePhotoStorageId` first (in
  existing name-sort order), then students with an existing photo after.
- Skip: pushes the current student to the end of the in-memory queue and
  advances; does not persist any state, does not remove them from the
  session.
- Capture: reuses the existing `<input type="file" accept="image/*" capture>`
  pattern from `StudentPhotoUpload`
  (`src/components/custom/student-photo-upload.tsx`) and
  `compressAndResizeImage` (`src/lib/image.ts`) for client-side
  resize/compress before upload. No new compression logic.
- Preview/confirm/retake: selecting a file shows a full-screen preview of
  the (compressed) image with Retake and Use Photo actions before any
  upload happens. Retake re-opens the file picker; Use Photo runs the
  existing upload path (`storage.generateUploadUrl` →
  `students.updateProfilePhoto`) and then advances the queue.
- Backend: no changes. `students.updateProfilePhoto`,
  `students.getProfilePhotoUrl`, `storage.generateUploadUrl`, and the
  500KB/`profilePhotoStorageId` schema field already exist and are reused
  as-is.
- End of queue: once every student has been visited (confirmed or
  explicitly left as skipped through without action is not possible —
  "skip" just reorders, so the queue empties only when every student has
  either had a photo confirmed this session or already had one before the
  session and wasn't retaken), show a summary screen: count of photos
  captured this session vs. total, and a list of any students still without
  a `profilePhotoStorageId`. Single action returns to class details.
- New route is added to the catechist-authenticated route tree but opts out
  of the shared layout shell (mirrors how other full-bleed/no-chrome routes
  in this app are structured — confirm the existing pattern for a
  chrome-less route before adding a new one).

## Testing Decisions

- Unit test the queue-ordering/skip logic (missing-photo-first ordering,
  skip pushes to end, queue empties correctly) as a pure function or hook,
  independent of rendering — this is the one piece of nontrivial new logic.
- Component test for the photobooth route: renders current student name,
  triggers file selection, shows preview with retake/confirm, confirm
  advances to next student, reaching the end shows the summary screen.
  Follow existing patterns for testing routes/components that use
  `useQuery`/`useMutation` against `api.students.*` and `api.storage.*`
  (see `student-photo-upload` and class detail page tests).
- No new backend tests needed — no backend code changes.
- Coverage target: 75% (statements/branches/functions/lines) per repo
  CLAUDE.md, for files touched by this feature.

## Out of Scope

- Changing the 500KB / compression targets themselves.
- Bulk multi-student upload from a single gallery multi-select.
- Offline capture/queueing for spotty connectivity.
- Editing/cropping the photo beyond auto resize-compress (no manual crop
  tool).
- Photobooth for catechist profile photos (existing `catechist-photo-upload.tsx`
  flow is untouched).

## Further Notes

- All backend pieces (`students.updateProfilePhoto`,
  `students.deleteProfilePhoto`, `students.getProfilePhotoUrl`,
  `storage.generateUploadUrl`, `assertEditStudentPermission`) and the
  compression helper already exist and were verified in the codebase before
  writing this spec — this is a frontend-only feature.
