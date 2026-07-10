import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from 'convex/react'
import Papa from 'papaparse'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import type { ImportConfig } from './useImportParser'
import { useInactiveYear, useSelectedAcademicYear } from '~/lib/academic-year'
import { useAuth } from '~/lib/auth'
import { Button } from '~/components/ui/button'
import { Field, FieldLabel } from '~/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'

interface ImportStep2ConfigProps {
  config: ImportConfig
  rawText: string
  onConfigChange: (config: ImportConfig) => void
  onHeadersParsed: (headers: Array<string>) => void
  onNext: () => void
  onBack: () => void
}

export function ImportStep2Config({
  config,
  rawText,
  onConfigChange,
  onHeadersParsed,
  onNext,
  onBack,
}: ImportStep2ConfigProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const requesterId = user?.userDocId as Id<'catechists'> | undefined
  const { selectedYearId } = useSelectedAcademicYear()
  const { isInactive } = useInactiveYear()

  const classes = useQuery(
    api.classes.listClassYears,
    requesterId && selectedYearId && !isInactive
      ? { requesterId, academicYearId: selectedYearId }
      : 'skip',
  )

  const classItems = React.useMemo(() => {
    const items = [
      {
        value: '__none__',
        label: t('csvImport.config.noClass', '— Do not enroll —'),
      },
    ]
    if (classes) {
      classes.forEach((c) => {
        items.push({
          value: c.classYearId,
          label: c.className,
        })
      })
    }
    return items
  }, [classes, t])

  const targetItems: Array<{ value: ImportConfig['target']; label: string }> = [
    {
      value: 'students',
      label: t('csvImport.config.targetStudents', 'Students (Học Sinh)'),
    },
    {
      value: 'catechists',
      label: t(
        'csvImport.config.targetCatechists',
        'Catechists (Giáo Lý Viên)',
      ),
    },
  ]

  const delimiterItems: Array<{
    value: ImportConfig['delimiter']
    label: string
  }> = [
    { value: ',', label: t('csvImport.config.delimiterComma', 'Comma (,)') },
    {
      value: ';',
      label: t('csvImport.config.delimiterSemicolon', 'Semicolon (;)'),
    },
    { value: '\t', label: t('csvImport.config.delimiterTab', 'Tab') },
    { value: '|', label: t('csvImport.config.delimiterPipe', 'Pipe (|)') },
  ]

  const dateFormatItems: Array<{
    value: ImportConfig['dateFormat']
    label: string
  }> = [
    { value: 'yyyy-MM-dd', label: 'YYYY-MM-DD' },
    { value: 'dd/MM/yyyy', label: 'DD/MM/YYYY' },
    { value: 'MM/dd/yyyy', label: 'MM/DD/YYYY' },
    { value: 'dd-MM-yyyy', label: 'DD-MM-YYYY' },
  ]

  const handleNext = () => {
    const { data } = Papa.parse<Array<string>>(rawText, {
      delimiter: config.delimiter,
      skipEmptyLines: true,
    })
    const headers = (data[0] ?? ['']).map((h) => h.trim())
    onHeadersParsed(headers)
    onNext()
  }

  return (
    <div className="flex flex-col gap-6">
      <Field>
        <FieldLabel>{t('csvImport.config.target', 'Import into')}</FieldLabel>
        <Select
          value={config.target}
          onValueChange={(val) =>
            onConfigChange({
              ...config,
              target: val as ImportConfig['target'],
            })
          }
          items={targetItems}
        >
          <SelectTrigger className="w-full max-w-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {targetItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field>
        <FieldLabel>{t('csvImport.config.delimiter', 'Delimiter')}</FieldLabel>
        <Select
          value={config.delimiter}
          onValueChange={(val) =>
            onConfigChange({
              ...config,
              delimiter: val as ImportConfig['delimiter'],
            })
          }
          items={delimiterItems}
        >
          <SelectTrigger className="w-full max-w-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {delimiterItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field>
        <FieldLabel>
          {t('csvImport.config.dateFormat', 'Date Format')}
        </FieldLabel>
        <Select
          value={config.dateFormat}
          onValueChange={(val) =>
            onConfigChange({
              ...config,
              dateFormat: val as ImportConfig['dateFormat'],
            })
          }
          items={dateFormatItems}
        >
          <SelectTrigger className="w-full max-w-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {dateFormatItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {config.target === 'students' && (
        <Field>
          <FieldLabel>
            {t('csvImport.config.enrollClass', 'Enroll into Class (optional)')}
          </FieldLabel>
          <Select
            value={config.classYearId ?? '__none__'}
            onValueChange={(val) =>
              onConfigChange({
                ...config,
                classYearId: val === '__none__' || !val ? undefined : val,
              })
            }
            items={classItems}
            disabled={!classes || isInactive}
          >
            <SelectTrigger className="w-full max-w-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {classItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isInactive && (
            <p className="mt-1.5 text-sm text-destructive">
              {t(
                'csvImport.config.inactiveYearWarning',
                'Cannot enroll because the selected academic year is inactive. Please select an active year.',
              )}
            </p>
          )}
        </Field>
      )}

      <div className="flex justify-between pt-4 border-t">
        <Button type="button" variant="outline" onClick={onBack}>
          {t('common.back', 'Back')}
        </Button>
        <Button type="button" onClick={handleNext}>
          {t('common.next', 'Next')}
        </Button>
      </div>
    </div>
  )
}
