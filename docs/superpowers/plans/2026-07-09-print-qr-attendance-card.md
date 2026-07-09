# Print QR Attendance Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let catechists print a QR-coded ID card per student (troop name, parish name, QR of student code, student name, student code) individually or in bulk, laid out on A4 sheets for hand-cutting, from 4 entry points in the app.

**Architecture:** A pure `pdfmake` doc-definition builder (`qr-card-pdf.ts`) generates a 3×3-per-page A4 card sheet using pdfmake's native `qr` content node (no new dependency). A reusable `PrintCardsDialog` component (cloned from the existing `BulkUpdateSacramentDialog` checkbox-list pattern) lets a user pick students for bulk printing. Both are wired into the class-details page, student-detail page, and the outer students list page.

**Tech Stack:** TanStack Start (React), Convex (read-only — no backend changes), `pdfmake` (already a dependency), `@tanstack/react-form`, ShadCN/Base UI components, `react-i18next`, Vitest + Testing Library.

---

## Spec Reference

Full design: `docs/superpowers/specs/2026-07-09-qr-attendance-card-design.md`

## File Structure

- `src/lib/export/pdfmake-instance.ts` — **new**. Extracted shared `pdfMake` singleton (vfs + fonts config), so the existing `pdf.ts` and the new `qr-card-pdf.ts` don't duplicate setup.
- `src/lib/export/pdf.ts` — **modify**. Import the shared instance instead of configuring `pdfMake` itself.
- `src/lib/export/qr-card-pdf.ts` — **new**. `buildQrCardsPdfDocDefinition` + `exportQrCardsPdf`.
- `src/lib/export/qr-card-pdf.test.ts` — **new**. Unit tests for the doc-definition builder.
- `src/lib/export/index.ts` — **modify**. Barrel-export the new functions/types.
- `src/components/forms/print-cards-dialog.tsx` — **new**. Bulk student-picker dialog, calls `exportQrCardsPdf` on submit.
- `src/components/forms/print-cards-dialog.test.tsx` — **new**. Unit tests for the dialog.
- `src/routes/_authenticated/_catechist/classes_.$id.tsx` — **modify**. Add header "Print cards" button + dialog + row-action "Print card" item.
- `src/routes/_authenticated/_catechist/students_.$id.tsx` — **modify**. Add header "Print card" button (single student).
- `src/routes/_authenticated/_catechist/students.tsx` — **modify**. Add header "Print cards" button + dialog + row-action "Print card" item.
- `src/locales/en-US.json`, `src/locales/vi-VN.json` — **modify**. New `printCards.*` keys.

---

### Task 1: Extract shared pdfMake instance

**Files:**
- Create: `src/lib/export/pdfmake-instance.ts`
- Modify: `src/lib/export/pdf.ts:1-19`

- [ ] **Step 1: Create the shared pdfMake instance module**

```ts
// src/lib/export/pdfmake-instance.ts
import pdfMake from 'pdfmake/build/pdfmake'
import pdfFonts from 'pdfmake/build/vfs_fonts'

pdfMake.vfs = pdfFonts
pdfMake.fonts = {
  Roboto: {
    normal: 'Roboto-Regular.ttf',
    bold: 'Roboto-Medium.ttf',
    italics: 'Roboto-Italic.ttf',
    bolditalics: 'Roboto-MediumItalic.ttf',
  },
}

export default pdfMake
```

- [ ] **Step 2: Update `pdf.ts` to use the shared instance**

Replace lines 1-19 of `src/lib/export/pdf.ts`:

```ts
import pdfMake from 'pdfmake/build/pdfmake'
import pdfFonts from 'pdfmake/build/vfs_fonts'
import { formatPersonName } from '../name'
import type {
  Content,
  TDocumentDefinitions,
  TableLayout,
} from 'pdfmake/interfaces'
import type { CellValue } from './types'

pdfMake.vfs = pdfFonts
pdfMake.fonts = {
  Roboto: {
    normal: 'Roboto-Regular.ttf',
    bold: 'Roboto-Medium.ttf',
    italics: 'Roboto-Italic.ttf',
    bolditalics: 'Roboto-MediumItalic.ttf',
  },
}
```

with:

```ts
import pdfMake from './pdfmake-instance'
import { formatPersonName } from '../name'
import type {
  Content,
  TDocumentDefinitions,
  TableLayout,
} from 'pdfmake/interfaces'
import type { CellValue } from './types'
```

- [ ] **Step 3: Run the existing export test suite to confirm nothing broke**

