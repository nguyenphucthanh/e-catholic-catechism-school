import pdfMake from './pdfmake-instance'
import type {
  Content,
  TDocumentDefinitions,
  TableLayout,
} from 'pdfmake/interfaces'

export interface QrCardStudent {
  type?: 'student'
  studentCode: string
  fullName: string
  saintName?: string
}

export interface QrCardCatechist {
  type: 'catechist'
  memberId: string
  fullName: string
  saintName?: string
}

export type QrCardItem = QrCardStudent | QrCardCatechist

export interface QrCardAppConfig {
  troopName?: string
  parishName: string
  studentCodeLabel?: string
  catechistCodeLabel?: string
  studentPrefix: string
  catechistPrefix: string
}

// Student payload stays the raw code (already-printed cards + scanner rely on it).
export function getQrPayload(item: QrCardItem): string {
  return item.type === 'catechist'
    ? JSON.stringify({ type: 'catechist', memberId: item.memberId })
    : item.studentCode
}

const CARD_WIDTH_PT = 154
const CARD_HEIGHT_PT = 220
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
  student: QrCardItem,
  appConfig: QrCardAppConfig,
): Content {
  const headerText = [appConfig.troopName, appConfig.parishName]
    .filter((line): line is string => Boolean(line))
    .join('\n')

  const nameStack: Array<Content> = []
  if (student.saintName) {
    nameStack.push({
      text: student.saintName,
      alignment: 'center',
      fontSize: 9,
      bold: true,
      color: '#333333',
    })
  }
  nameStack.push({
    text: student.fullName,
    alignment: 'center',
    fontSize: 10,
    bold: true,
  })

  const codeText =
    student.type === 'catechist'
      ? `${appConfig.catechistCodeLabel || 'Catechist code:'} ${appConfig.catechistPrefix}-${student.memberId}`
      : `${appConfig.studentCodeLabel || 'Student code:'} ${appConfig.studentPrefix}-${student.studentCode}`

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
        qr: getQrPayload(student),
        fit: 90,
        alignment: 'center',
        margin: [0, 4, 0, 4],
      },
      {
        stack: [
          ...nameStack,
          {
            text: codeText,
            alignment: 'center',
            fontSize: 9,
            color: '#555555',
            margin: [0, 2, 0, 0],
          },
        ],
        margin: [0, 45, 0, 0],
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
  students: Array<QrCardItem>,
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
  students: Array<QrCardItem>,
  appConfig: QrCardAppConfig,
  filename: string,
): void {
  const docDefinition = buildQrCardsPdfDocDefinition(students, appConfig)
  pdfMake.createPdf(docDefinition).download(filename)
}
