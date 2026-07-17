# design-sync notes

## Repo shape

- App (TanStack Start), not a published component library. No `dist`/`.d.ts` package build for `src/components/ui`.
- Synth-entry mode used: converter builds an entry from `src/components/ui` directly (no `.d.ts` package tree). Prop types will be weaker than a real package build.
- Path alias is `~/*` (not `@/*`) → `~/components/ui/button` etc. `tsconfig.json` has the mapping; `cfg.tsconfig` points at it.
- Tailwind v4 CSS-first (`@import 'tailwindcss'` in `src/styles/app.css`). Raw source CSS has no compiled utility classes — must use the Vite-compiled CSS output, not the source file.

## cssEntry — hash changes every build

`vite build` emits `.output/public/assets/app-<hash>.css`. `cfg.cssEntry` is pinned to the current hash. **On every re-sync**: run `npx vite build`, then `ls .output/public/assets/app-*.css` and update `cfg.cssEntry` to the new filename before running the converter — a stale pinned path will 404/be missing after any rebuild.

## Scope

- Synced: `src/components/ui/**` only (60 shadcn/Base UI primitives).
- Excluded: `src/components/custom`, `src/components/forms`, `src/components/csv-import`, `src/components/shadcn-big-calendar` — app-specific, Convex-data-bound feature components, not reusable DS material. User confirmed this scope.

## Component discovery — flat shadcn exports, no namespacing

shadcn files export multiple named parts flatly (`export { Dialog, DialogTrigger, DialogContent, ... }`), never as `Dialog.Trigger` namespace members, so the converter's `partitionSubcomponents` compounds-detection can't group them — every export became a standalone root card (329 total). Fixed by pinning an explicit `componentSrcMap` allowlist to the 59 intended root/main components (see config.json). `direction.tsx` (`DirectionProvider`, `useDirection` re-exports from `@base-ui/react/direction-provider`) is excluded — it's a context provider, not a visual component.

If `src/components/ui/` gains a new file, add its main export name + path to `componentSrcMap` in config.json — it won't be auto-discovered (allowlist, not exclusion list).

