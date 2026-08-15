import type { Doc, Id } from '../../convex/_generated/dataModel'
import type { SacramentFieldKey } from '~/lib/sacrament-fields'
import { formatPersonName } from '~/lib/name'
import { sacramentFields } from '~/lib/sacrament-fields'

export function buildSacramentExportRows(params: {
  students: Array<{
    student: Doc<'students'>
    sacramentDates: Record<string, string | undefined>
  }>
  sacramentByStudent: Map<
    Id<'students'>,
    Record<string, Record<string, unknown>>
  >
  editingState: Map<Id<'students'>, Record<string, string>>
  sacramentType: string
  selectedFields: Set<SacramentFieldKey>
  t: (key: string) => string
}): { headers: Array<string>; rows: Array<Record<string, string | number>> } {
  const {
    students,
    sacramentByStudent,
    editingState,
    sacramentType,
    selectedFields,
    t,
  } = params

  const fieldConfigs = [
    { key: 'studentName', label: t('students.col.studentName') },
    { key: 'studentCode', label: t('students.col.studentCode') },
    ...sacramentFields.map((field) => ({
      key: field.key,
      label: t(field.labelKey),
    })),
  ]

  const headers: Array<string> = []
  fieldConfigs.forEach(({ key, label }) => {
    if (
      key === 'studentName' ||
      key === 'studentCode' ||
      selectedFields.has(key as SacramentFieldKey)
    ) {
      headers.push(label)
    }
  })

  const rows = students.map(({ student }) => {
    const sacrament = sacramentByStudent.get(student._id)?.[sacramentType] || {}
    const changes = editingState.get(student._id) || {}
    const record: Record<string, string | number> = {}

    fieldConfigs.forEach(({ key, label }) => {
      if (
        key === 'studentName' ||
        key === 'studentCode' ||
        selectedFields.has(key as SacramentFieldKey)
      ) {
        if (key === 'studentName') {
          record[label] = formatPersonName(student.saintName, student.fullName)
        } else if (key === 'studentCode') {
          record[label] = student.studentCode
        } else {
          record[label] = changes[key] || (sacrament[key] as string) || ''
        }
      }
    })

    return record
  })

  return { headers, rows }
}