Run: `npm test -- src/lib/export.test.ts`
Expected: all existing tests still PASS (the test file's own `vi.mock('pdfmake/build/pdfmake', ...)` still intercepts the module that `pdfmake-instance.ts` imports internally).

- [ ] **Step 4: Commit**

```bash
git add src/lib/export/pdfmake-instance.ts src/lib/export/pdf.ts
git commit -m "refactor: extract shared pdfMake instance for reuse by new export builders"
```

---

### Task 2: Build the QR cards PDF doc-definition builder (TDD)

**Files:**
- Create: `src/lib/export/qr-card-pdf.test.ts`
- Create: `src/lib/export/qr-card-pdf.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/export/qr-card-pdf.test.ts
import { describe, expect, it, vi } from 'vitest'
import pdfMake from 'pdfmake/build/pdfmake'
import type { Content } from 'pdfmake/interfaces'
import {
  buildQrCardsPdfDocDefinition,
  exportQrCardsPdf,
} from './qr-card-pdf'
import type { QrCardAppConfig, QrCardStudent } from './qr-card-pdf'

vi.mock('pdfmake/build/pdfmake', () => ({
  default: {
    vfs: undefined,
    fonts: undefined,
    createPdf: vi.fn(),
  },
}))

vi.mock('pdfmake/build/vfs_fonts', () => ({
  default: {},
}))

const appConfig: QrCardAppConfig = {
  troopName: 'Đoàn TNTT Anrê Phú Yên',
  parishName: 'Giáo Xứ Thái Hà',
}

function makeStudent(i: number): QrCardStudent {
  return {
    studentCode: `GL-${String(i).padStart(5, '0')}`,
    fullName: `Học Sinh ${i}`,
    saintName: i % 2 === 0 ? 'Maria' : undefined,
  }
}

function findTables(content: Array<Content>): Array<any> {
  return content as Array<any>
}

describe('buildQrCardsPdfDocDefinition', () => {
  it('lays out students 3 per row on an A4 sheet with one table per page', () => {
    const students = Array.from({ length: 2 }, (_, i) => makeStudent(i + 1))
    const doc = buildQrCardsPdfDocDefinition(students, appConfig)

    expect(doc.pageSize).toBe('A4')
    const tables = findTables(doc.content as Array<Content>)
    expect(tables).toHaveLength(1)
    expect(tables[0].table.body).toHaveLength(1)
    expect(tables[0].table.body[0]).toHaveLength(3)
    expect(tables[0].pageBreak).toBeUndefined()
  })

  it('pads the last row with empty cells so every row has 3 columns', () => {
    const students = Array.from({ length: 4 }, (_, i) => makeStudent(i + 1))
    const doc = buildQrCardsPdfDocDefinition(students, appConfig)

    const tables = findTables(doc.content as Array<Content>)
    expect(tables[0].table.body).toHaveLength(2)
    expect(tables[0].table.body[1]).toHaveLength(3)
    expect(tables[0].table.body[1][1]).toEqual({ text: '' })
    expect(tables[0].table.body[1][2]).toEqual({ text: '' })
  })

  it('starts a new page (table) every 9 students', () => {
    const students = Array.from({ length: 10 }, (_, i) => makeStudent(i + 1))
    const doc = buildQrCardsPdfDocDefinition(students, appConfig)

    const tables = findTables(doc.content as Array<Content>)
    expect(tables).toHaveLength(2)
    expect(tables[0].pageBreak).toBeUndefined()
    expect(tables[1].pageBreak).toBe('before')
    // First page: 9 students -> 3 full rows
    expect(tables[0].table.body).toHaveLength(3)
    // Second page: the 10th student -> 1 row (padded)
    expect(tables[1].table.body).toHaveLength(1)
  })

  it('embeds a QR code encoding the raw student code (not the internal id)', () => {
    const doc = buildQrCardsPdfDocDefinition([makeStudent(1)], appConfig)
    const tables = findTables(doc.content as Array<Content>)
    const card = tables[0].table.body[0][0]
    const qrNode = card.stack.find((node: any) => 'qr' in node)

    expect(qrNode.qr).toBe('GL-00001')
  })

  it('includes the troop name and parish name in the card header, and the student name and code', () => {
    const doc = buildQrCardsPdfDocDefinition([makeStudent(2)], appConfig)
    const tables = findTables(doc.content as Array<Content>)
    const card = tables[0].table.body[0][0]
    const [header, , nameNode, codeNode] = card.stack

    expect(header.text).toBe('Đoàn TNTT Anrê Phú Yên\nGiáo Xứ Thái Hà')
    expect(nameNode.text).toBe('Maria Học Sinh 2')
    expect(codeNode.text).toBe('GL-00002')
  })

  it('omits the troop name line when appConfig.troopName is not set', () => {
    const doc = buildQrCardsPdfDocDefinition([makeStudent(1)], {
      parishName: 'Giáo Xứ Thái Hà',
    })
    const tables = findTables(doc.content as Array<Content>)
    const card = tables[0].table.body[0][0]
    const [header] = card.stack

    expect(header.text).toBe('Giáo Xứ Thái Hà')
  })
})

describe('exportQrCardsPdf', () => {
  const downloadMock = vi.fn()

  it('builds the doc definition and triggers a download with the given filename', () => {
    vi.mocked(pdfMake.createPdf).mockReturnValue({
      download: downloadMock,
    } as unknown as ReturnType<typeof pdfMake.createPdf>)

    exportQrCardsPdf([makeStudent(1)], appConfig, 'cards.pdf')

    expect(pdfMake.createPdf).toHaveBeenCalledTimes(1)
    expect(downloadMock).toHaveBeenCalledWith('cards.pdf')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/lib/export/qr-card-pdf.test.ts`
Expected: FAIL — `Cannot find module './qr-card-pdf'` (file doesn't exist yet).

- [ ] **Step 3: Implement `qr-card-pdf.ts`**

```ts
// src/lib/export/qr-card-pdf.ts
import pdfMake from './pdfmake-instance'
import { formatPersonName } from '../name'
import type {
  Content,
  TableLayout,
  TDocumentDefinitions,
} from 'pdfmake/interfaces'

export interface QrCardStudent {
  studentCode: string
  fullName: string
  saintName?: string
}

export interface QrCardAppConfig {
  troopName?: string
  parishName: string
}

const CARD_WIDTH_PT = 154
const CARD_HEIGHT_PT = 256
const CARDS_PER_ROW = 3
const ROWS_PER_PAGE = 3
const CARDS_PER_PAGE = CARDS_PER_ROW * ROWS_PER_PAGE

function chunk<T>(items: Array<T>, size: number): Array<Array<T>> {
  const result: Array<Array<T>> = []
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size))
  }
  return result
}

function buildCardContent(
  student: QrCardStudent,
  appConfig: QrCardAppConfig,
): Content {
  const headerText = [appConfig.troopName, appConfig.parishName]
    .filter((line): line is string => Boolean(line))
    .join('\n')

  return {
    stack: [
      {
        text: headerText,
        alignment: 'center',
        fontSize: 8,
        bold: true,
        margin: [4, 4, 4, 4],
      },
      {
        qr: student.studentCode,
        fit: 90,
        alignment: 'center',
        margin: [0, 4, 0, 4],
      },
      {
        text: formatPersonName(student.saintName, student.fullName),
        alignment: 'center',
        fontSize: 10,
        bold: true,
      },
      {
        text: student.studentCode,
        alignment: 'center',
        fontSize: 9,
        color: '#555555',
        margin: [0, 2, 0, 0],
      },
    ],
  }
}

const cardCutLineLayout: TableLayout = {
  hLineWidth: () => 1,
  vLineWidth: () => 1,
  hLineColor: () => '#999999',
  vLineColor: () => '#999999',
  hLineStyle: () => ({ dash: { length: 3 } }),
  vLineStyle: () => ({ dash: { length: 3 } }),
  paddingLeft: () => 6,
  paddingRight: () => 6,
  paddingTop: () => 6,
  paddingBottom: () => 6,
}

export function buildQrCardsPdfDocDefinition(
  students: Array<QrCardStudent>,
  appConfig: QrCardAppConfig,
): TDocumentDefinitions {
  const pages = chunk(students, CARDS_PER_PAGE)

  const content: Array<Content> = pages.map((pageStudents, pageIndex) => {
    const rows = chunk(pageStudents, CARDS_PER_ROW).map((rowStudents) => {
      const cells: Array<Content> = rowStudents.map((student) =>
        buildCardContent(student, appConfig),
      )
      while (cells.length < CARDS_PER_ROW) {
        cells.push({ text: '' })
      }
      return cells
    })

    return {
      table: {
        widths: [CARD_WIDTH_PT, CARD_WIDTH_PT, CARD_WIDTH_PT],
        heights: CARD_HEIGHT_PT,
        body: rows,
      },
      layout: cardCutLineLayout,
      pageBreak: pageIndex === 0 ? undefined : 'before',
    }
  })

  return {
    pageSize: 'A4',
    pageMargins: [20, 20, 20, 20],
    defaultStyle: { font: 'Roboto' },
    content,
  }
}

export function exportQrCardsPdf(
  students: Array<QrCardStudent>,
  appConfig: QrCardAppConfig,
  filename: string,
): void {
  const docDefinition = buildQrCardsPdfDocDefinition(students, appConfig)
  pdfMake.createPdf(docDefinition).download(filename)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/lib/export/qr-card-pdf.test.ts`
Expected: PASS (all 8 tests).

- [ ] **Step 5: Export from the barrel file**

Modify `src/lib/export/index.ts` — add these lines:

```ts
export { exportQrCardsPdf, buildQrCardsPdfDocDefinition } from './qr-card-pdf'
export type { QrCardStudent, QrCardAppConfig } from './qr-card-pdf'
```

- [ ] **Step 6: Run full lint + typecheck on the new files**

Run: `npx tsc --noEmit && npx eslint src/lib/export/qr-card-pdf.ts src/lib/export/index.ts`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/export/qr-card-pdf.ts src/lib/export/qr-card-pdf.test.ts src/lib/export/index.ts
git commit -m "feat: add QR attendance card PDF sheet builder"
```

---

### Task 3: Add i18n strings

**Files:**
- Modify: `src/locales/en-US.json`
- Modify: `src/locales/vi-VN.json`

- [ ] **Step 1: Add English keys**

In `src/locales/en-US.json`, insert immediately after line 455 (`"classes.export.totalStudentsLabel": "Total Students",`):

```json
  "printCards.buttonLabel": "Print Cards",
  "printCards.dialogTitle": "Print QR Cards",
  "printCards.submit": "Print",
  "printCards.singleAction": "Print Card",
```

- [ ] **Step 2: Add Vietnamese keys**

In `src/locales/vi-VN.json`, insert at the same position (after line 455, `"classes.export.totalStudentsLabel": "Tổng số học viên",`):

```json
  "printCards.buttonLabel": "In thẻ",
  "printCards.dialogTitle": "In thẻ QR",
  "printCards.submit": "In",
  "printCards.singleAction": "In thẻ",
```

- [ ] **Step 3: Validate both files are still valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('src/locales/en-US.json')); JSON.parse(require('fs').readFileSync('src/locales/vi-VN.json')); console.log('OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add src/locales/en-US.json src/locales/vi-VN.json
git commit -m "i18n: add print QR cards strings"
```

---

### Task 4: Build the `PrintCardsDialog` component (TDD)

**Files:**
- Create: `src/components/forms/print-cards-dialog.test.tsx`
- Create: `src/components/forms/print-cards-dialog.tsx`

This dialog is deliberately decoupled from any specific page's data shape: callers pass a flat array of `{ _id, fullName, saintName?, studentCode }` and a `title` string. Sorting/filtering (e.g. "only active enrollments") stays the caller's responsibility, matching how `exportRows`/`sortedStudents` are built today in the pages that will use it.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/forms/print-cards-dialog.test.tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { useQuery } from 'convex/react'
import { PrintCardsDialog } from './print-cards-dialog'
import type { Id } from '../../../convex/_generated/dataModel'
import * as qrCardPdf from '~/lib/export/qr-card-pdf'

vi.mock('~/lib/export/qr-card-pdf', async () => ({
  exportQrCardsPdf: vi.fn(),
}))

// Mock Dialog to render inline
vi.mock('~/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) =>
    open ? <div data-testid="mock-dialog">{children}</div> : null,
  DialogContent: ({ children }: any) => (
    <div data-testid="mock-dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
}))

// Mock ScrollArea
vi.mock('~/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: any) => (
    <div data-testid="mock-scroll-area">{children}</div>
  ),
}))

