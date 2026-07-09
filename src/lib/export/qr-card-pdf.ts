import { formatPersonName } from '../name'
import pdfMake from './pdfmake-instance'
import type {
  Content,
  TDocumentDefinitions,
  TableLayout,
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
