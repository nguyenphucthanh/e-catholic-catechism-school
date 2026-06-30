---
name: project-contacts-redesign
description: Design decision record for the catechist profile contacts section redesign
metadata:
  type: project
---

## Decision: Contacts section redesign (2026-06-29)

**Context:** The contacts section in `src/routes/_authenticated/profile.tsx` uses a bare HTML table with inline edit rows. Requested redesign for better mobile UX and cleaner presentation.

**Decisions made:**

1. Layout: card-list (vertical list rows inside the Card) instead of HTML table
2. Read mode: icon + value (dominant) + label (secondary) + Badge for type + "Chính" Badge for primary
3. Edit/Add: shadcn Dialog (needs install) — not inline expansion, not Sheet
4. Delete: shadcn AlertDialog (needs install) — not undo toast
5. Actions: DropdownMenu (already installed) per-row, showing Edit and Delete

**New components to install:**

- `dialog` — for add/edit form
- `alert-dialog` — for delete confirmation
- `badge` — for contact type and primary indicator
- `checkbox` — replace raw `<input type="checkbox">`
- `field` — per CLAUDE.md rule for create/edit forms (not currently used anywhere)

**Why Dialog over Sheet:** Sheet is already installed but semantically for side panels/drawers. Dialog is a focused modal for bounded single-item edits — correct semantic fit for a 5-field contact form. Sheet would feel oversized.

**Why AlertDialog over undo toast:** Target users include Vietnamese catechists and administrators with varying tech literacy. Undo toast requires fast recognition of the pattern. AlertDialog is universally understood and safer.

**How to apply:** When building similar list-of-items-in-a-card patterns elsewhere in the app, use this same card-list + Dialog + AlertDialog + DropdownMenu composition.
