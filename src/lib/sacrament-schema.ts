export interface SacramentFieldConfig {
  key: 'receivedDate' | 'receivedPlace' | 'feastName' | 'sponsorName' | 'notes'
  labelKey: string
  inputType?: 'date' | 'text'
  placeholderKey?: string
  defaultExportSelected?: boolean
}

export const sacramentFields: Array<SacramentFieldConfig> = [
  {
    key: 'receivedDate',
    labelKey: 'students.detail.sacraments.receivedDate',
    inputType: 'date',
    defaultExportSelected: true,
  },
  {
    key: 'receivedPlace',
    labelKey: 'students.detail.sacraments.receivedPlace',
    defaultExportSelected: true,
  },
  {
    key: 'feastName',
    labelKey: 'students.form.sacrament.feastName',
    placeholderKey: 'students.form.sacrament.feastName.placeholder',
    defaultExportSelected: true,
  },
  {
    key: 'sponsorName',
    labelKey: 'students.form.sacrament.sponsorName',
    placeholderKey: 'students.form.sacrament.sponsorName.placeholder',
    defaultExportSelected: true,
  },
  {
    key: 'notes',
    labelKey: 'students.form.sacrament.notes',
  },
]

export type SacramentFieldKey = SacramentFieldConfig['key']

export function getFieldForDisplay(fieldKey: SacramentFieldKey) {
  return sacramentFields.find((f) => f.key === fieldKey)
}

export function extractFieldsForMutation(
  formData: Record<string, string>,
  fieldKeys: Array<SacramentFieldKey>,
): Record<SacramentFieldKey, string | undefined> {
  const result: Record<string, string | undefined> = {}
  for (const key of fieldKeys) {
    result[key] = formData[key] || undefined
  }
  return result
}

export function buildExportRow(params: {
  studentName: string
  studentCode: number
  sacramentRecord: Record<string, unknown>
  editingChanges: Record<string, string>
  selectedFields: Set<SacramentFieldKey>
}): Record<SacramentFieldKey | 'studentName' | 'studentCode', string | number> {
  const {
    studentName,
    studentCode,
    sacramentRecord,
    editingChanges,
    selectedFields,
  } = params
  const record: Record<string, string | number> = {}

  record.studentName = studentName
  record.studentCode = studentCode

  for (const field of sacramentFields) {
    if (selectedFields.has(field.key)) {
      record[field.key] =
        editingChanges[field.key] ||
        (sacramentRecord[field.key] as string) ||
        ''
    }
  }

  return record
}
