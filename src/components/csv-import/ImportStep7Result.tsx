import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import type { ColumnDef } from '@tanstack/react-table'
import type { ImportRowResult } from '~/routes/_authenticated/_catechist/_admin/import'
import type { ValidatedRow } from './useImportParser'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import { DataTable } from '~/components/custom/data-table'

interface ImportStep7ResultProps {
  importResults: Array<ImportRowResult>
  validatedRows: Array<ValidatedRow>
  target: 'students' | 'catechists'
  onImportMore: () => void
  onDone: () => void
}

type ResultRow = {
  index: number
  status: 'success' | 'partial' | 'failed'
  fullName: string
  id?: string
  error?: string
}

export function ImportStep7Result({
  importResults,
  validatedRows,
  target,
  onImportMore,
  onDone,
}: ImportStep7ResultProps) {
  const { t } = useTranslation()

  const rowByIndex = React.useMemo(
    () => new Map(validatedRows.map((r) => [r.rowIndex, r])),
    [validatedRows],
  )

  const rows = React.useMemo<Array<ResultRow>>(
    () =>
      importResults.map((result) => {
        const originalRow = rowByIndex.get(result.index)
        const fullName = originalRow?.coerced.fullName ?? '—'
        if (result.status === 'error') {
          return {
            index: result.index,
            status: 'failed',
            fullName,
            error: result.error,
          }
        }
        return {
          index: result.index,
          status: originalRow?.status === 'partial' ? 'partial' : 'success',
          fullName,
          id: result.id,
        }
      }),
    [importResults, rowByIndex],
  )

  const counts = React.useMemo(
    () => ({
      success: rows.filter((r) => r.status === 'success').length,
      partial: rows.filter((r) => r.status === 'partial').length,
      failed: rows.filter((r) => r.status === 'failed').length,
    }),
    [rows],
  )

  const columns = React.useMemo<Array<ColumnDef<ResultRow>>>(
    () => [
      {
        id: 'index',
        header: '#',
        cell: ({ row }) => row.original.index + 1,
      },
      {
        id: 'status',
        header: t('csvImport.result.statusColumn', 'Status'),
        cell: ({ row }) => {
          const status = row.original.status
          const variant =
            status === 'success'
              ? 'secondary'
              : status === 'partial'
                ? 'outline'
                : 'destructive'
          const label =
            status === 'success'
              ? t('csvImport.result.successful', 'Successful')
              : status === 'partial'
                ? t('csvImport.result.partial', 'Partial')
                : t('csvImport.result.failed', 'Failed')
          return <Badge variant={variant}>{label}</Badge>
        },
      },
      {
        id: 'fullName',
        header: t('csvImport.fields.fullName', 'Full Name'),
        cell: ({ row }) => row.original.fullName,
      },
      {
        id: 'id',
        header: t('csvImport.result.idColumn', 'ID'),
        cell: ({ row }) =>
          row.original.status === 'failed' ? (
            <span className="text-xs text-destructive">
              {row.original.error}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              {row.original.id}
            </span>
          ),
      },
      {
        id: 'actions',
        header: t('csvImport.result.actionsColumn', 'Actions'),
        enableHiding: false,
        cell: ({ row }) => {
          if (row.original.status === 'failed' || !row.original.id) return null
          return target === 'students' ? (
            <Link
              to="/students/$id"
              params={{ id: row.original.id }}
              className="text-sm text-primary underline"
            >
              {t('csvImport.result.viewRecord', 'View')}
            </Link>
          ) : (
            <Link
              to="/catechists/$id"
              params={{ id: row.original.id }}
              className="text-sm text-primary underline"
            >
              {t('csvImport.result.viewRecord', 'View')}
            </Link>
          )
        },
      },
    ],
    [t, target],
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex flex-col items-center py-4">
            <div className="text-2xl font-semibold text-emerald-600">
              {counts.success}
            </div>
            <div className="text-sm text-muted-foreground">
              {t('csvImport.result.successful', 'Successful')}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center py-4">
            <div className="text-2xl font-semibold text-amber-600">
              {counts.partial}
            </div>
            <div className="text-sm text-muted-foreground">
              {t('csvImport.result.partial', 'Partial')}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center py-4">
            <div className="text-2xl font-semibold text-destructive">
              {counts.failed}
            </div>
            <div className="text-sm text-muted-foreground">
              {t('csvImport.result.failed', 'Failed')}
            </div>
          </CardContent>
        </Card>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        getRowId={(r) => String(r.index)}
        disableSearch
      />

      <div className="flex justify-between pt-4 border-t">
        <Button type="button" variant="outline" onClick={onImportMore}>
          {t('csvImport.result.importMore', 'Import More')}
        </Button>
        <Button type="button" onClick={onDone}>
          {t('csvImport.result.done', 'Done')}
        </Button>
      </div>
    </div>
  )
}
