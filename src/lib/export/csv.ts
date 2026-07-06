import { downloadBlob } from './blob'
import type { ExportRow } from './types'

const DEFAULT_CSV_HEADERS = [
  'STT',
  'Saint Name',
  'Full Name',
  'Gender',
  'Date of Birth',
]

export function buildCsvContent(
  rows: Array<ExportRow>,
  headers: Array<string> = DEFAULT_CSV_HEADERS,
): string {
  return [
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
}

export function buildCsvBlob(csvContent: string): Blob {
  const bom = new Uint8Array([0xef, 0xbb, 0xbf])
  const encoded = new TextEncoder().encode(csvContent)
  return new Blob([bom, encoded], { type: 'text/csv;charset=utf-8' })
}

export function exportCsv(
  rows: Array<ExportRow>,
  filename: string,
  headers: Array<string> = DEFAULT_CSV_HEADERS,
): void {
  const csvContent = buildCsvContent(rows, headers)
  const blob = buildCsvBlob(csvContent)
  downloadBlob(blob, filename)
}
