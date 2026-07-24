# Extracurricular Program Links (Social/IM) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let catechists/admins attach social (Facebook, etc.) and IM (Zalo, Messenger group, etc.) links to an `extracurricularProgram`, with a per-link "enrolled members only" visibility flag, and surface those links on both detail pages and the student's post-enroll fee dialog.

**Architecture:** A single `links: v.optional(v.array(v.object({...})))` field on `extracurricularPrograms` (intentional deviation from the "no array-of-objects on a doc" guideline — approved by user, list stays tiny, no independent query/index needed on link rows). Backend passes the array through untouched; visibility filtering (`forEnrolledOnly`) happens client-side in a shared `ProgramLinksList` component reused by the catechist detail page, the student detail page, and the student's fee dialog.

**Tech Stack:** Convex (schema/mutations), React + TanStack Form, shadcn/Base UI (`Select`, `Checkbox`, `Button`, `Dialog`), react-i18next, Vitest + Testing Library.

## Global Constraints

- Never edit `src/components/ui/*` — fix mismatches at call site.
- `.filter()` in Convex queries is forbidden — not applicable here (no new queries).
- Never trust client-supplied identity — not applicable here (no auth logic changes).
- Test coverage minimum 75% (statements, branches, functions, lines) for files touched by this plan, via `npm test -- --coverage`.
- Phone numbers / E.164 — not applicable to this feature.
- Soft delete only — not applicable (no new entity, just a field).
- Spec: `docs/superpowers/specs/2026-07-24-extracurricular-links-design.md`.

---

### Task 1: Schema + backend mutations

**Files:**
- Modify: `convex/schema.ts:681-703` (`extracurricularPrograms` table)
- Modify: `convex/extracurricularPrograms.ts:454-522` (`createProgram`)
- Modify: `convex/extracurricularPrograms.ts:524-622` (`updateProgram`)
- Test: `convex/extracurricularPrograms.test.ts`

**Interfaces:**
- Produces: schema field `links?: Array<{ type: 'social' | 'im'; label: string; url: string; forEnrolledOnly: boolean }>` on `extracurricularPrograms` docs. `createProgram`/`updateProgram` both accept an optional `links` arg of this shape. All later tasks read `program.links` from `getProgramDetail`'s return value (already a full `...program` spread — no query changes needed).

- [ ] **Step 1: Write the failing backend test**

Open `convex/extracurricularPrograms.test.ts` and insert this test right after the `updateProgram rejects past start date and capacity below enrolled` test (after line 348, before the `listPrograms applies search...` test):

```ts
  test('createProgram persists links and updateProgram can patch or clear them', async () => {
    const t = convexTest(schema, modules)
    const adminId = await t.run(async (ctx) => {
      await seedActiveYear(ctx)
      return seedAdmin(ctx)
    })

    const programId = await t.mutation(
      api.extracurricularPrograms.createProgram,
      {
        requesterId: adminId,
        title: 'Camp',
        details: '{}',
        target: 'all',
        branches: [],
        dateStart: '2099-01-01',
        dateEnd: '2099-02-01',
        enrollmentExpireDate: '2099-01-15',
        feeRequired: false,
        links: [
          {
            type: 'social',
            label: 'Facebook',
            url: 'https://facebook.com/x',
            forEnrolledOnly: false,
          },
          {
            type: 'im',
            label: 'Zalo Group',
            url: 'https://zalo.me/g/abc',
            forEnrolledOnly: true,
          },
        ],
      },
    )

    const created = await t.run((ctx) =>
      ctx.db.get('extracurricularPrograms', programId),
    )
    expect(created?.links).toHaveLength(2)
    expect(created?.links?.[0]).toEqual({
      type: 'social',
      label: 'Facebook',
      url: 'https://facebook.com/x',
      forEnrolledOnly: false,
    })
    expect(created?.links?.[1].forEnrolledOnly).toBe(true)

    await t.mutation(api.extracurricularPrograms.updateProgram, {
      programId,
      requesterId: adminId,
      links: [],
    })

    const cleared = await t.run((ctx) =>
      ctx.db.get('extracurricularPrograms', programId),
    )
    expect(cleared?.links).toEqual([])
  })

  test('createProgram omits links when not provided', async () => {
    const t = convexTest(schema, modules)
    const adminId = await t.run(async (ctx) => {
      await seedActiveYear(ctx)
      return seedAdmin(ctx)
    })

    const programId = await t.mutation(
      api.extracurricularPrograms.createProgram,
      {
        requesterId: adminId,
        title: 'No Links Camp',
        details: '{}',
        target: 'all',
        branches: [],
        dateStart: '2099-01-01',
        dateEnd: '2099-02-01',
        enrollmentExpireDate: '2099-01-15',
        feeRequired: false,
      },
    )

    const created = await t.run((ctx) =>
      ctx.db.get('extracurricularPrograms', programId),
    )
    expect(created?.links).toBeUndefined()
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run convex/extracurricularPrograms.test.ts -t "links"`
Expected: FAIL — `ArgumentValidationError` (unknown field `links`) or TypeScript error, since neither the schema nor the mutation args accept `links` yet.

- [ ] **Step 3: Add `links` to the schema**

In `convex/schema.ts`, inside the `extracurricularPrograms` table definition (line 681-700), add the field right after `maxCapacity`:

