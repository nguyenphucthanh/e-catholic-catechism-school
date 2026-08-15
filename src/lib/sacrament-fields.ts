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
