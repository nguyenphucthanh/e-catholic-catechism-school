import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CREDENTIALS_CSV_HEADERS,
  buildCredentialsCsvRows,
  credentialsCsvFilename,
  exportCredentialsCsv,
} from './credentials-csv'
import { downloadBlob } from './blob'
import type { IssuedCredential } from './credentials-csv'

vi.mock('./blob', () => ({ downloadBlob: vi.fn() }))

const student = {
  loginId: '12',
  password: 'pw-s',
  fullName: 'Nguyễn Văn A',
  saintName: 'Phêrô',
  accountType: 'student',
  className: 'Lớp 1A',
} as unknown as IssuedCredential
const catechist = {
  loginId: '7',
  password: 'pw-c',
  fullName: 'Trần B',
  accountType: 'catechist',
} as unknown as IssuedCredential

const readBytes = (blob: Blob) =>
  new Promise<Uint8Array>((resolve) => {
    const r = new FileReader()
    r.onload = () => resolve(new Uint8Array(r.result as ArrayBuffer))
    r.readAsArrayBuffer(blob)
  })

afterEach(() => vi.clearAllMocks())

describe('buildCredentialsCsvRows', () => {
  it('maps credentials to Vietnamese-keyed rows with labels', () => {
    expect(buildCredentialsCsvRows([student, catechist])).toEqual([
      {
        'Họ tên': 'Phêrô Nguyễn Văn A',
        Loại: 'Học viên',
        Lớp: 'Lớp 1A',
        'Tên đăng nhập': '12',
        'Mật khẩu': 'pw-s',
      },
      {
        'Họ tên': 'Trần B',
        Loại: 'Giáo lý viên',
        Lớp: '',
        'Tên đăng nhập': '7',
        'Mật khẩu': 'pw-c',
      },
    ])
  })

  it('returns no rows for no credentials', () => {
    expect(buildCredentialsCsvRows([])).toEqual([])
  })

  it('keeps headers in the documented column order', () => {
    expect(CREDENTIALS_CSV_HEADERS).toEqual([
      'Họ tên',
      'Loại',
      'Lớp',
      'Tên đăng nhập',
      'Mật khẩu',
    ])
  })
})

describe('credentialsCsvFilename', () => {
  it('formats action and local timestamp', () => {
    expect(credentialsCsvFilename('cap-moi', new Date(2026, 0, 5, 9, 7))).toBe(
      'tai-khoan-cap-moi-20260105-0907.csv',
    )
  })

  it('defaults to the current time', () => {
    expect(credentialsCsvFilename('nhap')).toMatch(
      /^tai-khoan-nhap-\d{8}-\d{4}\.csv$/,
    )
  })
})

describe('exportCredentialsCsv', () => {
  it('downloads a UTF-8 BOM csv with headers and rows', async () => {
    exportCredentialsCsv([student], 'dat-lai')
    expect(downloadBlob).toHaveBeenCalledTimes(1)
    const [blob, filename] = vi.mocked(downloadBlob).mock.calls[0]
    expect(filename).toMatch(/^tai-khoan-dat-lai-\d{8}-\d{4}\.csv$/)
    const bytes = await readBytes(blob)
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf])
    const text = new TextDecoder().decode(bytes.slice(3))
    expect(text).toBe(
      'Họ tên,Loại,Lớp,Tên đăng nhập,Mật khẩu\r\nPhêrô Nguyễn Văn A,Học viên,Lớp 1A,12,pw-s',
    )
  })
})