```ts
  extracurricularPrograms: defineTable({
    academicYearId: v.id('academicYears'),
    title: v.string(),
    details: v.string(), // serialized Tiptap JSON
    target: v.union(
      v.literal('catechist'),
      v.literal('student'),
      v.literal('all'),
    ),
    branches: v.array(v.id('branches')), // eligible branches
    dateStart: v.string(), // ISO date string YYYY-MM-DD
    dateEnd: v.string(), // ISO date string YYYY-MM-DD
    enrollmentExpireDate: v.string(), // ISO date string YYYY-MM-DD
    feeRequired: v.boolean(),
    feeAmount: v.optional(v.number()), // required if feeRequired = true
    maxCapacity: v.optional(v.number()), // null = unlimited
    links: v.optional(
      v.array(
        v.object({
          type: v.union(v.literal('social'), v.literal('im')),
          label: v.string(),
          url: v.string(),
          forEnrolledOnly: v.boolean(), // true = only shown to userEnrolled=true viewers
        }),
      ),
    ),
    createdBy: v.id('catechists'),
    createdAt: v.number(), // Unix ms
    isDeleted: v.boolean(),
  })
    .index('by_academic_year_id', ['academicYearId'])
    .index('by_is_deleted', ['isDeleted'])
    .index('by_date_start', ['dateStart']),
```

- [ ] **Step 4: Accept `links` in `createProgram`**

In `convex/extracurricularPrograms.ts`, update the `createProgram` mutation (line 454-522):

```ts
export const createProgram = mutation({
  args: {
    requesterId: v.id('catechists'),
    title: v.string(),
    details: v.string(),
    target: v.union(
      v.literal('catechist'),
      v.literal('student'),
      v.literal('all'),
    ),
    branches: v.array(v.id('branches')),
    dateStart: v.string(),
    dateEnd: v.string(),
    enrollmentExpireDate: v.string(),
    feeRequired: v.boolean(),
    feeAmount: v.optional(v.number()),
    maxCapacity: v.optional(v.number()),
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
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)

    // Get active academic year
    const academicYearId = await requireActiveAcademicYear(
      ctx,
      EXTRACURRICULAR_ERRORS.INACTIVE_ACADEMIC_YEAR,
    )

    // Check permission — admin, board member, or branch head of the active year
    const perms = await getEffectivePermissions(
      ctx,
      args.requesterId,
      academicYearId,
    )
    if (!perms.isAdmin && !perms.isBoardMember) {
      const isBranchHead =
        perms.branchHeadOf.length > 0 &&
        (args.branches.length === 0 ||
          args.branches.some((b) => perms.branchHeadOf.includes(b)))
      if (!isBranchHead) {
        throw new Error(EXTRACURRICULAR_ERRORS.UNAUTHORIZED)
      }
    }

    // Validate dates
    if (args.dateStart > args.dateEnd) {
      throw new Error(EXTRACURRICULAR_ERRORS.INVALID_DATE_RANGE)
    }
    if (args.enrollmentExpireDate > args.dateEnd) {
      throw new Error(EXTRACURRICULAR_ERRORS.INVALID_ENROLLMENT_DATE)
    }

    return await ctx.db.insert('extracurricularPrograms', {
      academicYearId,
      title: args.title,
      details: args.details,
      target: args.target,
      branches: args.branches,
      dateStart: args.dateStart,
      dateEnd: args.dateEnd,
      enrollmentExpireDate: args.enrollmentExpireDate,
      feeRequired: args.feeRequired,
      feeAmount: args.feeAmount,
      maxCapacity: args.maxCapacity,
      links: args.links,
      createdBy: args.requesterId,
      createdAt: Date.now(),
      isDeleted: false,
    })
  },
})
```

- [ ] **Step 5: Accept and patch `links` in `updateProgram`**

In the same file, update `updateProgram` (line 524-622): add `links` to the `args` object (same shape as above, right after `maxCapacity`), and add one line to the patch-building block right after the `maxCapacity` line:

```ts
    if (args.maxCapacity !== undefined) patch.maxCapacity = args.maxCapacity
    if (args.links !== undefined) patch.links = args.links
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run convex/extracurricularPrograms.test.ts`
Expected: PASS (all tests in the file, including the two new ones).

- [ ] **Step 7: Commit**

```bash
git add convex/schema.ts convex/extracurricularPrograms.ts convex/extracurricularPrograms.test.ts
git commit -m "feat: add social/IM links field to extracurricular programs"
```

---

### Task 2: i18n keys

**Files:**
- Modify: `src/locales/vi-VN.json`
- Modify: `src/locales/en-US.json`

**Interfaces:**
- Produces: i18n keys `extracurricular.links`, `extracurricular.linkType`, `extracurricular.linkType.social`, `extracurricular.linkType.im`, `extracurricular.linkLabel`, `extracurricular.linkUrl`, `extracurricular.forEnrolledOnly`, `extracurricular.addLink`, `extracurricular.removeLink`, `extracurricular.noLinksYet`, `extracurricular.sections.links`, `extracurricular.sections.linksDesc`. Tasks 3-6 use these as literal string keys (tests mock `t` as identity, so exact key strings matter for test assertions).

- [ ] **Step 1: Add keys to `src/locales/vi-VN.json`**

Insert these entries right after the `"extracurricular.sections.feesDesc"` line (currently line 230):

```json
  "extracurricular.sections.links": "Liên kết",
  "extracurricular.sections.linksDesc": "Liên kết mạng xã hội hoặc nhóm chat cho hoạt động",
  "extracurricular.links": "Liên kết",
  "extracurricular.linkType": "Loại liên kết",
  "extracurricular.linkType.social": "Mạng xã hội",
  "extracurricular.linkType.im": "Nhóm chat",
  "extracurricular.linkLabel": "Tên hiển thị",
  "extracurricular.linkUrl": "Đường dẫn",
  "extracurricular.forEnrolledOnly": "Chỉ hiển thị cho thành viên đã đăng ký",
  "extracurricular.addLink": "Thêm liên kết",
  "extracurricular.removeLink": "Xóa liên kết",
  "extracurricular.noLinksYet": "Chưa có liên kết nào",
```

