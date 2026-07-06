import Papa from 'papaparse'
import { downloadBlob } from './blob'
import type { CellValue } from './types'

export function buildCsvContent(
  rows: Array<Record<string, CellValue>>,
  headers: Array<string>,
): string {
  return Papa.unparse({ fields: headers, data: rows })
}

export function buildCsvBlob(csvContent: string): Blob {
  const bom = new Uint8Array([0xef, 0xbb, 0xbf])
  const encoded = new TextEncoder().encode(csvContent)
  return new Blob([bom, encoded], { type: 'text/csv;charset=utf-8' })
}

export function exportCsv(
  rows: Array<Record<string, CellValue>>,
  filename: string,
  headers: Array<string>,
): void {
  const csvContent = buildCsvContent(rows, headers)
  const blob = buildCsvBlob(csvContent)
  downloadBlob(blob, filename)
}