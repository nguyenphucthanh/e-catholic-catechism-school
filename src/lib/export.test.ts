import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import pdfMake from 'pdfmake/build/pdfmake'
import { exportCsv, exportPdf } from './export'
import type { CellValue } from './export'

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

const headers = ['STT', 'Saint Name', 'Full Name', 'Gender', 'Date of Birth']

const rows: Array<Record<string, CellValue>> = [
  {
    [headers[0]]: 1,
    [headers[1]]: 'Maria',
    [headers[2]]: 'Nguyễn Văn A',
    [headers[3]]: 'Nam',
    [headers[4]]: '01/01/2015',
  },
  {
    [headers[0]]: 2,
    [headers[1]]: 'Peter',
    [headers[2]]: 'Trần Thị B',
    [headers[3]]: 'Nữ',
    [headers[4]]: '02/02/2016',
  },
]

const title = 'Lớp Khai Tâm'
const meta: Record<string, string> = {
  Catechists: 'Thầy Nguyễn Văn C',
  'Total Students': '2',
}

describe('exportCsv', () => {
  let createObjectURLMock: ReturnType<typeof vi.fn>
  let revokeObjectURLMock: ReturnType<typeof vi.fn>
  let clickMock: ReturnType<typeof vi.fn>
  let appendChildSpy: ReturnType<typeof vi.spyOn>
  let removeChildSpy: ReturnType<typeof vi.spyOn>
  let createElementSpy: ReturnType<typeof vi.spyOn>
  let anchor: HTMLAnchorElement

  beforeEach(() => {
    createObjectURLMock = vi.fn().mockReturnValue('blob:mock-url')
    revokeObjectURLMock = vi.fn()
    URL.createObjectURL =
      createObjectURLMock as unknown as typeof URL.createObjectURL
    URL.revokeObjectURL =
      revokeObjectURLMock as unknown as typeof URL.revokeObjectURL

    anchor = document.createElement('a')
    clickMock = vi.fn()
    anchor.click = clickMock as unknown as typeof anchor.click

    createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation((tagName: string) => {
        if (tagName === 'a') return anchor
        return document.createElement.bind(document)(tagName)
      })
    appendChildSpy = vi
      .spyOn(document.body, 'appendChild')
      .mockImplementation((node) => node)
    removeChildSpy = vi
      .spyOn(document.body, 'removeChild')
      .mockImplementation((node) => node)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('produces the correct header row and cell formatting', async () => {
    exportCsv(rows, 'students.csv', headers)

    const blobArg = createObjectURLMock.mock.calls[0][0] as Blob
    const text = await blobArg.text()
    const content = text.replace(/^\uFEFF/, '')
    const lines = content.split(/\r?\n/)

    expect(lines[0]).toBe('STT,Saint Name,Full Name,Gender,Date of Birth')
    expect(lines[1]).toBe('1,Maria,Nguyễn Văn A,Nam,01/01/2015')
    expect(lines[2]).toBe('2,Peter,Trần Thị B,Nữ,02/02/2016')
    expect(lines).toHaveLength(3)
  })

  it('prefixes the CSV blob with a UTF-8 BOM', async () => {
    exportCsv(rows, 'students.csv', headers)

    const blobArg = createObjectURLMock.mock.calls[0][0] as Blob
    const buffer = await blobArg.arrayBuffer()
    const bytes = new Uint8Array(buffer)

    expect(bytes[0]).toBe(0xef)
    expect(bytes[1]).toBe(0xbb)
    expect(bytes[2]).toBe(0xbf)
  })

  it('creates the blob with a text/csv utf-8 mime type', () => {
    exportCsv(rows, 'students.csv', headers)

    const blobArg = createObjectURLMock.mock.calls[0][0] as Blob
    expect(blobArg.type).toBe('text/csv;charset=utf-8')
  })

  it('triggers a download with the given filename', () => {
    exportCsv(rows, 'students.csv', headers)

    expect(createElementSpy).toHaveBeenCalledWith('a')
    expect(anchor.download).toBe('students.csv')
    expect(anchor.href).toBe('blob:mock-url')
    expect(appendChildSpy).toHaveBeenCalledWith(anchor)
    expect(clickMock).toHaveBeenCalledTimes(1)
    expect(removeChildSpy).toHaveBeenCalledWith(anchor)
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-url')
  })

  it('handles an empty rows array by producing only the header row', async () => {
    exportCsv([], 'empty.csv', headers)

    const blobArg = createObjectURLMock.mock.calls[0][0] as Blob
    const text = (await blobArg.text()).replace(/^\uFEFF/, '')

    expect(text.replace(/\r?\n$/, '')).toBe(
      'STT,Saint Name,Full Name,Gender,Date of Birth',
    )
  })
})

describe('exportPdf', () => {
  const downloadMock = vi.fn()

  beforeEach(() => {
    downloadMock.mockReset()
    vi.mocked(pdfMake.createPdf).mockReset()
    vi.mocked(pdfMake.createPdf).mockReturnValue({
      download: downloadMock,
    } as unknown as ReturnType<typeof pdfMake.createPdf>)
  })

  it('builds a docDefinition with the correct title, meta text, and table rows', () => {
    exportPdf(rows, title, meta, 'class-report.pdf', headers)

    expect(pdfMake.createPdf).toHaveBeenCalledTimes(1)
    const docDefinition = vi.mocked(pdfMake.createPdf).mock.calls[0][0]

    expect(docDefinition.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: title,
          style: 'title',
          alignment: 'center',
        }),
        expect.objectContaining({
          text: 'Catechists: Thầy Nguyễn Văn C',
        }),
        expect.objectContaining({
          text: 'Total Students: 2',
        }),
      ]),
    )

    const tableContent = (docDefinition.content as Array<any>).find(
      (item) => item.table,
    )
    expect(tableContent.table.body).toEqual([
      ['STT', 'Saint Name', 'Full Name', 'Gender', 'Date of Birth'],
      ['1', 'Maria', 'Nguyễn Văn A', 'Nam', '01/01/2015'],
      ['2', 'Peter', 'Trần Thị B', 'Nữ', '02/02/2016'],
    ])
  })

  it('calls download with the given filename', () => {
    exportPdf(rows, title, meta, 'class-report.pdf', headers)

    expect(downloadMock).toHaveBeenCalledWith('class-report.pdf')
  })

  it('renders an empty table body (header only) when rows is empty', () => {
    exportPdf([], title, meta, 'empty.pdf', headers)

    const docDefinition = vi.mocked(pdfMake.createPdf).mock.calls[0][0]
    const tableContent = (docDefinition.content as Array<any>).find(
      (item) => item.table,
    )
    expect(tableContent.table.body).toEqual([
      ['STT', 'Saint Name', 'Full Name', 'Gender', 'Date of Birth'],
    ])
  })
})