- [ ] **Step 2: Add matching keys to `src/locales/en-US.json`**

Find the equivalent `"extracurricular.sections.feesDesc"` line in `src/locales/en-US.json` and insert right after it:

```json
  "extracurricular.sections.links": "Links",
  "extracurricular.sections.linksDesc": "Social media or chat group links for this program",
  "extracurricular.links": "Links",
  "extracurricular.linkType": "Link type",
  "extracurricular.linkType.social": "Social media",
  "extracurricular.linkType.im": "Chat group",
  "extracurricular.linkLabel": "Display name",
  "extracurricular.linkUrl": "URL",
  "extracurricular.forEnrolledOnly": "Only show to enrolled members",
  "extracurricular.addLink": "Add link",
  "extracurricular.removeLink": "Remove link",
  "extracurricular.noLinksYet": "No links yet",
```

- [ ] **Step 3: Verify JSON is well-formed and keys are in sync**

Run: `node -e "const vi=require('./src/locales/vi-VN.json'); const en=require('./src/locales/en-US.json'); const missing = Object.keys(vi).filter(k => !(k in en)); console.log('missing in en:', missing.filter(k => k.startsWith('extracurricular.link') || k.startsWith('extracurricular.sections.link') || k.startsWith('extracurricular.no') || k.startsWith('extracurricular.add')))"`

Expected: `missing in en: []`

- [ ] **Step 4: Commit**

```bash
git add src/locales/vi-VN.json src/locales/en-US.json
git commit -m "feat: add i18n keys for extracurricular program links"
```

---

### Task 3: Shared `ProgramLinksList` display component

**Files:**
- Create: `src/components/extracurricular/program-links-list.tsx`
- Test: `src/components/extracurricular/program-links-list.test.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks except the i18n keys from Task 2 (`extracurricular.links`).
- Produces: `ProgramLinksList` component and `ProgramLink` type, both exported from `src/components/extracurricular/program-links-list.tsx`:
  ```ts
  export interface ProgramLink {
    type: 'social' | 'im'
    label: string
    url: string
    forEnrolledOnly: boolean
  }
  export function ProgramLinksList(props: {
    links: Array<ProgramLink> | undefined
    userEnrolled: boolean
  }): JSX.Element | null
  ```
  Tasks 5 and 6 render `<ProgramLinksList links={program.links} userEnrolled={program.userEnrolled} />` (or `userEnrolled={true}` in the fee dialog).

- [ ] **Step 1: Write the failing component test**

Create `src/components/extracurricular/program-links-list.test.tsx`:

```tsx
import { describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProgramLinksList } from './program-links-list'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

