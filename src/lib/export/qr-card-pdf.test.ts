import { describe, expect, it, vi } from 'vitest'
import pdfMake from 'pdfmake/build/pdfmake'
import { buildQrCardsPdfDocDefinition, exportQrCardsPdf } from './qr-card-pdf'
import type { Content } from 'pdfmake/interfaces'
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
