import { useMemo } from 'react'
import Papa from 'papaparse'
import {
  GUARDIAN_CONTACT_FIELD_RE,
  coerceContactByType,
  validateContactByType,
} from './csvFieldDefinitions'
import type { ContactType, FieldDef } from './csvFieldDefinitions'

export type ImportConfig = {
  target: 'students' | 'catechists'
  delimiter: ',' | ';' | '\t' | '|'
  dateFormat: 'yyyy-MM-dd' | 'dd/MM/yyyy' | 'MM/dd/yyyy' | 'dd-MM-yyyy'
}

export type ParsedRow = Record<string, string>

export type RowIssue = {
  field: string
  messageKey: string
  blocking: boolean
}

export type ValidatedRow = {
  rowIndex: number
  status: 'ok' | 'partial' | 'error'
  coerced: Record<string, string | null>
  issues: Array<RowIssue>
  duplicateWarning?: string
}

function parseCsvLines(
  rawText: string,
  delimiter: string,
): Array<Array<string>> {
  const { data } = Papa.parse<Array<string>>(rawText, {
    delimiter,
    skipEmptyLines: true,
  })
  return data.map((row) => row.map((cell) => cell.trim()))
}

export function useImportParser(
  rawText: string,
  config: ImportConfig,
  columnMapping: Record<string, string | null>,
  fieldDefs: Array<FieldDef>,
  duplicateNames: Array<string>,
  contactTypeByField: Record<string, ContactType> = {},
): Array<ValidatedRow> {
  return useMemo(() => {
    if (!rawText) return []

    const rows = parseCsvLines(rawText, config.delimiter)
    if (rows.length < 2) return []

    const headers = rows[0]
    const dataRows = rows.slice(1)
    const fieldByKey = new Map(fieldDefs.map((f) => [f.key, f]))
    const duplicateNameSet = new Set(duplicateNames.map((n) => n.toLowerCase()))

    return dataRows.map((cells, rowIndex) => {
      const coerced: Record<string, string | null> = {}
      const issues: Array<RowIssue> = []

      headers.forEach((header, colIndex) => {
        const fieldKey = columnMapping[header]
        if (!fieldKey) return
        const fieldDef = fieldByKey.get(fieldKey)
        if (!fieldDef) return

        const raw = cells[colIndex] ?? ''
        const contactType = GUARDIAN_CONTACT_FIELD_RE.test(fieldKey)
          ? (contactTypeByField[fieldKey] ?? 'other')
          : undefined
        const coerce = contactType
          ? coerceContactByType(contactType)
          : fieldDef.coerce
        const validate = contactType
          ? validateContactByType(contactType)
          : fieldDef.validate
        const value = coerce(raw, config.dateFormat)
        coerced[fieldKey] = value

        const errorKey = validate(value, raw)
        if (errorKey) {
          issues.push({
            field: fieldKey,
            messageKey: errorKey,
            blocking: fieldDef.required,
          })
        }
      })

      const hasBlockingIssue = issues.some((issue) => issue.blocking)
      const hasPartialIssue = issues.some((issue) => !issue.blocking)
      const status: ValidatedRow['status'] = hasBlockingIssue
        ? 'error'
        : hasPartialIssue
          ? 'partial'
          : 'ok'

      const fullName = coerced.fullName
      const duplicateWarning =
        fullName && duplicateNameSet.has(fullName.toLowerCase())
          ? fullName
          : undefined

      return {
        rowIndex,
        status,
        coerced,
        issues,
        duplicateWarning,
      }
    })
  }, [
    rawText,
    config,
    columnMapping,
    fieldDefs,
    duplicateNames,
    contactTypeByField,
  ])
}