describe('PrintCardsDialog', () => {
  const mockOnOpenChange = vi.fn()

  const mockStudents = [
    {
      _id: 's1' as Id<'students'>,
      studentCode: 'HS001',
      fullName: 'Nguyen Van A',
      saintName: 'Giuse',
    },
    {
      _id: 's2' as Id<'students'>,
      studentCode: 'HS002',
      fullName: 'Le Thi B',
      saintName: 'Maria',
    },
  ]

  beforeEach(() => {
    vi.mocked(useQuery).mockReturnValue({
      parishName: 'Giáo Xứ Thái Hà',
      troopName: 'Đoàn TNTT Anrê Phú Yên',
      nameFormat: 'lastName_firstName',
    } as any)
    mockOnOpenChange.mockClear()
    vi.mocked(qrCardPdf.exportQrCardsPdf).mockClear()
  })

  test('does not render when isOpen is false', () => {
    render(
      <PrintCardsDialog
        isOpen={false}
        onOpenChange={mockOnOpenChange}
        title="Au Nhi 1"
        students={mockStudents}
        filename="au-nhi-1-cards.pdf"
      />,
    )
    expect(screen.queryByTestId('mock-dialog')).toBeNull()
  })

  test('renders the student list', () => {
    render(
      <PrintCardsDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        title="Au Nhi 1"
        students={mockStudents}
        filename="au-nhi-1-cards.pdf"
      />,
    )

    expect(screen.getByText(/Giuse Nguyen Van A/)).toBeInTheDocument()
    expect(screen.getByText(/Maria Le Thi B/)).toBeInTheDocument()
  })

  test('shows an error toast when submitting with no student selected', async () => {
    const { toast } = await import('sonner')
    render(
      <PrintCardsDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        title="Au Nhi 1"
        students={mockStudents}
        filename="au-nhi-1-cards.pdf"
      />,
    )

    fireEvent.click(screen.getByText('printCards.submit'))

    expect(toast.error).toHaveBeenCalledWith(
      'classes.sacraments.bulkUpdate.noStudentsSelected',
    )
    expect(qrCardPdf.exportQrCardsPdf).not.toHaveBeenCalled()
  })

  test('selecting students and submitting exports a PDF for the selected students only', () => {
    render(
      <PrintCardsDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        title="Au Nhi 1"
        students={mockStudents}
        filename="au-nhi-1-cards.pdf"
      />,
    )

    fireEvent.click(screen.getByText('Giuse Nguyen Van A'))
    fireEvent.click(screen.getByText('printCards.submit'))

    expect(qrCardPdf.exportQrCardsPdf).toHaveBeenCalledWith(
      [
        {
          studentCode: 'HS001',
          fullName: 'Nguyen Van A',
          saintName: 'Giuse',
        },
      ],
      {
        troopName: 'Đoàn TNTT Anrê Phú Yên',
        parishName: 'Giáo Xứ Thái Hà',
      },
      'au-nhi-1-cards.pdf',
    )
    expect(mockOnOpenChange).toHaveBeenCalledWith(false)
  })

  test('select-all toggles every student', () => {
    render(
      <PrintCardsDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        title="Au Nhi 1"
        students={mockStudents}
        filename="au-nhi-1-cards.pdf"
      />,
    )

    fireEvent.click(screen.getByText('classes.sacraments.bulkUpdate.selectAll'))
    fireEvent.click(screen.getByText('printCards.submit'))

    expect(qrCardPdf.exportQrCardsPdf).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ studentCode: 'HS001' }),
        expect.objectContaining({ studentCode: 'HS002' }),
      ]),
      expect.anything(),
      'au-nhi-1-cards.pdf',
    )
  })

  test('cancel button closes the dialog without exporting', () => {
    render(
      <PrintCardsDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        title="Au Nhi 1"
        students={mockStudents}
        filename="au-nhi-1-cards.pdf"
      />,
    )

    fireEvent.click(screen.getByText('common.cancel'))

    expect(mockOnOpenChange).toHaveBeenCalledWith(false)
    expect(qrCardPdf.exportQrCardsPdf).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/components/forms/print-cards-dialog.test.tsx`
Expected: FAIL — `Cannot find module './print-cards-dialog'`.

- [ ] **Step 3: Implement `print-cards-dialog.tsx`**

```tsx
// src/components/forms/print-cards-dialog.tsx
import { useMemo } from 'react'
import { useForm } from '@tanstack/react-form'
import { useTranslation } from 'react-i18next'
import { useQuery } from 'convex/react'
import { toast } from 'sonner'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { formatPersonName } from '~/lib/name'
import { exportQrCardsPdf } from '~/lib/export/qr-card-pdf'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Button } from '~/components/ui/button'
import { Field, FieldContent, FieldLabel } from '~/components/ui/field'
import { Checkbox } from '~/components/ui/checkbox'
import { ScrollArea } from '~/components/ui/scroll-area'

export interface PrintCardsStudent {
  _id: Id<'students'>
  fullName: string
  saintName?: string
  studentCode: string
}

interface PrintCardsDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  title: string
  students: Array<PrintCardsStudent>
  filename: string
}

