import pdfMake from 'pdfmake/build/pdfmake'
import pdfFonts from 'pdfmake/build/vfs_fonts'
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces'
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

export function buildPdfDocDefinition(
  rows: Array<Record<string, CellValue>>,
  title: string,
  meta: Record<string, string>,
  headers: Array<string>,
): TDocumentDefinitions {
  return {
    defaultStyle: { font: 'Roboto' },
    content: [
      { text: title, style: 'title', alignment: 'center' },
      ...makeMetaContent(meta),
      {
        table: {
          headerRows: 1,
          widths: ['auto', '*', '*', 'auto', 'auto'],
          body: [headers, ...rows.map((r) => headers.map((h) => String(r[h])))],
        },
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
): void {
  const docDefinition = buildPdfDocDefinition(rows, title, meta, headers)
  pdfMake.createPdf(docDefinition).download(filename)
}

function formatCatechistName(c: {
  fullName: string
  saintName?: string
}): string {
  return c.saintName ? `${c.saintName} (${c.fullName})` : c.fullName
}

export function buildBranchesPdf(
  branches: Array<{
    branchName: string
    branchHeads: Array<{ fullName: string; saintName?: string }>
  }>,
  title: string,
  meta: Record<string, string>,
): TDocumentDefinitions {
  const body: Array<Array<Content>> = [
    [
      { text: 'Branch', style: 'tableHeader' },
      { text: 'Branch Head(s)', style: 'tableHeader' },
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
        layout: 'lightHorizontalLines',
      },
    ],
    styles: {
      title: { fontSize: 16, bold: true },
      tableHeader: {
        bold: true,
        fontSize: 11,
        color: 'white',
        fillColor: '#2563eb',
      },
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
        { text: 'Class', style: 'tableHeader' },
        { text: 'Homeroom', style: 'tableHeader' },
        { text: 'Co-Teacher(s)', style: 'tableHeader' },
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
      layout: 'lightHorizontalLines',
      margin: [0, 0, 0, 8],
    })
  }

  return {
    defaultStyle: { font: 'Roboto' },
    content,
    styles: {
      title: { fontSize: 16, bold: true },
      sectionTitle: { fontSize: 13, bold: true },
      tableHeader: {
        bold: true,
        fontSize: 11,
        color: 'white',
        fillColor: '#2563eb',
      },
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
): void {
  const docDefinition = buildBranchesPdf(branches, title, meta)
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
): void {
  const docDefinition = buildClassesPdf(branchGroups, title, meta)
  pdfMake.createPdf(docDefinition).download(filename)
}

type CatechistName = { fullName: string; saintName?: string }

function makeMetaContent(meta: Record<string, string>): Array<Content> {
  return Object.entries(meta).map(([label, value], i) => ({
    text: `${label}: ${value}`,
    margin: i === 0 ? [0, 10, 0, 4] : [0, 0, 0, 10],
  }))
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
): TDocumentDefinitions {
  const content: Array<Content> = [
    { text: title, style: 'title', alignment: 'center' },
    ...makeMetaContent(meta),
  ]

  content.push({
    text: 'Board Members',
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
      text: `Branch Head(s): ${
        branch.branchHeads.length === 0
          ? '—'
          : branch.branchHeads.map(formatCatechistName).join(', ')
      }`,
      margin: [0, 0, 0, 8],
      italics: true,
    })

    if (branch.classes.length === 0) {
      content.push({ text: 'No classes assigned.', margin: [0, 0, 0, 8] })
      continue
    }

    const body: Array<Array<Content>> = [
      [
        { text: 'Class', style: 'tableHeader' },
        { text: 'Homeroom', style: 'tableHeader' },
        { text: 'Co-Teacher(s)', style: 'tableHeader' },
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
      layout: 'lightHorizontalLines',
      margin: [0, 0, 0, 8],
    })
  }

  return {
    defaultStyle: { font: 'Roboto' },
    content,
    styles: {
      title: { fontSize: 16, bold: true },
      sectionTitle: { fontSize: 13, bold: true },
      tableHeader: {
        bold: true,
        fontSize: 11,
        color: 'white',
        fillColor: '#2563eb',
      },
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
): void {
  const docDefinition = buildFullAssignmentsPdf(
    boardMembers,
    branches,
    title,
    meta,
  )
  pdfMake.createPdf(docDefinition).download(filename)
}
