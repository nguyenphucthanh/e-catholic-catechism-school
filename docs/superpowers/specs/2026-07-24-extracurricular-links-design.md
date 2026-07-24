# Extracurricular Program Links (Social/IM) — Design

## Goal

Let catechists/admins attach social (Facebook, etc.) and IM (Zalo, Messenger group, etc.) links to an `extracurricularProgram`, so enrolled participants can find and join the program's group chat. Some links may be restricted to enrolled members only.

## Schema

`convex/schema.ts` — add to `extracurricularPrograms`:

```ts
links: v.optional(
  v.array(
    v.object({
      type: v.union(v.literal('social'), v.literal('im')),
      label: v.string(),
      url: v.string(),
      forEnrolledOnly: v.boolean(),
    }),
  ),
),
```

No new index — links are never queried independently, only read as part of the program document.

## Backend (`convex/extracurricularPrograms.ts`)

- `createProgram`: add `links: v.optional(v.array(...))` arg (same shape as schema), pass through to `ctx.db.insert`. Defaults to `undefined` if omitted.
- `updateProgram`: add same optional arg, patch `links` when `args.links !== undefined` (existing patch-building pattern).
- `getProgramDetail`, `listPrograms`, `listEligiblePrograms`: no change — all spread `...program`, so `links` flows through automatically.
- Visibility filtering (which links a viewer may see) happens **client-side**: `links.filter(l => !l.forEnrolledOnly || userEnrolled)`. This is acceptable because links are not sensitive data (public group invite URLs) — the `forEnrolledOnly` flag is a UX gate (declutter for non-members), not an authorization boundary. No backend enrollment-based filtering needed.

## Frontend — form (`src/components/extracurricular/program-form.tsx`)

New "Links" card section, positioned after "Fees & Capacity". Repeatable rows using existing `form.Field` + local helper pattern (this file doesn't use zod; staying consistent, not retrofitting):

- Per row: type `Select` (Social / IM), `label` text input, `url` text input, `forEnrolledOnly` checkbox, remove button (Trash icon).
- "Add link" button appends an empty row `{ type: 'social', label: '', url: '', forEnrolledOnly: false }`.
- `ProgramFormProps.onSubmit`/`initialData` types gain `links?: Array<{...}>`.
- No hard cap on row count (per earlier decision).

## Frontend — detail pages

Both `src/routes/_authenticated/_catechist/extracurricular-programs_.$id.tsx` and `src/routes/_authenticated/_student/my-extracurricular-programs_.$id.tsx` get a new "Links" block inside the existing Enrollment `Card`, below the enroll/unenroll button:

- Compute `visibleLinks = (program.links ?? []).filter(l => !l.forEnrolledOnly || program.userEnrolled)`.
- Render nothing if `visibleLinks.length === 0`.
- Each link renders as a `Button` (variant outline, `render` prop `<a href={url} target="_blank" rel="noreferrer">`) with an icon by type (`Share2` for social, `MessageCircle` for im) and the `label` text.

## Fee dialog (student page only)

`my-extracurricular-programs_.$id.tsx` — the existing `showFeeDialog` Dialog (shown after enroll when `feeRequired`) gets the same `visibleLinks` list rendered as buttons between the description and the footer, so a student who just paid attention to the fee can immediately join the group.

The catechist detail page has no equivalent post-enroll dialog today — out of scope to add one; catechists see links directly in the Enrollment card instead.

## i18n

New keys under `extracurricular.*` (added to both `vi` and `en` locale files):
- `links` (section title)
- `linkType.social`, `linkType.im`
- `addLink`, `removeLink`
- `forEnrolledOnly` (checkbox label)
- `noLinksYet` (empty state, form only — detail pages just hide the block)

## Testing

- `unit-test-writer` agent covers `convex/extracurricularPrograms.ts`: `createProgram` and `updateProgram` accept/persist `links`, including the omitted-arg (`undefined`) case and an update that clears links (`links: []`).
- No new component tests required beyond project's 75% bar for touched files; existing route/component tests should still pass since `links` is optional and additive.

## Out of scope

- No link-level analytics/click tracking.
- No backend authorization enforcement on `forEnrolledOnly` (UX-only gate, see above).
- No changes to list views (`extracurricular-programs.tsx`, `my-extracurricular-programs.tsx`) — links only shown on detail pages.
- No new dialog on the catechist detail page.