export function PrintCardsDialog({
  isOpen,
  onOpenChange,
  title,
  students,
  filename,
}: PrintCardsDialogProps) {
  const { t } = useTranslation()
  const appConfig = useQuery(api.appConfig.get)

  const sortedStudents = useMemo(() => {
    const nameFormat = appConfig?.nameFormat
    return [...students].sort((a, b) => {
      if (nameFormat === 'firstName_lastName') {
        return a.fullName
          .toLocaleLowerCase()
          .localeCompare(b.fullName.toLocaleLowerCase())
      }
      const lastNameA = a.fullName.split(' ').pop() || ''
      const lastNameB = b.fullName.split(' ').pop() || ''
      return lastNameA
        .toLocaleLowerCase()
        .localeCompare(lastNameB.toLocaleLowerCase())
    })
  }, [students, appConfig?.nameFormat])

  const form = useForm({
    defaultValues: {
      studentIds: [] as Array<Id<'students'>>,
    },
    onSubmit: async ({ value }) => {
      if (value.studentIds.length === 0) {
        toast.error(t('classes.sacraments.bulkUpdate.noStudentsSelected'))
        return
      }
      if (!appConfig) return

      const selected = sortedStudents.filter((s) =>
        value.studentIds.includes(s._id),
      )
      exportQrCardsPdf(
        selected.map((s) => ({
          studentCode: s.studentCode,
          fullName: s.fullName,
          saintName: s.saintName,
        })),
        {
          troopName: appConfig.troopName,
          parishName: appConfig.parishName,
        },
        filename,
      )
      form.reset()
      onOpenChange(false)
    },
  })

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {t('printCards.dialogTitle')} - {title}
          </DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
          className="flex flex-col gap-6"
        >
          <form.Field
            name="studentIds"
            children={(field) => {
              const selectedIds = field.state.value
              const toggleStudent = (id: Id<'students'>) => {
                if (selectedIds.includes(id)) {
                  field.handleChange(selectedIds.filter((x) => x !== id))
                } else {
                  field.handleChange([...selectedIds, id])
                }
              }

              const toggleAll = () => {
                if (selectedIds.length === sortedStudents.length) {
                  field.handleChange([])
                } else {
                  field.handleChange(sortedStudents.map((s) => s._id))
                }
              }

              const isAllChecked =
                sortedStudents.length > 0 &&
                selectedIds.length === sortedStudents.length

              return (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between border-b pb-2 mb-1">
                    <FieldLabel className="mb-0">
                      {t('classes.enrollment.selectStudents')}{' '}
                      <span className="text-destructive">*</span>
                    </FieldLabel>
                    <span className="text-xs text-muted-foreground font-medium">
                      {selectedIds.length} / {sortedStudents.length}
                    </span>
                  </div>

                  <Field orientation="horizontal">
                    <Checkbox
                      id="select-all-print-students"
                      checked={isAllChecked}
                      onCheckedChange={toggleAll}
                    />
                    <FieldContent>
                      <FieldLabel htmlFor="select-all-print-students">
                        {t('classes.sacraments.bulkUpdate.selectAll')}
                      </FieldLabel>
                    </FieldContent>
                  </Field>

                  <div className="border rounded-lg overflow-hidden bg-card">
                    <ScrollArea className="h-60 p-2">
                      <div className="flex flex-col gap-1">
                        {sortedStudents.length === 0 ? (
                          <div className="text-center py-8 text-sm text-muted-foreground">
                            {t('classes.enrollment.noStudents')}
                          </div>
                        ) : (
                          sortedStudents.map((student) => {
                            const isChecked = selectedIds.includes(
                              student._id,
                            )
                            return (
                              <div
                                key={student._id}
                                className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-accent/40 transition-colors"
                              >
                                <Checkbox
                                  id={`print-student-${student._id}`}
                                  checked={isChecked}
                                  onCheckedChange={() =>
                                    toggleStudent(student._id)
                                  }
                                />
                                <label
                                  htmlFor={`print-student-${student._id}`}
                                  className="flex flex-col cursor-pointer select-none flex-1"
                                >
                                  <span className="text-sm font-medium text-foreground">
                                    {formatPersonName(
                                      student.saintName,
                                      student.fullName,
                                    )}
                                  </span>
                                  <span className="text-xs text-muted-foreground font-mono">
                                    {student.studentCode}
                                  </span>
                                </label>
                              </div>
                            )
                          })
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              )
            }}
          />

          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              onClick={() => onOpenChange(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit">{t('printCards.submit')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/components/forms/print-cards-dialog.test.tsx`
Expected: PASS (all 6 tests).

- [ ] **Step 5: Run lint + typecheck on the new files**

Run: `npx tsc --noEmit && npx eslint src/components/forms/print-cards-dialog.tsx`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/forms/print-cards-dialog.tsx src/components/forms/print-cards-dialog.test.tsx
git commit -m "feat: add PrintCardsDialog for bulk QR card printing"
```

---

### Task 5: Wire into the class details page

**Files:**
- Modify: `src/routes/_authenticated/_catechist/classes_.$id.tsx`

- [ ] **Step 1: Add imports and state**

At the top of the file, add to the `lucide-react` import (currently `AlertCircle, CalendarCheck, Download, GraduationCap, MoreHorizontal, Pencil`) the `Printer` icon:

```ts
import {
  AlertCircle,
  CalendarCheck,
  Download,
  GraduationCap,
  MoreHorizontal,
  Pencil,
  Printer,
} from 'lucide-react'
```

Add a new import below the existing `BulkUpdateSacramentDialog` import (line 55):

```ts
import { PrintCardsDialog } from '~/components/forms/print-cards-dialog'
import { exportQrCardsPdf } from '~/lib/export/qr-card-pdf'
```

Add new state next to `bulkUpdateDialogOpen` (line 100):

```ts
const [printCardsDialogOpen, setPrintCardsDialogOpen] = React.useState(false)
```

- [ ] **Step 2: Add the single-student "Print card" row action**

In the row-actions `DropdownMenuContent` (around line 359-392), add a new item after the "Edit" item and before "Attendance" (or anywhere in that menu — order doesn't affect behavior). Insert right after the closing `</DropdownMenuItem>` of the Edit item (line 372):

```tsx
                <DropdownMenuItem
                  onClick={() => {
                    const student = row.original.student
                    if (!student || !appConfig) return
                    exportQrCardsPdf(
                      [
                        {
                          studentCode: student.studentCode,
                          fullName: student.fullName,
                          saintName: student.saintName,
                        },
                      ],
                      {
                        troopName: appConfig.troopName,
                        parishName: appConfig.parishName,
                      },
                      `${student.studentCode}-card.pdf`,
                    )
                  }}
                >
                  <Printer className="size-4" />
                  {t('printCards.singleAction')}
                </DropdownMenuItem>
```

This closure reads `appConfig` from the enclosing component scope — `columns` is already recomputed via `React.useMemo` whenever `appConfig?.nameFormat` changes (line 399), so add `appConfig` to that memo's dependency array too:

Change line 399 from:

```ts
  }, [t, canManage, appConfig?.nameFormat])
```

to:

```ts
  }, [t, canManage, appConfig])
```

- [ ] **Step 3: Add the bulk "Print cards" header button**

In the students-tab toolbar (lines 566-582), add a new button before the closing `</div>` — it should be visible regardless of `canManage` (printing is a read-only action, same as the Export button):

```tsx
              <div className="mb-4 flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setPrintCardsDialogOpen(true)}
                >
                  <Printer className="size-4" />
                  {t('printCards.buttonLabel')}
                </Button>
                {canManage && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setBulkUpdateDialogOpen(true)}
                    >
                      {t('classes.sacraments.bulkUpdate.buttonLabel')}
                    </Button>
                    {!isInactive && (
                      <Button onClick={() => setEnrollDialogOpen(true)}>
                        {t('classes.enrollment.buttonLabel')}
                      </Button>
                    )}
                  </>
                )}
              </div>
