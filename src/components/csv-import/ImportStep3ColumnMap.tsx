import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { CATECHIST_FIELDS, STUDENT_FIELDS } from './csvFieldDefinitions'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'

const SKIP_VALUE = '__skip__'

interface ImportStep3ColumnMapProps {
  csvHeaders: Array<string>
  target: 'students' | 'catechists'
  columnMapping: Record<string, string | null>
  onMappingChange: (mapping: Record<string, string | null>) => void
  onNext: () => void
  onBack: () => void
}

export function ImportStep3ColumnMap({
  csvHeaders,
  target,
  columnMapping,
  onMappingChange,
  onNext,
  onBack,
}: ImportStep3ColumnMapProps) {
  const { t } = useTranslation()
  const fieldDefs = target === 'students' ? STUDENT_FIELDS : CATECHIST_FIELDS

  const selectItems = React.useMemo(
    () => [
      {
        value: SKIP_VALUE,
        label: t('csvImport.columnMap.skip', '— Skip (do not import) —'),
      },
      ...fieldDefs.map((f) => ({
        value: f.key,
        label: t(f.labelKey, f.key),
      })),
    ],
    [fieldDefs, t],
  )

  const setMapping = (header: string, fieldKey: string) => {
    onMappingChange({
      ...columnMapping,
      [header]: fieldKey === SKIP_VALUE ? null : fieldKey,
    })
  }

  const mappedFieldCounts = React.useMemo(() => {
    const counts: Record<string, number> = {}
    csvHeaders.forEach((h) => {
      const val = columnMapping[h]
      if (val) counts[val] = (counts[val] ?? 0) + 1
    })
    return counts
  }, [columnMapping, csvHeaders])

  const fullNameMapped = Object.values(columnMapping).includes('fullName')
  const hasDuplicateMapping = Object.values(mappedFieldCounts).some(
    (c) => c > 1,
  )
  const canProceed = fullNameMapped && !hasDuplicateMapping

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                {t('csvImport.columnMap.csvColumn', 'CSV Column')}
              </TableHead>
              <TableHead>
                {t('csvImport.columnMap.mapsTo', 'Maps to')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {csvHeaders.map((header) => {
              const mappedValue = columnMapping[header] ?? SKIP_VALUE
              const fieldDef = fieldDefs.find((f) => f.key === mappedValue)
              const isDuplicate = fieldDef
                ? (mappedFieldCounts[fieldDef.key] ?? 0) > 1
                : false
              return (
                <TableRow key={header}>
                  <TableCell>
                    <Badge variant="outline">{header}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Select
                          value={mappedValue}
                          onValueChange={(val) => setMapping(header, val ?? '')}
                          items={selectItems}
                        >
                          <SelectTrigger className="w-full max-w-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {selectItems.map((item) => (
                              <SelectItem key={item.value} value={item.value}>
                                {item.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {fieldDef?.required && (
                          <Badge variant="secondary">
                            {t('csvImport.columnMap.required', 'Required')}
                          </Badge>
                        )}
                        {fieldDef?.group === 'guardian' && (
                          <Badge variant="outline">
                            {t('csvImport.columnMap.guardian', 'Guardian')}
                          </Badge>
                        )}
                        {fieldDef?.group === 'contact' && (
                          <Badge variant="outline">
                            {t('csvImport.columnMap.contact', 'Contact')}
                          </Badge>
                        )}
                      </div>
                      {isDuplicate && (
                        <p className="text-xs text-destructive">
                          {t(
                            'csvImport.columnMap.duplicateError',
                            '"{{field}}" is already mapped from another column',
                            { field: t(fieldDef!.labelKey, fieldDef!.key) },
                          )}
                        </p>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {!fullNameMapped && (
        <p className="text-sm text-destructive">
          {t(
            'csvImport.columnMap.requiredWarning',
            'Required field "fullName" must be mapped to proceed',
          )}
        </p>
      )}

      <div className="flex justify-between pt-4 border-t">
        <Button type="button" variant="outline" onClick={onBack}>
          {t('common.back', 'Back')}
        </Button>
        <Button type="button" disabled={!canProceed} onClick={onNext}>
          {t('common.next', 'Next')}
        </Button>
      </div>
    </div>
  )
}
