---
name: coverage-gotchas-richtext-qr-catechists
description: Gotchas found raising coverage on richtext-editor.tsx, qr-scanner.tsx, convex/catechists.ts to 97%+ — jsdom FileReader needs real File/Blob, a real prod bug in richtext-editor's drop/paste handlers, and vi.fn() mock.instances accumulating across tests in one file.
metadata:
  type: project
---

**jsdom's `FileReader.readAsDataURL` requires a real `Blob`/`File`, not a
plain `{ type: 'image/png' }` object.** When testing tiptap's `handleDrop`/
`handlePaste` editorProps in `richtext-editor.tsx` (which call
`event.dataTransfer.files[0]` / `item.getAsFile()`), constructing fake drag/
clipboard events with plain object stand-ins for files causes
`TypeError: Failed to execute 'readAsDataURL' on 'FileReader': parameter 1
is not of type 'Blob'`, silently swallowed by the component's own
try/catch (logged via `console.error`). Always use
`new File(['x'], 'name.png', { type: 'image/png' })` for anything that
flows into `compressAndResizeImage`/`FileReader`.

**Found a real bug (not fixed, just documented via test) in
`src/components/custom/richtext-editor.tsx`'s `editorProps.handleDrop` /
`handlePaste`**: both forward the raw ProseMirror `view` param (not the
outer-scope tiptap `editor` instance) into `handleImageFile(file,
currentEditor)`, which then calls `currentEditor.chain()`. A bare
`EditorView` has no `.chain()` method, so drag-and-drop and paste image
insertion currently *always* throws internally and is swallowed by
`handleImageFile`'s catch block (`console.error('Failed to process
image:', err)`) — the image is never actually inserted via these two
paths (only the toolbar's file-input upload works, since that one calls
`handleImageFile(file, editor)` correctly with the real editor). Per this
project's testing-anti-pattern rule ("mocking to bypass real constraints
is wrong when testing the constraint itself"), the tests assert the
*actual* current behavior (preventDefault called, console.error called)
rather than asserting a successful insert the code doesn't perform. If
this ever gets fixed to pass `editor` instead of `view`, update
`richtext-editor.test.tsx`'s `editorProps.handleDrop`/`handlePaste`
describe blocks to assert `setImage` was called instead.

**`vi.fn()` instances created inside a `vi.mock(...)` factory (e.g.
`BrowserQRCodeReader: vi.fn().mockImplementation(function(this){...})` in
`qr-scanner.test.tsx`) accumulate `.mock.instances` and `.mock.calls`
across every test in the file** — `vi.restoreAllMocks()` in `afterEach`
only restores `vi.spyOn` spies, it does NOT clear a module-level mock
factory's call/instance history (that needs `vi.clearAllMocks()` or
`resetAllMocks()`, which this project's existing qr-scanner tests don't
call in `afterEach`). Symptom: `mock.instances[0]` grabs the *first ever*
constructed instance from an earlier test, not the current test's — leads
to `decodeCallback` being called on an already-torn-down instance and
assertions silently failing with 0 calls. Fix: always index with
`.mock.instances.at(-1)` / `.mock.calls.at(-1)` to get the current test's
instance, not `[0]`.

**Convex `convex-test`'s `t.storage.store(new Blob([...]))` inside
`t.run(async (ctx) => ...)`** is the working pattern for seeding a fake
`_storage` id in `catechists.test.ts`-style backend tests
(`updateProfilePhoto`/`deleteProfilePhoto`/`getProfilePhotoUrl` coverage) —
`ctx.storage.store(new Blob(['fake image bytes']))` returns a real
`Id<'_storage'>` usable with `ctx.storage.getUrl`/`ctx.storage.delete` in
the in-memory convex-test backend, no extra mocking needed. See
[[convex_backend_test_pattern]] for the surrounding `convexTest`/seed
helper boilerplate.

Discovered 2026-07-24 while raising coverage on these three files from
48%/77%/81% stmts to 97%+ per the CLAUDE.md 75% threshold rule.
