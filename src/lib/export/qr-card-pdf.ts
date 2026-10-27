import pdfMake from './pdfmake-instance'
import type {
  Content,
  TDocumentDefinitions,
  TableLayout,
} from 'pdfmake/interfaces'
import { encodeCatechistQr } from '~/lib/qr-payload'

export interface QrCardStudent {
  type?: 'student'
  studentCode: string
  fullName: string
  saintName?: string
  photoUrl?: string
}

export interface QrCardCatechist {
  type: 'catechist'
  memberId: string
  fullName: string
  saintName?: string
  photoUrl?: string
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
    ? encodeCatechistQr(item.memberId)
    : item.studentCode
}

const CARD_WIDTH_PT = 154
const CARD_HEIGHT_PT = 220
const CARDS_PER_ROW = 3
const ROWS_PER_PAGE = 3
const CARDS_PER_PAGE = CARDS_PER_ROW * ROWS_PER_PAGE
// Photo is cropped to 2:3 (portrait) via pdfmake `cover`.
const PHOTO_WIDTH_PT = 48
const PHOTO_HEIGHT_PT = 72
const QR_FIT_WITH_PHOTO_PT = 64
const QR_FIT_PT = 90
// Catechist top section has a fixed height budget, so its QR gives back what the extra header spacing takes.
const CATECHIST_QR_FIT_WITH_PHOTO_PT = 60
// Space above the header text, measured from the cut line (student cards also add CARD_INSET_PT).
const HEADER_TOP_MARGIN_PT = 14
const CATECHIST_HEADER_TOP_MARGIN_PT = 8
// Catechist card: photo/QR on top, red full-bleed name block at the bottom (sums to CARD_HEIGHT_PT).
const CATECHIST_BAND_COLOR = '#a30b0b'
const CATECHIST_TOP_HEIGHT_PT = 175
const CATECHIST_BAND_HEIGHT_PT = CARD_HEIGHT_PT - CATECHIST_TOP_HEIGHT_PT
// Cut-line cells have no padding so the red band touches the dashed lines; students get this margin instead.
const CARD_INSET_PT = 6

// Resolved data URLs keyed by photoUrl; filled by exportQrCardsPdf before building.
type PhotoDataUrls = Map<string, string>

async function toDataUrl(url: string): Promise<string | undefined> {
  try {
    const res = await fetch(url)
    if (!res.ok) return undefined
    const blob = await res.blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
  } catch {
    return undefined
  }
}

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
  photos: PhotoDataUrls,
): Content {
  const photo = student.photoUrl ? photos.get(student.photoUrl) : undefined
  const headerText = [appConfig.troopName, appConfig.parishName]
    .filter((line): line is string => Boolean(line))
    .join('\n')

  const isCatechist = student.type === 'catechist'

  const nameStack: Array<Content> = []
  if (student.saintName) {
    nameStack.push({
      text: student.saintName,
      alignment: 'center',
      fontSize: 9,
      bold: true,
      color: isCatechist ? '#FFFFFF' : '#333333',
    })
  }
  nameStack.push({
    text: student.fullName,
    alignment: 'center',
    fontSize: 10,
    bold: true,
    ...(isCatechist && { color: '#FFFFFF' }),
  })

  const codeText =
    student.type === 'catechist'
      ? `${appConfig.catechistCodeLabel || 'Catechist code:'} ${appConfig.catechistPrefix}-${student.memberId}`
      : `${appConfig.studentCodeLabel || 'Student code:'} ${appConfig.studentPrefix}-${student.studentCode}`

  const topContent: Array<Content> = [
    {
      text: headerText,
      alignment: 'center',
      fontSize: 8,
      bold: true,
      margin: [
        4,
        isCatechist ? CATECHIST_HEADER_TOP_MARGIN_PT : HEADER_TOP_MARGIN_PT,
        4,
        4,
      ],
    },
    ...(photo
      ? [
          {
            image: photo,
            cover: { width: PHOTO_WIDTH_PT, height: PHOTO_HEIGHT_PT },
            width: PHOTO_WIDTH_PT,
            height: PHOTO_HEIGHT_PT,
            alignment: 'center' as const,
            margin: [0, 2, 0, 2] as [number, number, number, number],
          },
        ]
      : []),
    {
      qr: getQrPayload(student),
      fit: photo
        ? isCatechist
          ? CATECHIST_QR_FIT_WITH_PHOTO_PT
          : QR_FIT_WITH_PHOTO_PT
        : QR_FIT_PT,
      alignment: 'center',
      margin: [0, 4, 0, 4],
    },
  ]

  const codeNode: Content = {
    text: codeText,
    alignment: 'center',
    fontSize: 9,
    color: isCatechist ? '#FFFFFF' : '#555555',
    margin: [0, 2, 0, 0],
  }

  if (isCatechist) {
    return {
      table: {
        widths: [CARD_WIDTH_PT],
        heights: [CATECHIST_TOP_HEIGHT_PT, CATECHIST_BAND_HEIGHT_PT],
        body: [
          [{ stack: topContent, margin: [CARD_INSET_PT, 0, CARD_INSET_PT, 0] }],
          [
            {
              stack: [...nameStack, codeNode],
              fillColor: CATECHIST_BAND_COLOR,
              margin: [CARD_INSET_PT, 12, CARD_INSET_PT, 12],
            },
          ],
        ],
      },
      layout: flushLayout,
    }
  }

  return {
    stack: [
      ...topContent,
      {
        stack: [...nameStack, codeNode],
        margin: [0, photo ? 4 : 45, 0, 0],
      },
    ],
    margin: [CARD_INSET_PT, CARD_INSET_PT, CARD_INSET_PT, CARD_INSET_PT],
  }
}

const flushLayout: TableLayout = {
  hLineWidth: () => 0,
  vLineWidth: () => 0,
  paddingLeft: () => 0,
  paddingRight: () => 0,
  paddingTop: () => 0,
  paddingBottom: () => 0,
}

const cardCutLineLayout: TableLayout = {
  hLineWidth: () => 1,
  vLineWidth: () => 1,
  hLineColor: () => '#999999',
  vLineColor: () => '#999999',
  hLineStyle: () => ({ dash: { length: 3 } }),
  vLineStyle: () => ({ dash: { length: 3 } }),
  paddingLeft: () => 0,
  paddingRight: () => 0,
  paddingTop: () => 0,
  paddingBottom: () => 0,
}

export function buildQrCardsPdfDocDefinition(
  students: Array<QrCardItem>,
  appConfig: QrCardAppConfig,
  photos: PhotoDataUrls = new Map(),
): TDocumentDefinitions {
  const pages = chunk(students, CARDS_PER_PAGE)

  const content: Array<Content> = pages.map((pageStudents, pageIndex) => {
    const rows = chunk(pageStudents, CARDS_PER_ROW).map((rowStudents) => {
      const cells: Array<Content> = rowStudents.map((student) =>
        buildCardContent(student, appConfig, photos),
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

export async function exportQrCardsPdf(
  students: Array<QrCardItem>,
  appConfig: QrCardAppConfig,
  filename: string,
): Promise<void> {
  const urls = [
    ...new Set(
      students.map((s) => s.photoUrl).filter((u): u is string => Boolean(u)),
    ),
  ]
  const photos: PhotoDataUrls = new Map()
  await Promise.all(
    urls.map(async (url) => {
      const dataUrl = await toDataUrl(url)
      if (dataUrl) photos.set(url, dataUrl)
    }),
  )
  const docDefinition = buildQrCardsPdfDocDefinition(
    students,
    appConfig,
    photos,
  )
  pdfMake.createPdf(docDefinition).download(filename)
}
