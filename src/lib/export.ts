import pdfMake from 'pdfmake/build/pdfmake'
import pdfFonts from 'pdfmake/build/vfs_fonts'
import type { TDocumentDefinitions } from 'pdfmake/interfaces'

pdfMake.vfs = pdfFonts
pdfMake.fonts = {
  Roboto: {
    normal: 'Roboto-Regular.ttf',
    bold: 'Roboto-Medium.ttf',
    italics: 'Roboto-Italic.ttf',
    bolditalics: 'Roboto-MediumItalic.ttf',
  },
}

export interface ExportRow {
  order: number
  saintName: string
  fullName: string
  gender: string
  dob: string
}

export interface PdfClassMeta {
  className: string
  catechistNames: string
  studentCount: number
}

export function exportCsv(rows: Array<ExportRow>, filename: string) {
  const headers = ['STT', 'Saint Name', 'Full Name', 'Gender', 'Date of Birth']
  const csvContent = [
    headers.join(','),
    ...rows.map((r) =>
      [
        r.order,
        `"${r.saintName}"`,
        `"${r.fullName}"`,
        `"${r.gender}"`,
        `"${r.dob}"`,
      ].join(','),
    ),
  ].join('\n')

  const bom = new Uint8Array([0xef, 0xbb, 0xbf])
  const encoded = new TextEncoder().encode(csvContent)
  const blob = new Blob([bom, encoded], { type: 'text/csv;charset=utf-8' })
  downloadBlob(blob, filename)
}

export function exportPdf(
  rows: Array<ExportRow>,
  meta: PdfClassMeta,
  filename: string,
) {
  const docDefinition: TDocumentDefinitions = {
    defaultStyle: { font: 'Roboto' },
    content: [
      { text: meta.className, style: 'title', alignment: 'center' },
      { text: `Catechists: ${meta.catechistNames}`, margin: [0, 10, 0, 4] },
      { text: `Total Students: ${meta.studentCount}`, margin: [0, 0, 0, 10] },
      {
        table: {
          headerRows: 1,
          widths: ['auto', '*', '*', 'auto', 'auto'],
          body: [
            ['STT', 'Saint Name', 'Full Name', 'Gender', 'Date of Birth'],
            ...rows.map((r) => [
              String(r.order),
              r.saintName,
              r.fullName,
              r.gender,
              r.dob,
            ]),
          ],
        },
      },
    ],
    styles: {
      title: { fontSize: 16, bold: true },
    },
  }

  pdfMake.createPdf(docDefinition).download(filename)
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
