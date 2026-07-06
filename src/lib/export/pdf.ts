import pdfMake from 'pdfmake/build/pdfmake'
import pdfFonts from 'pdfmake/build/vfs_fonts'
import type { TDocumentDefinitions } from 'pdfmake/interfaces'
import type { ExportRow, PdfClassMeta } from './types'

pdfMake.vfs = pdfFonts
pdfMake.fonts = {
  Roboto: {
    normal: 'Roboto-Regular.ttf',
    bold: 'Roboto-Medium.ttf',
    italics: 'Roboto-Italic.ttf',
    bolditalics: 'Roboto-MediumItalic.ttf',
  },
}

const DEFAULT_PDF_HEADERS = [
  'STT',
  'Saint Name',
  'Full Name',
  'Gender',
  'Date of Birth',
]

export function buildPdfDocDefinition(
  rows: Array<ExportRow>,
  meta: PdfClassMeta,
  headers: Array<string> = DEFAULT_PDF_HEADERS,
): TDocumentDefinitions {
  return {
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
            headers,
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
}

export function exportPdf(
  rows: Array<ExportRow>,
  meta: PdfClassMeta,
  filename: string,
  headers: Array<string> = DEFAULT_PDF_HEADERS,
): void {
  const docDefinition = buildPdfDocDefinition(rows, meta, headers)
  pdfMake.createPdf(docDefinition).download(filename)
}
