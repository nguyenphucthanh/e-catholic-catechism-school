---
name: photobooth-queue-end-state-gotcha
description: usePhotoboothQueue only reaches isDone via confirm(), not skip() — summary's "still missing" branch is unreachable through real UI interactions, must mock the hook to test it
metadata:
  type: project
---

`src/hooks/use-photobooth-queue.ts`'s `usePhotoboothQueue`: `skip()` only
reorders the in-memory queue (moves head to tail, no-ops when
`queue.length <= 1`); only `confirm()` removes an item. `missingStudents` is
computed as `initialStudents.filter(s => !s.hasPhoto && !confirmedIds.has(id))`.

Consequence: driving `isDone` to true through real component interactions
(clicking Skip repeatedly) is impossible for more than one item — skip alone
never empties the queue, only confirm does, and confirm always adds the
student to `confirmedIds`. So by the time `isDone` is true via genuine UI
flow, every student has been confirmed, meaning `missingStudents` is always
empty in that path. The "students still missing a photo" branch on the
summary screen (`src/routes/classes.$id.photobooth.tsx`'s `PhotoboothSummary`)
can only be exercised by mocking `usePhotoboothQueue` directly and returning
a crafted `{ isDone: true, missingStudents: [...] }` state — not by driving
the real hook through fireEvent clicks.

**How to apply:** when testing the photobooth route (or anything consuming
this hook) and you need to hit the "queue done with leftovers" branch, use
`vi.mock('~/hooks/use-photobooth-queue', async (importOriginal) => ({
...await importOriginal(), usePhotoboothQueue: vi.fn(actual.usePhotoboothQueue)
}))` so most tests exercise the real hook, then override the mock's return
value with `vi.mocked(usePhotoboothQueue).mockReturnValue({...})` just for
that one test. See `src/routes/-classes.$id.photobooth.test.tsx`. This may
also indicate a real spec/implementation mismatch worth flagging to a human
(spec implies retaking existing-photo students should be optional, but the
hook requires every roster entry — including ones that already had a photo —
to be confirmed before the queue empties), but that's out of scope for a
test-writing task per repo convention (don't modify route/hook files unless
fixing an actual bug, and this is ambiguous enough to defer to a human).
