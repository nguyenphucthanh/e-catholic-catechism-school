import { format } from 'date-fns'
import { formatPersonName } from '../name'
import { exportCsv } from './csv'
import type { FunctionReturnType } from 'convex/server'
import type { api } from '../../../convex/_generated/api'

export type IssuedCredential = FunctionReturnType<
  typeof api.accountAdmin.grantCatechistAccount
>['credential']

export type CredentialsCsvAction = 'cap-moi' | 'dat-lai' | 'nhap' | 'chuyen-doi'

// Fixed Vietnamese headers: the file is handed to staff, not localized UI.
export const CREDENTIALS_CSV_HEADERS = [
  'Họ tên',
  'Loại',
  'Lớp',
  'Tên đăng nhập',
  'Mật khẩu',
]

export function buildCredentialsCsvRows(credentials: Array<IssuedCredential>) {
  return credentials.map((c) => ({
    'Họ tên': formatPersonName(c.saintName, c.fullName),
    Loại: c.accountType === 'catechist' ? 'Giáo lý viên' : 'Học viên',
    Lớp: c.className ?? '',
    'Tên đăng nhập': c.loginId,
    'Mật khẩu': c.password,
  }))
}

export function credentialsCsvFilename(
  action: CredentialsCsvAction,
  now: Date = new Date(),
): string {
  return `tai-khoan-${action}-${format(now, 'yyyyMMdd-HHmm')}.csv`
}

export function exportCredentialsCsv(
  credentials: Array<IssuedCredential>,
  action: CredentialsCsvAction,
): void {
  exportCsv(
    buildCredentialsCsvRows(credentials),
    credentialsCsvFilename(action),
    CREDENTIALS_CSV_HEADERS,
  )
}
