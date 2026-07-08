import pdfMake from 'pdfmake/build/pdfmake'
import pdfFonts from 'pdfmake/build/vfs_fonts'
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

const borderedTableLayout: TableLayout = {
  hLineWidth: () => 1,
  vLineWidth: () => 1,
  hLineColor: () => '#000',
  vLineColor: () => '#000',
  paddingLeft: () => 6,
  paddingRight: () => 6,
  paddingTop: () => 4,
  paddingBottom: () => 4,
}

export function buildPdfDocDefinition(
  rows: Array<Record<string, CellValue>>,
  title: string,
  meta: Record<string, string>,
  headers: Array<string>,
  widths?: Array<string | number>,
): TDocumentDefinitions {
  return {
    defaultStyle: { font: 'Roboto' },
    content: [
      { text: title, style: 'title', alignment: 'center' },
      ...makeMetaContent(meta),
      {
        table: {
          headerRows: 1,
          widths:
            widths ??
            (headers.length === 5
              ? ['auto', '*', '*', 'auto', 'auto']
              : headers.map((_, i) => (i === 0 ? 'auto' : '*'))),
          body: [headers, ...rows.map((r) => headers.map((h) => String(r[h])))],
        },
        layout: borderedTableLayout,
      },
    ],
    styles: {
      title: { fontSize: 16, bold: true },
    },
  }
}

export function exportPdf(
  rows: Array<Record<string, CellValue>>,
  title: string,
  meta: Record<string, string>,
  filename: string,
  headers: Array<string>,
  widths?: Array<string | number>,
): void {
  const docDefinition = buildPdfDocDefinition(
    rows,
    title,
    meta,
    headers,
    widths,
  )
  pdfMake.createPdf(docDefinition).download(filename)
}

function formatCatechistName(c: {
  fullName: string
  saintName?: string
}): string {
  return c.saintName ? `${c.saintName} ${c.fullName}` : c.fullName
}

type CatechistName = { fullName: string; saintName?: string }

function makeMetaContent(meta: Record<string, string>): Array<Content> {
  return Object.entries(meta).map(([label, value], i) => ({
    text: `${label}: ${value}`,
    margin: i === 0 ? [0, 10, 0, 4] : [0, 0, 0, 10],
  }))
}

export function buildBranchesPdf(
  branches: Array<{
    branchName: string
    branchHeads: Array<{ fullName: string; saintName?: string }>
  }>,
  title: string,
  meta: Record<string, string>,
  labels: {
    branchCol: string
    branchHeadsCol: string
  },
): TDocumentDefinitions {
  const body: Array<Array<Content>> = [
    [
      { text: labels.branchCol, style: 'tableHeader' },
      { text: labels.branchHeadsCol, style: 'tableHeader' },
    ],
    ...branches.map((b) => [
      { text: b.branchName },
      {
        text:
          b.branchHeads.length === 0
            ? '—'
            : b.branchHeads.map(formatCatechistName).join('\n'),
      },
    ]),
  ]

  return {
    defaultStyle: { font: 'Roboto' },
    content: [
      { text: title, style: 'title', alignment: 'center' },
      ...makeMetaContent(meta),
      {
        table: {
          headerRows: 1,
          widths: ['*', '*'],
          body,
        },
        layout: borderedTableLayout,
      },
    ],
    styles: {
      title: { fontSize: 16, bold: true },
      tableHeader: { bold: true, fontSize: 11 },
    },
  }
}

export function buildClassesPdf(
  branchGroups: Array<{
    branchName: string
    classes: Array<{
      className: string
      homeroom: { fullName: string; saintName?: string } | null
      coTeachers: Array<{ fullName: string; saintName?: string }>
    }>
  }>,
  title: string,
  meta: Record<string, string>,
  labels: {
    classCol: string
    homeroomCol: string
    coTeachersCol: string
  },
): TDocumentDefinitions {
  const content: Array<Content> = [
    { text: title, style: 'title', alignment: 'center' },
    ...makeMetaContent(meta),
  ]

  for (const group of branchGroups) {
    content.push({
      text: group.branchName,
      style: 'sectionTitle',
      margin: [0, 14, 0, 6],
    })

    if (group.classes.length === 0) {
      content.push({ text: '—', margin: [0, 0, 0, 6] })
      continue
    }

    const body: Array<Array<Content>> = [
      [
        { text: labels.classCol, style: 'tableHeader' },
        { text: labels.homeroomCol, style: 'tableHeader' },
        { text: labels.coTeachersCol, style: 'tableHeader' },
      ],
      ...group.classes.map((c) => [
        { text: c.className },
        { text: c.homeroom ? formatCatechistName(c.homeroom) : '—' },
        {
          text:
            c.coTeachers.length === 0
              ? '—'
              : c.coTeachers.map(formatCatechistName).join('\n'),
        },
      ]),
    ]

    content.push({
      table: {
        headerRows: 1,
        widths: ['*', '*', '*'],
        body,
      },
      layout: borderedTableLayout,
      margin: [0, 0, 0, 8],
    })
  }

  return {
    defaultStyle: { font: 'Roboto' },
    content,
    styles: {
      title: { fontSize: 16, bold: true },
      sectionTitle: { fontSize: 13, bold: true },
      tableHeader: { bold: true, fontSize: 11 },
    },
  }
}