describe('ProgramLinksList', () => {
  test('renders nothing when links is undefined', () => {
    const { container } = render(
      <ProgramLinksList links={undefined} userEnrolled={false} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  test('renders nothing when links is empty', () => {
    const { container } = render(
      <ProgramLinksList links={[]} userEnrolled={false} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  test('hides forEnrolledOnly links when userEnrolled is false', () => {
    render(
      <ProgramLinksList
        links={[
          {
            type: 'social',
            label: 'Public Page',
            url: 'https://facebook.com/pub',
            forEnrolledOnly: false,
          },
          {
            type: 'im',
            label: 'Members Zalo',
            url: 'https://zalo.me/g/members',
            forEnrolledOnly: true,
          },
        ]}
        userEnrolled={false}
      />,
    )

    expect(screen.getByText('Public Page')).toBeInTheDocument()
    expect(screen.queryByText('Members Zalo')).not.toBeInTheDocument()
  })

  test('shows forEnrolledOnly links when userEnrolled is true', () => {
    render(
      <ProgramLinksList
        links={[
          {
            type: 'im',
            label: 'Members Zalo',
            url: 'https://zalo.me/g/members',
            forEnrolledOnly: true,
          },
        ]}
        userEnrolled={true}
      />,
    )

    expect(screen.getByText('Members Zalo')).toBeInTheDocument()
  })

  test('renders each link as an external link with the correct href and target', () => {
    render(
      <ProgramLinksList
        links={[
          {
            type: 'social',
            label: 'Public Page',
            url: 'https://facebook.com/pub',
            forEnrolledOnly: false,
          },
        ]}
        userEnrolled={false}
      />,
    )

    const link = screen.getByRole('link', { name: /Public Page/ })
    expect(link).toHaveAttribute('href', 'https://facebook.com/pub')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noreferrer')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/extracurricular/program-links-list.test.tsx`
Expected: FAIL — cannot find module `./program-links-list`.

- [ ] **Step 3: Write the component**

Create `src/components/extracurricular/program-links-list.tsx`:

```tsx
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { MessageCircle, Share2 } from 'lucide-react'
import { Button } from '~/components/ui/button'

export interface ProgramLink {
  type: 'social' | 'im'
  label: string
  url: string
  forEnrolledOnly: boolean
}

interface ProgramLinksListProps {
  links: Array<ProgramLink> | undefined
  userEnrolled: boolean
}

const LINK_TYPE_ICONS: Record<ProgramLink['type'], React.ElementType> = {
  social: Share2,
  im: MessageCircle,
}

export function ProgramLinksList({ links, userEnrolled }: ProgramLinksListProps) {
  const { t } = useTranslation()
  const visibleLinks = (links ?? []).filter(
    (link) => !link.forEnrolledOnly || userEnrolled,
  )

  if (visibleLinks.length === 0) return null

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{t('extracurricular.links')}</p>
      <div className="flex flex-wrap gap-2">
        {visibleLinks.map((link, index) => {
          const Icon = LINK_TYPE_ICONS[link.type]
          return (
            <Button
              key={`${link.url}-${index}`}
              type="button"
              variant="outline"
              size="sm"
              render={<a href={link.url} target="_blank" rel="noreferrer" />}
            >
              <Icon className="mr-1 size-4" />
              {link.label}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/extracurricular/program-links-list.test.tsx`
Expected: PASS (all 5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/extracurricular/program-links-list.tsx src/components/extracurricular/program-links-list.test.tsx
git commit -m "feat: add ProgramLinksList component for extracurricular program links"
```

---

### Task 4: Program form — Links section (create/edit)

**Files:**
- Modify: `src/components/extracurricular/program-form.tsx`
- Modify: `src/routes/_authenticated/_catechist/extracurricular-programs_.create.tsx`
- Modify: `src/routes/_authenticated/_catechist/extracurricular-programs_.$id_.edit.tsx`
- Test: `src/components/extracurricular/program-form.test.tsx`

**Interfaces:**
- Consumes: `ProgramLink` type from Task 3 (`src/components/extracurricular/program-links-list.tsx`).
- Produces: `ExtracurricularProgramForm`'s `onSubmit` payload gains `links: Array<ProgramLink>`; `initialData` gains optional `links?: Array<ProgramLink>`. `createProgram`/`updateProgram` calls in both route files pass `links: data.links`.

- [ ] **Step 1: Write the failing form test**

Create `src/components/extracurricular/program-form.test.tsx`:

```tsx
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { ExtracurricularProgramForm } from './program-form'
import type { Id } from '../../../convex/_generated/dataModel'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('~/components/custom/richtext-editor', () => ({
  RichTextEditor: ({
    value,
    onChange,
  }: {
    value: string
    onChange: (v: string) => void
  }) => <textarea value={value} onChange={(e) => onChange(e.target.value)} />,
}))

vi.mock('~/components/ui/select', () => {
  return {
    Select: ({ value, onValueChange, children }: any) => (
      <select
        data-testid="mock-select"
        value={value || ''}
        onChange={(e) => onValueChange(e.target.value)}
      >
        {children}
      </select>
    ),
    SelectTrigger: ({ children }: any) => <>{children}</>,
    SelectValue: () => null,
    SelectContent: ({ children }: any) => <>{children}</>,
    SelectItem: ({ value, children }: any) => (
      <option value={value}>{children}</option>
    ),
  }
})

const branches: Array<any> = []

describe('ExtracurricularProgramForm — links section', () => {
  test('starts with no link rows and adds a row on "Add link"', () => {
    render(
      <ExtracurricularProgramForm onSubmit={vi.fn()} branches={branches} />,
    )

    expect(
      screen.getByText('extracurricular.noLinksYet'),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByText('extracurricular.addLink'))

    expect(
      screen.queryByText('extracurricular.noLinksYet'),
    ).not.toBeInTheDocument()
    expect(screen.getByLabelText('extracurricular.linkLabel')).toHaveValue('')
  })

  test('fills a link row and submits it with the rest of the form data', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(
      <ExtracurricularProgramForm onSubmit={onSubmit} branches={branches} />,
    )

    fireEvent.change(screen.getByLabelText('extracurricular.title'), {
      target: { value: 'Camp' },
    })

    fireEvent.click(screen.getByText('extracurricular.addLink'))
    fireEvent.change(screen.getByLabelText('extracurricular.linkLabel'), {
      target: { value: 'Zalo Group' },
    })
    fireEvent.change(screen.getByLabelText('extracurricular.linkUrl'), {
      target: { value: 'https://zalo.me/g/abc' },
    })
    fireEvent.click(
      screen.getByLabelText('extracurricular.forEnrolledOnly'),
    )

    fireEvent.click(screen.getByText('common.save'))

    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalled())
    const payload = onSubmit.mock.calls[0][0]
    expect(payload.links).toEqual([
      {
        type: 'social',
        label: 'Zalo Group',
        url: 'https://zalo.me/g/abc',
        forEnrolledOnly: true,
      },
    ])
  })

  test('removes a link row', () => {
    render(
      <ExtracurricularProgramForm onSubmit={vi.fn()} branches={branches} />,
    )

    fireEvent.click(screen.getByText('extracurricular.addLink'))
    expect(screen.getByLabelText('extracurricular.linkLabel')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('extracurricular.removeLink'))

    expect(
      screen.getByText('extracurricular.noLinksYet'),
    ).toBeInTheDocument()
  })

  test('pre-fills link rows from initialData', () => {
    render(
      <ExtracurricularProgramForm
        onSubmit={vi.fn()}
        branches={branches}
        initialData={{
          title: 'Existing',
          details: '{"type":"doc","content":[]}',
          target: 'all',
          branches: [] as Array<Id<'branches'>>,
          dateStart: '2099-01-01',
          dateEnd: '2099-01-02',
          enrollmentExpireDate: '2099-01-01',
          feeRequired: false,
          links: [
            {
              type: 'im',
              label: 'Existing Zalo',
              url: 'https://zalo.me/g/existing',
              forEnrolledOnly: false,
            },
          ],
        }}
      />,
    )

    expect(screen.getByDisplayValue('Existing Zalo')).toBeInTheDocument()
    expect(
      screen.getByDisplayValue('https://zalo.me/g/existing'),
    ).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/extracurricular/program-form.test.tsx`
Expected: FAIL — no "Add link" text, no `links` in submitted payload, `initialData` type doesn't accept `links`.

- [ ] **Step 3: Add label htmlFor/id wiring needed for the new fields, and the Links card**

In `src/components/extracurricular/program-form.tsx`:

Add the import at the top (after the existing `Checkbox` import, line 15):

```ts
import { Plus, Trash2 } from 'lucide-react'
import type { ProgramLink } from './program-links-list'
```

Update `ProgramFormProps` (lines 25-51) — add `links` to both the `onSubmit` payload type and `initialData`:

```ts
interface ProgramFormProps {
  branches: Array<Doc<'branches'>>
  onSubmit: (data: {
    title: string
    details: string
    target: 'catechist' | 'student' | 'all'
    branches: Array<Id<'branches'>>
    dateStart: string
    dateEnd: string
    enrollmentExpireDate: string
    feeRequired: boolean
    feeAmount?: number
    maxCapacity?: number
    links: Array<ProgramLink>
  }) => Promise<void>
  initialData?: {
    title: string
    details: string
    target: 'catechist' | 'student' | 'all'
    branches: Array<Id<'branches'>>
    dateStart: string
    dateEnd: string
    enrollmentExpireDate: string
    feeRequired: boolean
    feeAmount?: number
    maxCapacity?: number
    links?: Array<ProgramLink>
  }
}
```

Update `defaultValues` (lines 61-74) — add `links`:

```ts
  const defaultValues = {
    title: initialData?.title ?? '',
    details: initialData?.details ?? '{"type":"doc","content":[]}',
    target: initialData?.target ?? 'all',
    branches: initialData?.branches ?? [],
    dateStart: initialData?.dateStart ?? new Date().toISOString().split('T')[0],
    dateEnd: initialData?.dateEnd ?? new Date().toISOString().split('T')[0],
    enrollmentExpireDate:
      initialData?.enrollmentExpireDate ??
      new Date().toISOString().split('T')[0],
    feeRequired: initialData?.feeRequired ?? false,
    feeAmount: initialData?.feeAmount,
    maxCapacity: initialData?.maxCapacity,
    links: initialData?.links ?? ([] as Array<ProgramLink>),
  }
```

Update the `onSubmit` handler inside `useForm` (lines 76-97) to pass `links` through:

```ts
  const form = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      setIsSubmitting(true)
      try {
        await onSubmit({
          title: value.title,
          details: value.details,
          target: value.target,
          branches: value.branches,
          dateStart: value.dateStart,
          dateEnd: value.dateEnd,
          enrollmentExpireDate: value.enrollmentExpireDate,
          feeRequired: value.feeRequired,
          feeAmount: value.feeAmount,
          maxCapacity: value.maxCapacity,
          links: value.links,
        })
      } finally {
        setIsSubmitting(false)
      }
    },
  })
```

Also add an `id="title"` label association fix is not needed (already `htmlFor="title"` + `id="title"` present). Add a new "Links" `Card` between the "Fees & Capacity" `Card` (ends at line 383) and the submit `Button` (line 385):

```tsx
      {/* Links */}
      <Card>
        <CardHeader>
          <CardTitle>{t('extracurricular.sections.links')}</CardTitle>
          <CardDescription>
            {t('extracurricular.sections.linksDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form.Field
            name="links"
            children={(field) => (
              <div className="space-y-4">
                {field.state.value.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    {t('extracurricular.noLinksYet')}
                  </p>
                )}
                {field.state.value.map((link, index) => (
                  <div key={index} className="space-y-3 rounded-lg border p-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`link-type-${index}`}>
                          {t('extracurricular.linkType')}
                        </Label>
                        <Select
                          value={link.type}
                          onValueChange={(value) => {
                            const next = [...field.state.value]
                            next[index] = {
                              ...next[index],
                              type: value as 'social' | 'im',
                            }
                            field.handleChange(next)
                          }}
                          items={[
                            {
                              value: 'social',
                              label: t('extracurricular.linkType.social'),
                            },
                            {
                              value: 'im',
                              label: t('extracurricular.linkType.im'),
                            },
                          ]}
                        >
                          <SelectTrigger id={`link-type-${index}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="social">
                              {t('extracurricular.linkType.social')}
                            </SelectItem>
                            <SelectItem value="im">
                              {t('extracurricular.linkType.im')}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`link-label-${index}`}>
                          {t('extracurricular.linkLabel')}
                        </Label>
                        <Input
                          id={`link-label-${index}`}
                          aria-label={t('extracurricular.linkLabel')}
                          value={link.label}
                          onChange={(e) => {
                            const next = [...field.state.value]
                            next[index] = {
                              ...next[index],
                              label: e.target.value,
                            }
                            field.handleChange(next)
                          }}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`link-url-${index}`}>
                        {t('extracurricular.linkUrl')}
                      </Label>
                      <Input
                        id={`link-url-${index}`}
                        aria-label={t('extracurricular.linkUrl')}
                        value={link.url}
                        onChange={(e) => {
                          const next = [...field.state.value]
                          next[index] = { ...next[index], url: e.target.value }
                          field.handleChange(next)
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`link-enrolled-only-${index}`}
                          aria-label={t('extracurricular.forEnrolledOnly')}
                          checked={link.forEnrolledOnly}
                          onCheckedChange={(checked) => {
                            const next = [...field.state.value]
                            next[index] = {
                              ...next[index],
                              forEnrolledOnly: checked as boolean,
                            }
                            field.handleChange(next)
                          }}
                        />
                        <label
                          htmlFor={`link-enrolled-only-${index}`}
                          className="text-sm cursor-pointer"
                        >
                          {t('extracurricular.forEnrolledOnly')}
                        </label>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t('extracurricular.removeLink')}
                        onClick={() =>
                          field.handleChange(
                            field.state.value.filter((_, i) => i !== index),
                          )
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    field.handleChange([
                      ...field.state.value,
                      {
                        type: 'social',
                        label: '',
                        url: '',
                        forEnrolledOnly: false,
                      },
                    ])
                  }
                >
                  <Plus className="mr-1 size-4" />
                  {t('extracurricular.addLink')}
                </Button>
              </div>
            )}
          />
        </CardContent>
      </Card>

```

Also add `aria-label={t('extracurricular.title')}` is unnecessary since the `title` field already uses `htmlFor="title"` + `id="title"` (label association already works via `getByLabelText`).

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/extracurricular/program-form.test.tsx`
Expected: PASS (all 4 tests).

- [ ] **Step 5: Wire `links` through the create route**

In `src/routes/_authenticated/_catechist/extracurricular-programs_.create.tsx`, update the `handleSubmit` parameter type (lines 42-53) and the `createProgram` call (lines 57-69):

```ts
  const handleSubmit = async (data: {
    title: string
    details: string
    target: 'catechist' | 'student' | 'all'
    branches: Array<Id<'branches'>>
    dateStart: string
    dateEnd: string
    enrollmentExpireDate: string
    feeRequired: boolean
    feeAmount?: number
    maxCapacity?: number
    links: Array<{
      type: 'social' | 'im'
      label: string
      url: string
      forEnrolledOnly: boolean
    }>
  }) => {
    if (!requesterId) return

    try {
      const programId = await createProgram({
        requesterId,
        title: data.title,
        details: data.details,
        target: data.target,
        branches: data.branches,
        dateStart: data.dateStart,
        dateEnd: data.dateEnd,
        enrollmentExpireDate: data.enrollmentExpireDate,
        feeRequired: data.feeRequired,
        feeAmount: data.feeAmount,
        maxCapacity: data.maxCapacity,
        links: data.links,
      })
      toast.success(t('common.created'))
      navigate({
        to: '/extracurricular-programs/$id',
        params: { id: programId },
      })
    } catch (error) {
      toast.error(translateConvexError(error, t))
    }
  }
```

- [ ] **Step 6: Wire `links` through the edit route**

In `src/routes/_authenticated/_catechist/extracurricular-programs_.$id_.edit.tsx`, apply the same `handleSubmit` type change (lines 61-72) and add `links: data.links` to the `updateProgram` call (lines 76-89), and pass `links: program.links ?? []` in the `initialData` prop (lines 111-122):

```ts
  const handleSubmit = async (data: {
    title: string
    details: string
    target: 'catechist' | 'student' | 'all'
    branches: Array<Id<'branches'>>
    dateStart: string
    dateEnd: string
    enrollmentExpireDate: string
    feeRequired: boolean
    feeAmount?: number
    maxCapacity?: number
    links: Array<{
      type: 'social' | 'im'
      label: string
      url: string
      forEnrolledOnly: boolean
    }>
  }) => {
    if (!requesterId) return

    try {
      await updateProgram({
        programId: id as Id<'extracurricularPrograms'>,
        requesterId,
        title: data.title,
        details: data.details,
        target: data.target,
        branches: data.branches,
        dateStart: data.dateStart,
        dateEnd: data.dateEnd,
        enrollmentExpireDate: data.enrollmentExpireDate,
        feeRequired: data.feeRequired,
        feeAmount: data.feeAmount,
        maxCapacity: data.maxCapacity,
        links: data.links,
      })
      toast.success(t('common.updated'))
      navigate({
        to: '/extracurricular-programs/$id',
        params: { id: id },
      })
    } catch (error) {
      toast.error(translateConvexError(error, t))
    }
  }
```

```tsx
      <ExtracurricularProgramForm
        onSubmit={handleSubmit}
        branches={branches}
        initialData={{
          title: program.title,
          details: program.details,
          target: program.target,
          branches: program.branches,
          dateStart: program.dateStart,
          dateEnd: program.dateEnd,
          enrollmentExpireDate: program.enrollmentExpireDate,
          feeRequired: program.feeRequired,
          feeAmount: program.feeAmount,
          maxCapacity: program.maxCapacity,
          links: program.links ?? [],
        }}
      />
```

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/extracurricular/program-form.tsx src/components/extracurricular/program-form.test.tsx src/routes/_authenticated/_catechist/extracurricular-programs_.create.tsx src/routes/_authenticated/_catechist/extracurricular-programs_.\$id_.edit.tsx
git commit -m "feat: add links section to extracurricular program create/edit form"
```

---

### Task 5: Catechist detail page — show links

**Files:**
- Modify: `src/routes/_authenticated/_catechist/extracurricular-programs_.$id.tsx`
- Test: `src/routes/_authenticated/_catechist/-extracurricular-programs_.$id.test.tsx`

**Interfaces:**
- Consumes: `ProgramLinksList` from Task 3.

- [ ] **Step 1: Write the failing test**

Open `src/routes/_authenticated/_catechist/-extracurricular-programs_.$id.test.tsx` and add these two tests inside the `describe('ExtracurricularProgramDetailPage component', ...)` block, after the `triggers export CSV and PDF actions` test (end of file, before the closing `})` at line 187). Reuse the file's existing `setupQueries(program, enrollments)` helper (defined at line 104) and `sampleProgram` fixture (line 59) — the `beforeEach` (line 119) already wires `useAuth`/`useManagementPermission`, so these tests only need to call `setupQueries`:

```tsx
  test('shows links visible to everyone, hides enrolled-only links when not enrolled', () => {
    setupQueries({
      ...sampleProgram,
      userEnrolled: false,
      links: [
        {
          type: 'social',
          label: 'Public Page',
          url: 'https://facebook.com/pub',
          forEnrolledOnly: false,
        },
        {
          type: 'im',
          label: 'Members Zalo',
          url: 'https://zalo.me/g/members',
          forEnrolledOnly: true,
        },
      ],
    })
    render(<DetailPageComponent />)

    expect(screen.getByText('Public Page')).toBeInTheDocument()
    expect(screen.queryByText('Members Zalo')).not.toBeInTheDocument()
  })

  test('shows enrolled-only links when the viewer is enrolled', () => {
    setupQueries({
      ...sampleProgram,
      userEnrolled: true,
      links: [
        {
          type: 'im',
          label: 'Members Zalo',
          url: 'https://zalo.me/g/members',
          forEnrolledOnly: true,
        },
      ],
    })
    render(<DetailPageComponent />)

    expect(screen.getByText('Members Zalo')).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/routes/_authenticated/_catechist/-extracurricular-programs_.\$id.test.tsx -t "links"`
Expected: FAIL — "Public Page" / "Members Zalo" not found (no links rendered yet).

- [ ] **Step 3: Render `ProgramLinksList` in the Enrollment card**

In `src/routes/_authenticated/_catechist/extracurricular-programs_.$id.tsx`:

Add the import (near the other `~/components/custom/...` imports, e.g. after line 38):

```ts
import { ProgramLinksList } from '~/components/extracurricular/program-links-list'
```

Insert `<ProgramLinksList links={program.links} userEnrolled={program.userEnrolled} />` inside the Enrollment `Card`'s `CardContent` (lines 424-480), right after the closing `</div>` of the enroll/unenroll button block (after line 479, still inside `CardContent`):

```tsx
            <CardContent className="space-y-4 grow">
              <div>
                <p className="text-sm text-gray-600">
                  {t('extracurricular.enrollment')}
                </p>
                <p className="text-2xl font-bold">
                  {program.enrollmentCount}
                  {program.maxCapacity ? `/${program.maxCapacity}` : ''}
                </p>
              </div>
              {program.feeRequired && (
                <div>
                  <p className="text-sm text-gray-600">
                    {t('extracurricular.fee')}
                  </p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(program.feeAmount || 0)}
                  </p>
                </div>
              )}

              <div className="pt-2">
                {program.userEnrolled ? (
                  <Button
                    variant="outline"
                    onClick={handleUnenroll}
                    disabled={isSubmitting}
                    className="w-full text-red-600 hover:text-red-700"
                  >
                    {t('extracurricular.unenroll')}
                  </Button>
                ) : program.target === 'student' ? (
                  <Alert variant="destructive">
                    <AlertDescription>
                      {t('extracurricular.studentOnlyTarget')}
                    </AlertDescription>
                  </Alert>
                ) : today > program.enrollmentExpireDate ? (
                  <Button disabled variant="outline" className="w-full">
                    {t('extracurricular.enrollmentClosed')}
                  </Button>
                ) : program.maxCapacity &&
                  program.enrollmentCount >= program.maxCapacity ? (
                  <Button disabled variant="outline" className="w-full">
                    {t('extracurricular.capacityReached')}
                  </Button>
                ) : (
                  <Button
                    onClick={handleEnroll}
                    disabled={isSubmitting}
                    className="w-full"
                  >
                    {t('extracurricular.enroll')}
                  </Button>
                )}
              </div>

              <ProgramLinksList
                links={program.links}
                userEnrolled={program.userEnrolled}
              />
            </CardContent>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/routes/_authenticated/_catechist/-extracurricular-programs_.\$id.test.tsx`
Expected: PASS (all tests in the file, including the two new ones).

- [ ] **Step 5: Commit**

```bash
git add src/routes/_authenticated/_catechist/extracurricular-programs_.\$id.tsx src/routes/_authenticated/_catechist/-extracurricular-programs_.\$id.test.tsx
git commit -m "feat: show program links on catechist extracurricular detail page"
```

---

### Task 6: Student detail page — show links + fee dialog join links

**Files:**
- Modify: `src/routes/_authenticated/_student/my-extracurricular-programs_.$id.tsx`
- Test: `src/routes/_authenticated/_student/-my-extracurricular-programs_.$id.test.tsx`

**Interfaces:**
- Consumes: `ProgramLinksList` from Task 3.

- [ ] **Step 1: Write the failing tests**

In `src/routes/_authenticated/_student/-my-extracurricular-programs_.$id.test.tsx`, add these tests inside the `describe('MyExtracurricularProgramDetailPage component', ...)` block:

```tsx
  test('shows public links on the enrollment card, hides enrolled-only links when not enrolled', () => {
    setupQuery(
      baseProgram({
        dateStart: '2099-01-01',
        dateEnd: '2099-01-10',
        enrollmentExpireDate: '2099-01-05',
        links: [
          {
            type: 'social',
            label: 'Public Page',
            url: 'https://facebook.com/pub',
            forEnrolledOnly: false,
          },
          {
            type: 'im',
            label: 'Members Zalo',
            url: 'https://zalo.me/g/members',
            forEnrolledOnly: true,
          },
        ],
      }),
    )
    render(<DetailPageComponent />)

    expect(screen.getByText('Public Page')).toBeInTheDocument()
    expect(screen.queryByText('Members Zalo')).not.toBeInTheDocument()
  })

  test('shows join links in the fee dialog after enrolling in a fee-required program', async () => {
    mockEnroll.mockResolvedValue(undefined)
    setupQuery(
      baseProgram({
        feeRequired: true,
        feeAmount: 500000,
        dateStart: '2099-01-01',
        dateEnd: '2099-01-10',
        enrollmentExpireDate: '2099-01-05',
        links: [
          {
            type: 'im',
            label: 'Members Zalo',
            url: 'https://zalo.me/g/members',
            forEnrolledOnly: true,
          },
        ],
      }),
    )
    render(<DetailPageComponent />)

    fireEvent.click(
      screen.getByRole('button', { name: 'extracurricular.enroll' }),
    )

    expect(
      await screen.findByText('extracurricular.feeDialogTitle'),
    ).toBeInTheDocument()
    const dialog = screen.getByRole('dialog')
    const link = within(dialog).getByRole('link', { name: /Members Zalo/ })
    expect(link).toHaveAttribute('href', 'https://zalo.me/g/members')
  })
```

Add `within` to the existing `import { fireEvent, render, screen, waitFor } from '@testing-library/react'` line at the top of the file (change it to `import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'`).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/routes/_authenticated/_student/-my-extracurricular-programs_.\$id.test.tsx -t "links"`
Expected: FAIL — "Public Page" / "Members Zalo" not found.

- [ ] **Step 3: Render `ProgramLinksList` in the Enrollment card and the fee dialog**

In `src/routes/_authenticated/_student/my-extracurricular-programs_.$id.tsx`:

Add the import (after the existing `RichTextEditor` import, line 16):

```ts
import { ProgramLinksList } from '~/components/extracurricular/program-links-list'
```

Insert `<ProgramLinksList links={program.links} userEnrolled={program.userEnrolled} />` inside the Enrollment `Card`'s `CardContent` (lines 173-214), right after the closing `</div>` of the `pt-2` button block (after line 213, still inside `CardContent`):

```tsx
            <CardContent className="space-y-4 grow">
              <div>
                <p className="text-sm text-muted-foreground">
                  {t('extracurricular.fee')}
                </p>
                <p className="text-lg font-semibold">
                  {program.feeRequired
                    ? formatCurrency(program.feeAmount || 0)
                    : t('extracurricular.free')}
                </p>
              </div>

              <div className="pt-2">
                {program.userEnrolled ? (
                  <Button
                    onClick={handleUnenroll}
                    disabled={isSubmitting}
                    variant="outline"
                    className="w-full"
                  >
                    {t('extracurricular.unenroll')}
                  </Button>
                ) : today > program.enrollmentExpireDate ? (
                  <Button disabled variant="outline" className="w-full">
                    {t('extracurricular.enrollmentClosed')}
                  </Button>
                ) : program.maxCapacity &&
                  program.enrollmentCount >= program.maxCapacity ? (
                  <Button disabled variant="outline" className="w-full">
                    {t('extracurricular.capacityReached')}
                  </Button>
                ) : (
                  <Button
                    onClick={handleEnroll}
                    disabled={isSubmitting}
                    className="w-full"
                  >
                    {t('extracurricular.enroll')}
                  </Button>
                )}
              </div>

              <ProgramLinksList
                links={program.links}
                userEnrolled={program.userEnrolled}
              />
            </CardContent>
```

Add `ProgramLinksList` to the fee dialog (lines 233-247), between `DialogHeader` and `DialogFooter`, passing `userEnrolled={true}` unconditionally since this dialog only shows immediately after a successful enroll:

```tsx
      <Dialog open={showFeeDialog} onOpenChange={setShowFeeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('extracurricular.feeDialogTitle')}</DialogTitle>
            <DialogDescription>
              {t('extracurricular.feeDialogDescription')}
            </DialogDescription>
          </DialogHeader>
          <ProgramLinksList links={program.links} userEnrolled={true} />
          <DialogFooter>
            <Button onClick={() => setShowFeeDialog(false)}>
              {t('common.gotIt')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/routes/_authenticated/_student/-my-extracurricular-programs_.\$id.test.tsx`
Expected: PASS (all tests in the file, including the two new ones).

- [ ] **Step 5: Commit**

```bash
git add src/routes/_authenticated/_student/my-extracurricular-programs_.\$id.tsx src/routes/_authenticated/_student/-my-extracurricular-programs_.\$id.test.tsx
git commit -m "feat: show program links on student detail page and fee dialog"
```

---

### Task 7: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck + lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 2: Run the full affected test suite**

Run: `npx vitest run convex/extracurricularPrograms.test.ts src/components/extracurricular src/routes/_authenticated/_catechist/-extracurricular-programs_.\$id.test.tsx src/routes/_authenticated/_student/-my-extracurricular-programs_.\$id.test.tsx`
Expected: all PASS.

- [ ] **Step 3: Coverage check on touched files**

Run: `npm test -- --coverage`
Expected: `convex/extracurricularPrograms.ts`, `src/components/extracurricular/program-links-list.tsx`, `src/components/extracurricular/program-form.tsx`, `src/routes/_authenticated/_catechist/extracurricular-programs_.$id.tsx`, and `src/routes/_authenticated/_student/my-extracurricular-programs_.$id.tsx` each at or above 75% statements/branches/functions/lines. If any is below, add the missing test case(s) to that file's existing test file and re-run.

- [ ] **Step 4: No commit needed** — this task only verifies work already committed in Tasks 1-6. If Step 3 required new test cases, commit those under the same convention as the relevant earlier task (e.g. `test: cover <case> in <file>`).
