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
  const metaContent: Array<Content> = Object.entries(meta).map(
    ([label, value], i) => ({
      text: `${label}: ${value}`,
      margin: i === 0 ? [0, 10, 0, 4] : [0, 0, 0, 10],
    }),
  )

  return {
    defaultStyle: { font: 'Roboto' },
    content: [
      { text: title, style: 'title', alignment: 'center' },
      ...metaContent,
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