export function exportBranchesPdf(
  branches: Array<{
    branchName: string
    branchHeads: Array<{ fullName: string; saintName?: string }>
  }>,
  title: string,
  meta: Record<string, string>,
  filename: string,
  labels: {
    branchCol: string
    branchHeadsCol: string
  },
): void {
  const docDefinition = buildBranchesPdf(branches, title, meta, labels)
  pdfMake.createPdf(docDefinition).download(filename)
}

export function exportClassesPdf(
  branchGroups: Array<{
    branchName: string
    classes: Array<{
      className: string
      homeroom: { fullName: string; saintName?: string } | null
      coTeachers: Array<{ fullName: string; saintName?: string }>
    }>
  }>,
  title: string,
  meta: Record<string, string>,
  filename: string,
  labels: {
    classCol: string
    homeroomCol: string
    coTeachersCol: string
  },
): void {
  const docDefinition = buildClassesPdf(branchGroups, title, meta, labels)
  pdfMake.createPdf(docDefinition).download(filename)
}

export function buildFullAssignmentsPdf(
  boardMembers: Array<CatechistName>,
  branches: Array<{
    branchName: string
    branchHeads: Array<CatechistName>
    classes: Array<{
      className: string
      homeroom: CatechistName | null
      coTeachers: Array<CatechistName>
    }>
  }>,
  title: string,
  meta: Record<string, string>,
  labels: {
    boardMembers: string
    branchHeadsPrefix: string
    classCol: string
    homeroomCol: string
    coTeachersCol: string
    noClasses: string
  },
): TDocumentDefinitions {
  const content: Array<Content> = [
    { text: title, style: 'title', alignment: 'center' },
    ...makeMetaContent(meta),
  ]

  content.push({
    text: labels.boardMembers,
    style: 'sectionTitle',
    margin: [0, 14, 0, 6],
  })

  if (boardMembers.length === 0) {
    content.push({ text: '—', margin: [0, 0, 0, 8] })
  } else {
    content.push({
      ul: boardMembers.map((m) => formatCatechistName(m)),
      margin: [10, 0, 0, 10],
    })
  }

  for (const branch of branches) {
    content.push({
      text: branch.branchName,
      style: 'sectionTitle',
      margin: [0, 14, 0, 6],
    })

    content.push({
      text: `${labels.branchHeadsPrefix}${
        branch.branchHeads.length === 0
          ? '—'
          : branch.branchHeads.map(formatCatechistName).join(', ')
      }`,
      margin: [0, 0, 0, 8],
      italics: true,
    })

    if (branch.classes.length === 0) {
      content.push({ text: labels.noClasses, margin: [0, 0, 0, 8] })
      continue
    }

    const body: Array<Array<Content>> = [
      [
        { text: labels.classCol, style: 'tableHeader' },
        { text: labels.homeroomCol, style: 'tableHeader' },
        { text: labels.coTeachersCol, style: 'tableHeader' },
      ],
      ...branch.classes.map((c) => [
        { text: c.className },
        { text: c.homeroom ? formatCatechistName(c.homeroom) : '—' },
        {
          text:
            c.coTeachers.length === 0
              ? '—'
              : c.coTeachers.map(formatCatechistName).join('\n'),
        },
      ]),
    ]

    content.push({
      table: { headerRows: 1, widths: ['*', '*', '*'], body },
      layout: borderedTableLayout,
      margin: [0, 0, 0, 8],
    })
  }

  return {
    defaultStyle: { font: 'Roboto' },
    content,
    styles: {
      title: { fontSize: 16, bold: true },
      sectionTitle: { fontSize: 13, bold: true },
      tableHeader: { bold: true, fontSize: 11 },
    },
  }
}

export function exportFullAssignmentsPdf(
  boardMembers: Array<CatechistName>,
  branches: Array<{
    branchName: string
    branchHeads: Array<CatechistName>
    classes: Array<{
      className: string
      homeroom: CatechistName | null
      coTeachers: Array<CatechistName>
    }>
  }>,
  title: string,
  meta: Record<string, string>,
  filename: string,
  labels: {
    boardMembers: string
    branchHeadsPrefix: string
    classCol: string
    homeroomCol: string
    coTeachersCol: string
    noClasses: string
  },
): void {
  const docDefinition = buildFullAssignmentsPdf(
    boardMembers,
    branches,
    title,
    meta,
    labels,
  )
  pdfMake.createPdf(docDefinition).download(filename)
}
