import * as React from 'react'
import { useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { api } from '../../../convex/_generated/api'
import { Field, FieldLabel } from '../ui/field'
import { CATECHIST_FIELDS, STUDENT_FIELDS } from './csvFieldDefinitions'
import { useImportParser } from './useImportParser'
import type { ColumnDef } from '@tanstack/react-table'
import type { Id } from '../../../convex/_generated/dataModel'
import type { ContactType } from './csvFieldDefinitions'
import type { ImportConfig, ValidatedRow } from './useImportParser'
import { DataTable } from '~/components/custom/data-table'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Checkbox } from '~/components/ui/checkbox'
import { Tabs, TabsList, TabsTrigger } from '~/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '~/components/ui/tooltip'

type FilterKey = 'all' | 'ok' | 'partial' | 'error' | 'duplicates'

interface ImportStep4PreviewProps {
  rawText: string
  config: ImportConfig
  columnMapping: Record<string, string | null>
  contactTypeByField: Record<string, ContactType>
  requesterId: Id<'catechists'>
  onValidatedRows: (rows: Array<ValidatedRow>) => void
  onNext: () => void
  onBack: () => void
}

export function ImportStep4Preview({
  rawText,
  config,
  columnMapping,
  contactTypeByField,
  requesterId,
  onValidatedRows,
  onNext,
  onBack,
}: ImportStep4PreviewProps) {
  const { t } = useTranslation()
  const fieldDefs =
    config.target === 'students' ? STUDENT_FIELDS : CATECHIST_FIELDS

  const fullNameHeader = React.useMemo(
    () => Object.entries(columnMapping).find(([, v]) => v === 'fullName')?.[0],
    [columnMapping],
  )

  const rawNames = React.useMemo(() => {
    if (!fullNameHeader) return []
    const lines = rawText.split(/\r\n|\r|\n/).filter((l) => l.trim() !== '')
    if (lines.length < 2) return []
    const headers = lines[0].split(config.delimiter).map((h) => h.trim())
    const idx = headers.indexOf(fullNameHeader)
    if (idx === -1) return []
    const names = lines
      .slice(1)
      .map((line) => line.split(config.delimiter)[idx]?.trim())
      .filter((n): n is string => !!n)
    return Array.from(new Set(names))
  }, [rawText, config.delimiter, fullNameHeader])

  const duplicatesResult = useQuery(
    api.csvImport.checkDuplicates,
    rawNames.length > 0
      ? { requesterId, target: config.target, names: rawNames }
      : 'skip',
  )

  const duplicateNames = React.useMemo(
    () => duplicatesResult?.map((d) => d.fullName) ?? [],
    [duplicatesResult],
  )

  const validatedRows = useImportParser(
    rawText,
    config,
    columnMapping,
    fieldDefs,
    duplicateNames,
    contactTypeByField,
  )

  const [selectedRowIndices, setSelectedRowIndices] = React.useState<
    Set<number>
  >(() => new Set())
  const [isSelectionInitialized, setIsSelectionInitialized] =
    React.useState(false)

  const duplicatesLoading =
    rawNames.length > 0 && duplicatesResult === undefined

  React.useEffect(() => {
    if (
      !duplicatesLoading &&
      validatedRows.length > 0 &&
      !isSelectionInitialized
    ) {
      const initialSelected = new Set<number>()
      validatedRows.forEach((row) => {
        if (!row.duplicateWarning) {
          initialSelected.add(row.rowIndex)
        }
      })
      setSelectedRowIndices(initialSelected)
      setIsSelectionInitialized(true)
    }
  }, [validatedRows, duplicatesLoading, isSelectionInitialized])

  const rowsWithSelection = React.useMemo(() => {
    return validatedRows.map((row) => ({
      ...row,
      selected: selectedRowIndices.has(row.rowIndex),
    }))
  }, [validatedRows, selectedRowIndices])

  React.useEffect(() => {
    if (isSelectionInitialized) {
      onValidatedRows(rowsWithSelection)
    }
  }, [rowsWithSelection, onValidatedRows, isSelectionInitialized])

  const [filter, setFilter] = React.useState<FilterKey>('all')

  const counts = React.useMemo(
    () => ({
      ok: validatedRows.filter((r) => r.status === 'ok').length,
      partial: validatedRows.filter((r) => r.status === 'partial').length,
      error: validatedRows.filter((r) => r.status === 'error').length,
      duplicates: validatedRows.filter((r) => !!r.duplicateWarning).length,
    }),
    [validatedRows],
  )

  const filteredRows = React.useMemo(() => {
    switch (filter) {
      case 'ok':
        return rowsWithSelection.filter((r) => r.status === 'ok')
      case 'partial':
        return rowsWithSelection.filter((r) => r.status === 'partial')
      case 'error':
        return rowsWithSelection.filter((r) => r.status === 'error')
      case 'duplicates':
        return rowsWithSelection.filter((r) => !!r.duplicateWarning)
      default:
        return rowsWithSelection
    }
  }, [filter, rowsWithSelection])

  const columns = React.useMemo<Array<ColumnDef<ValidatedRow>>>(
    () => [
      {
        id: 'select',
        header: '',
        cell: ({ row }) => (
          <Checkbox
            checked={selectedRowIndices.has(row.original.rowIndex)}
            onCheckedChange={(checked) => {
              const newSelected = new Set(selectedRowIndices)
              if (checked) {
                newSelected.add(row.original.rowIndex)
              } else {
                newSelected.delete(row.original.rowIndex)
              }
              setSelectedRowIndices(newSelected)
            }}
          />
        ),
      },
      {
        id: 'rowIndex',
        header: '#',
        cell: ({ row }) => row.original.rowIndex + 1,
      },
      {
        id: 'status',
        header: t('csvImport.preview.status.title', 'Status'),
        cell: ({ row }) => {
          const status = row.original.status
          const variant =
            status === 'ok'
              ? 'secondary'
              : status === 'partial'
                ? 'outline'
                : 'destructive'
          const label = t(
            `csvImport.preview.status.${status}`,
            status.toUpperCase(),
          )
          return <Badge variant={variant}>{label}</Badge>
        },
      },
      {
        id: 'duplicate',
        header: t('csvImport.preview.duplicateColumn', 'Duplicate'),
        cell: ({ row }) =>
          row.original.duplicateWarning ? (
            <Badge
              variant="outline"
              className="text-amber-600 border-amber-600"
            >
              {t('csvImport.preview.duplicateBadge', 'Possible duplicate')}
            </Badge>
          ) : null,
      },
      {
        id: 'fullName',
        header: t('csvImport.fields.fullName', 'Full Name'),
        cell: ({ row }) => row.original.coerced.fullName ?? '—',
      },
      {
        id: 'issues',
        header: t('csvImport.preview.issuesColumn', 'Issues'),
        cell: ({ row }) => {
          const issues = row.original.issues
          if (issues.length === 0) return null
          return (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Badge variant="destructive" className="cursor-help">
                    {issues.length}
                  </Badge>
                }
              />
              <TooltipContent>
                <ul className="flex flex-col gap-1">
                  {issues.map((issue, i) => (
                    <li key={i}>{t(issue.messageKey, issue.field)}</li>
                  ))}
                </ul>
              </TooltipContent>
            </Tooltip>
          )
        },
      },
    ],
    [t, selectedRowIndices],
  )

  const importableCount = counts.ok + counts.partial
  const hasSelection = selectedRowIndices.size > 0

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {t(
          'csvImport.preview.summary',
          '{{ok}} will import fully · {{partial}} partial · {{error}} skipped · {{dup}} possible duplicates',
          {
            ok: counts.ok,
            partial: counts.partial,
            error: counts.error,
            dup: counts.duplicates,
          },
        )}
      </p>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterKey)}>
        <TabsList>
          <TabsTrigger value="all">
            {t('csvImport.preview.filter.all', 'All')} ({validatedRows.length})
          </TabsTrigger>
          <TabsTrigger value="ok">
            {t('csvImport.preview.filter.ok', 'OK')} ({counts.ok})
          </TabsTrigger>
          <TabsTrigger value="partial">
            {t('csvImport.preview.filter.partial', 'Partial')} ({counts.partial}
            )
          </TabsTrigger>
          <TabsTrigger value="error">
            {t('csvImport.preview.filter.error', 'Error')} ({counts.error})
          </TabsTrigger>
          <TabsTrigger value="duplicates">
            {t('csvImport.preview.filter.duplicates', 'Duplicates')} (
            {counts.duplicates})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Field orientation={'horizontal'}>
        <Checkbox
          id="select-all-rows"
          checked={
            filteredRows.length > 0 &&
            filteredRows.every((r) => selectedRowIndices.has(r.rowIndex))
          }
          onCheckedChange={(checked) => {
            const newSelected = new Set(selectedRowIndices)
            filteredRows.forEach((r) => {
              if (checked) {
                newSelected.add(r.rowIndex)
              } else {
                newSelected.delete(r.rowIndex)
              }
            })
            setSelectedRowIndices(newSelected)
          }}
        />
        <FieldLabel htmlFor="select-all-rows">
          {t('csvImport.preview.selectAll', 'Select all visible rows')}
        </FieldLabel>
      </Field>

      <DataTable
        columns={columns}
        data={filteredRows}
        getRowId={(r) => String(r.rowIndex)}
        disableSearch
      />

      {importableCount === 0 && (
        <p className="text-sm text-destructive">
          {t(
            'csvImport.preview.noImportable',
            'No importable rows. Fix errors or remap columns before proceeding.',
          )}
        </p>
      )}

      <div className="flex justify-between pt-4 border-t">
        <Button type="button" variant="outline" onClick={onBack}>
          {t('common.back', 'Back')}
        </Button>
        <Button
          type="button"
          disabled={!hasSelection || importableCount === 0}
          onClick={onNext}
        >
          {t('csvImport.preview.proceed', 'Proceed to Review')}
        </Button>
      </div>
    </div>
  )
}