Name resolution quirks (filename → export name doesn't always match kebab→Pascal):

- `chart.tsx` → `ChartContainer` (not `Chart`)
- `input-otp.tsx` → `InputOTP` (not `InputOtp`)
- `resizable.tsx` → `ResizablePanelGroup` (not `Resizable`)
- `sonner.tsx` → `Toaster` (not `Sonner`)

## Fonts — accepted substitutes (user confirmed 2026-07-17)

- "Plus Jakarta Sans" and "JetBrains Mono" are referenced in `--font-serif`/`--font-mono`/`--font-sans` CSS vars but have no shipped `@font-face` anywhere in the app — not a sync gap, the real app also falls back to system fonts for these.
- "Inter" (the literal family name in `--font-sans`) doesn't match the shipped family name "Inter Variable" from `@fontsource-variable/inter` (`cfg.extraFonts`) — pre-existing naming mismatch in the app itself, not introduced by sync. Design renders with system-font fallback, consistent with real-app behavior.
- Fixed separately: the vite-compiled CSS (`cssEntry`) uses absolute `/assets/...` font `url()`s that don't resolve on disk relative to the CSS file, so the automatic font-file copier found 0 files. Worked around by pointing `cfg.extraFonts` directly at `node_modules/@fontsource-variable/inter/index.css`, which uses proper relative paths — this now ships correctly.

## TOKENS_MISSING (non-blocking, expected)

8 CSS custom properties (`--accordion-panel-height`, `--radix-dropdown-menu-trigger-width`, `--drawer-swipe-*`, `--nested-drawers`, `--tw`) are set inline by component JS at runtime (Base UI/Radix internals), not in any stylesheet — expected absence, not a real gap.

## Known render warns (triaged, benign)

- `Dialog`, `AlertDialog`, `Sheet`, `Drawer`: `[RENDER_THIN]` "rendered height is 0-1px" — false positive from `position: fixed`/portal popup content (Base UI overlays collapse the measured root's bounding box even though the popup paints correctly). All 4 confirmed visually (`_screenshots/general__<Name>.png`) — render correctly, fully styled. Ignore this warn for these 4.
- `Popover`, `DropdownMenu`, `Tooltip`: do NOT trip the thin warn — they render inline content within their `cardMode: single` viewport and are clean (51/59). They require their `*Trigger` present to position (see preview-authoring gotchas).
- `Spinner` (floor card): `[RENDER_THIN]` — it's a tiny spinner glyph, genuinely small. Unauthored, floor card. Benign.

## Authored previews (29 core components, all graded good)

Authored `.design-sync/previews/<Name>.tsx` for: Button, Dialog, Table (solo calibration) + Badge, Input, Textarea, Select, NativeSelect, Checkbox, RadioGroup, Switch, Label, Field, Combobox (form) + AlertDialog, Sheet, Drawer, Popover, Tooltip, DropdownMenu (overlay) + Tabs, Accordion, Breadcrumb, Avatar, Separator, Pagination (nav) + Progress, Skeleton, Alert, Calendar, Card (misc). Remaining components ship the floor card.

### Preview-authoring gotchas (Base UI, not Radix)

- **Anchored overlays (Popover/DropdownMenu/Tooltip) MUST include their Trigger** — they use floating-ui `Positioner`; without a real anchor the portalled popup mounts `opacity:0` forever, invisible, no error. (Dialog/AlertDialog/Sheet/Drawer are centered/edge modals and work Content-only, but pass `modal={false}` + `defaultOpen` for a static screenshot.)
- **DropdownMenuLabel requires a DropdownMenuGroup ancestor** — else throws `MenuGroupContext is missing`.
- **Accordion multiple-open uses `openMultiple` prop** (not Radix's `type="multiple"`).
- **Progress self-renders its own track/indicator** after children — only pass `ProgressLabel`/`ProgressValue` as children, not another `ProgressTrack`, or you get a doubled bar.
- **Select/Combobox** are uncontrolled via `defaultValue` on root; trigger text auto-syncs. `Combobox.Root` takes `items` array with function-as-children on `ComboboxList`.
- **Field** is a plain `role="group"` div; `data-invalid="true"` drives destructive styling.
- Base UI Triggers commonly use `render={<Button .../>}` to merge behavior onto a styled Button rather than wrapping children.

### Toaster — deliberately left on floor card

`sonner.tsx` wraps sonner's portal; toasts only appear via imperative `toast()` calls, no props for static content. Any preview renders an empty container. Not authorable — inherent to the API, not a gap to fix.

## Re-sync setup (required each fresh clone)

The converter resolves the package via `node_modules/<pkg>`, which npm won't self-install for the app itself. Create a self-symlink before running the converter:

```
ln -sfn .. node_modules/e-catholic-catechism-school
```

(Gitignored, so recreate per clone.) Then run the converter with `--node-modules ./node_modules` and it finds the package.json + synthesizes the entry from `src/components/ui`.

Non-core components rendering blank (NOT the typographic floor card, so they look empty rather than placeholder): Attachment, Command, Empty, Item, Kbd, Marker, Slider, Toggle. These were out of the approved authoring scope (core ~30). They render blank with default props (need children/content the floor swap doesn't supply). Top candidates for the next incremental authoring pass — author `.design-sync/previews/<Name>.tsx` for them.

## Re-sync risks

- cssEntry path WILL go stale on every rebuild (see above) — must be manually refreshed, converter won't auto-detect it.
- Synth-entry `.d.ts` extraction is weaker than a real package build; complex prop types (e.g. generic table columns, calendar prop unions) may need `cfg.dtsPropsFor` overrides.
- componentSrcMap is an allowlist pinned by hand — new components in `src/components/ui/` need a manual entry added or they silently don't sync.
- No provider needed so far — Base UI components rendered without a wrapper in the render check. Revisit if a future component throws a context error.