```

- [ ] **Step 4: Render the dialog**

After the existing `<BulkUpdateSacramentDialog ... />` block (lines 678-684), add:

```tsx
          <PrintCardsDialog
            isOpen={printCardsDialogOpen}
            onOpenChange={setPrintCardsDialogOpen}
            title={classDetails.class.name}
            students={classDetails.students
              .filter(
                (s): s is typeof s & { student: NonNullable<typeof s.student> } =>
                  s.student !== null && s.enrollment.status === 'active',
              )
              .map((s) => ({
                _id: s.student._id,
                fullName: s.student.fullName,
                saintName: s.student.saintName,
                studentCode: s.student.studentCode,
              }))}
            filename={`${classDetails.class.name}-cards.pdf`}
          />
```

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/routes/_authenticated/_catechist/classes_.$id.tsx`
Expected: no errors.

- [ ] **Step 6: Run the class details route's existing test file (if any) to confirm no regression**

Run: `find src/routes/_authenticated/_catechist -iname "classes_*.test.tsx"` to check for an existing test file, then run it if found:

```bash
npm test -- src/routes/_authenticated/_catechist/classes_.\$id.test.tsx
```

Expected: PASS. If no such test file exists, skip this step (this task doesn't introduce new business logic worth a dedicated route test — the logic under test already lives in `qr-card-pdf.ts` and `print-cards-dialog.tsx`).

- [ ] **Step 7: Commit**

```bash
git add src/routes/_authenticated/_catechist/classes_.\$id.tsx
git commit -m "feat: add print QR card actions to class details page"
```

---

### Task 6: Wire into the student detail page

**Files:**
- Modify: `src/routes/_authenticated/_catechist/students_.$id.tsx`

- [ ] **Step 1: Add imports**

Change the `lucide-react` import (line 4) from:

```ts
import { CalendarCheck, Pencil, Users } from 'lucide-react'
```

to:

```ts
import { CalendarCheck, Pencil, Printer, Users } from 'lucide-react'
```

Add below the existing `formatPersonName` import (line 13):

```ts
import { exportQrCardsPdf } from '~/lib/export/qr-card-pdf'
```

The page needs `appConfig` for troop/parish name. `useQuery` is already imported (line 2: `import { useQuery } from 'convex/react'`), so no import changes are needed for it — just add a new query call in Step 2 below.

- [ ] **Step 2: Fetch appConfig and add the print handler**

After the existing `data` query (lines 36-39), add:

```ts
  const appConfig = useQuery(api.appConfig.get)

  const handlePrintCard = () => {
    if (!data || !appConfig) return
    exportQrCardsPdf(
      [
        {
          studentCode: data.studentCode,
          fullName: data.fullName,
          saintName: data.saintName,
        },
      ],
      {
        troopName: appConfig.troopName,
        parishName: appConfig.parishName,
      },
      `${data.studentCode}-card.pdf`,
    )
  }
```

`api` is already imported at the top of this file (line 5), so no new import is needed for `api.appConfig.get`.

- [ ] **Step 3: Add the header button**

In the `actions` JSX (lines 60-83), add the print button before the "Attendance" button:

```tsx
  const actions = (
    <>
      <Button onClick={handlePrintCard} variant="outline">
        <Printer className="mr-2 size-4" />
        {t('printCards.singleAction')}
      </Button>
      <Button
        onClick={() =>
          navigate({ to: '/students/$id/attendance', params: { id: id! } })
        }
        variant="outline"
      >
        <CalendarCheck className="mr-2 size-4" />
        {t('students.attendance.title')}
      </Button>
      {canManage && (
        <Button
          onClick={() =>
            navigate({ to: '/students/$id/edit', params: { id: id! } })
          }
          variant="outline"
        >
          <Pencil className="mr-2 size-4" />
          {t('common.edit')}
        </Button>
      )}
    </>
  )
```

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/routes/_authenticated/_catechist/students_.\$id.tsx`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/routes/_authenticated/_catechist/students_.\$id.tsx
git commit -m "feat: add print QR card button to student detail page"
```

---

### Task 7: Wire into the outer students list page

**Files:**
- Modify: `src/routes/_authenticated/_catechist/students.tsx`

- [ ] **Step 1: Add imports and state**

Change the `lucide-react` import (line 4) from:

```ts
import { CalendarCheck, MoreHorizontal, Plus, Users } from 'lucide-react'
```

to:

```ts
import { CalendarCheck, MoreHorizontal, Plus, Printer, Users } from 'lucide-react'
```

Add below the existing `formatPersonName` import (line 18):

```ts
import { PrintCardsDialog } from '~/components/forms/print-cards-dialog'
import { exportQrCardsPdf } from '~/lib/export/qr-card-pdf'
```

Add a new state next to `deleteTarget` (line 184):

```ts
const [printCardsDialogOpen, setPrintCardsDialogOpen] = React.useState(false)
```

Fetch `appConfig` — add next to the other top-level queries (e.g. after `classYearsInYear` at line 124):

```ts
  const appConfig = useQuery(api.appConfig.get)
```

- [ ] **Step 2: Add the single-student "Print card" row action**

In the row-actions `DropdownMenuContent` (lines 278-323), add a new item after "View" (line 300) and before the edit/delete items:

```tsx
                <DropdownMenuItem
                  onClick={() => {
                    if (!appConfig) return
                    exportQrCardsPdf(
                      [
                        {
                          studentCode: student.studentCode,
                          fullName: student.fullName,
                          saintName: student.saintName,
                        },
                      ],
                      {
                        troopName: appConfig.troopName,
                        parishName: appConfig.parishName,
                      },
                      `${student.studentCode}-card.pdf`,
                    )
                  }}
                >
                  <Printer className="size-4" />
                  {t('printCards.singleAction')}
                </DropdownMenuItem>
```

The `columns` array (line 205) is a plain `const`, not memoized, so it's already recomputed on every render — no dependency array to update here (unlike the class details page).

- [ ] **Step 3: Add the bulk "Print cards" header button**

In the `PageHeader actions` (lines 337-346), add the button before the existing "Create" button:

```tsx
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => setPrintCardsDialogOpen(true)}
            >
              <Printer className="size-4" />
              {t('printCards.buttonLabel')}
            </Button>
            {requesterId && (
              <Button onClick={() => navigate({ to: '/students/create' })}>
                <Plus className="size-4" />
                {t('students.actions.create')}
              </Button>
            )}
          </>
        }
```

- [ ] **Step 4: Render the dialog**

After the existing closing `</AlertDialog>` (line 501), add:

```tsx
      <PrintCardsDialog
        isOpen={printCardsDialogOpen}
        onOpenChange={setPrintCardsDialogOpen}
        title={t('students.title')}
        students={paginatedStudents.results.map((s) => ({
          _id: s._id,
          fullName: s.fullName,
          saintName: s.saintName,
          studentCode: s.studentCode,
        }))}
        filename="students-cards.pdf"
      />
```

Note: this uses the currently-loaded page of `paginatedStudents.results` (the same data already rendered in the table), consistent with there being no separate "select all across all pages" concept anywhere else in this app's paginated tables.

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/routes/_authenticated/_catechist/students.tsx`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/routes/_authenticated/_catechist/students.tsx
git commit -m "feat: add print QR card actions to outer students list page"
```

---

### Task 8: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite for all touched/created files**

```bash
npm test -- \
  src/lib/export/qr-card-pdf.test.ts \
  src/lib/export.test.ts \
  src/components/forms/print-cards-dialog.test.tsx \
  src/components/forms/bulk-update-sacrament-dialog.test.tsx
```

Expected: all PASS.

- [ ] **Step 2: Run coverage on the new files (project requires 75% min per CLAUDE.md)**

```bash
npm test -- --coverage src/lib/export/qr-card-pdf.ts src/components/forms/print-cards-dialog.tsx
```

Expected: statements/branches/functions/lines all ≥ 75% for both files.

- [ ] **Step 3: Full typecheck and lint across the repo**

```bash
npx tsc --noEmit
npx eslint .
```

Expected: no errors.

- [ ] **Step 4: Manually verify in the running app**

Start the dev server (`npm run dev` and `npx convex dev` if not already running), then:
1. Open a class details page → Students tab → click "Print Cards" → select a couple of students → Print → confirm a PDF downloads with one dashed-cut-line card per student, each showing troop/parish name, a scannable QR, student name, and student code.
2. From the same page's row dropdown, click "Print Card" for a single student → confirm a single-page PDF downloads with just that student's card.
3. Open a student detail page → click "Print Card" → confirm the same single-card PDF downloads.
4. Open the outer Students list → click "Print Cards" → select students → Print → confirm the bulk PDF downloads; also try a single row's "Print Card" action.
5. Scan one of the generated QR codes with any QR reader and confirm it decodes to the plain `studentCode` string (e.g. `GL-00123`), not an internal Convex ID.

- [ ] **Step 5: No commit for this task** — it's verification only. If step 4 surfaces a bug, fix it in the relevant task's files and amend that task's commit workflow (new commit, not amend, per project convention) before considering the plan complete.
