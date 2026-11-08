import * as React from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import {
  AlertCircle,
  Calendar as CalendarIcon,
  ClipboardList,
  Download,
} from 'lucide-react'
import type { DateRange } from 'react-day-picker'
import type { CellValue } from '~/lib/export/types'
import type { TableColumnDef } from '~/components/custom/data-table'
import { api } from '~/../convex/_generated/api'
import { formatDate, formatDateTime } from '~/lib/locale'
import { formatPersonName } from '~/lib/name'
import { exportCsv, exportPdf } from '~/lib/export'

import { Button } from '~/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { DataTable } from '~/components/custom/data-table'
import { PageHeader } from '~/components/page-header'
import { Calendar } from '~/components/ui/calendar'
import { Alert, AlertDescription } from '~/components/ui/alert'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover'

const MAX_RANGE_DAYS = 31 // keep in sync with convex/parishAttendance.ts

// ─── Route Definition ────────────────────────────────────────────────────────

export const Route = createFileRoute(
  '/_authenticated/_catechist/reports_/mass-extra-attendance',
)({
  component: MassExtraAttendanceReportPage,
  staticData: {
    crumbs: [
      { label: 'nav.reports' },
      { label: 'reports.massExtraAttendance.title' },
    ],
  },
})

function toISODate(date: Date): string {
  // Local date, not UTC: toISOString() shifts local midnight back a day in UTC+ zones
  return date.toLocaleDateString('sv-SE')
}

// ─── Main Component ──────────────────────────────────────────────────────────

interface AttendanceReportRecord {
  _id: string
  sessionDate: string
  status: string
  notes: string | null
  deviceQueuedAt: number
  syncedAt: number | null
  studentId: string
  studentCode: string
  fullName: string
  saintName: string | null
  classId: string
  className: string
  recordedByCatechistId: string | null
  recordedByCatechistName: string
}

function MassExtraAttendanceReportPage() {
  const { t } = useTranslation()

  // Default: last 31 days (today inclusive)
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(
    () => {
      const to = new Date()
      const from = new Date(to)
      from.setDate(to.getDate() - (MAX_RANGE_DAYS - 1))
      return { from, to }
    },
  )
  const [selectedType, setSelectedType] = React.useState<
    'mass' | 'extracurricular'
  >('mass')

  const dateFrom = dateRange?.from ? toISODate(dateRange.from) : ''
  const dateTo = dateRange?.to ? toISODate(dateRange.to) : ''
  const rangeDays =
    dateRange?.from && dateRange.to
      ? Math.round((Date.parse(dateTo) - Date.parse(dateFrom)) / 86_400_000) + 1
      : 0
  const rangeTooWide = rangeDays > MAX_RANGE_DAYS
  const canFetch = rangeDays >= 1 && !rangeTooWide

  // Query database (skipped until both dates are set and range is <= 31 days)
  const reportData = useQuery(
    api.parishAttendance.getParishAttendanceReport,
    canFetch ? { dateFrom, dateTo, sessionType: selectedType } : 'skip',
  )
  const records = React.useMemo(
    () => (canFetch ? (reportData?.records ?? []) : []),
    [canFetch, reportData?.records],
  )

  // Calculations for stats summary cards
  const stats = React.useMemo(() => {
    return {
      total: records.length,
      present: records.filter((r) => r.status === 'present').length,
      late: records.filter((r) => r.status === 'late').length,
      excused: records.filter((r) => r.status === 'excused_absence').length,
      unexcused: records.filter((r) => r.status === 'unexcused_absence').length,
    }
  }, [records])

  // Table columns definition
  const columns = React.useMemo<Array<TableColumnDef<AttendanceReportRecord>>>(
    () => [
      {
        accessorKey: 'sessionDate',
        header: t('reports.massExtraAttendance.table.sessionDate'),
        cell: ({ row }) => (
          <span>
            {formatDate(new Date(`${row.original.sessionDate}T00:00:00`))}
          </span>
        ),
      },
      {
        accessorKey: 'studentCode',
        header: t('reports.massExtraAttendance.table.studentCode'),
      },
      {
        id: 'fullName',
        accessorFn: (row) => formatPersonName(row.saintName, row.fullName),
        header: t('reports.massExtraAttendance.table.fullName'),
        cell: ({ row }) => {
          const { studentId, saintName, fullName } = row.original
          return (
            <Link
              // @ts-ignore - Route not yet generated
              to={'/students/$id'}
              // @ts-ignore - Route not yet generated
              params={{ id: studentId }}
              className="text-primary hover:underline font-medium"
            >
              {formatPersonName(saintName, fullName)}
            </Link>
          )
        },
      },
      {
        accessorKey: 'className',
        header: t('reports.massExtraAttendance.table.className'),
        cell: ({ row }) => {
          const { classId, className } = row.original
          return (
            <Link
              to={'/classes/$id'}
              params={{ id: classId }}
              className="text-primary hover:underline font-medium"
            >
              {className}
            </Link>
          )
        },
      },
      {
        accessorKey: 'deviceQueuedAt',
        header: t('reports.massExtraAttendance.table.scanTime'),
        cell: ({ row }) => {
          return <span>{formatDateTime(row.original.deviceQueuedAt)}</span>
        },
      },
      {
        accessorKey: 'syncedAt',
        header: t('reports.massExtraAttendance.table.syncTime'),
        cell: ({ row }) => {
          const syncedAt = row.original.syncedAt
          return <span>{syncedAt ? formatDateTime(syncedAt) : '—'}</span>
        },
      },
      {
        accessorKey: 'recordedByCatechistName',
        header: t('reports.massExtraAttendance.table.recordedBy'),
        cell: ({ row }) => {
          const { recordedByCatechistId, recordedByCatechistName } =
            row.original
          if (!recordedByCatechistId)
            return <span>{recordedByCatechistName}</span>
          return (
            <Link
              to={'/catechists/$id'}
              params={{ id: recordedByCatechistId }}
              className="text-primary hover:underline font-medium"
            >
              {recordedByCatechistName}
            </Link>
          )
        },
      },
      {
        accessorKey: 'status',
        header: t('reports.massExtraAttendance.table.status'),
        cell: ({ row }) => {
          return <span>{t(`attendance.status.${row.original.status}`)}</span>
        },
      },
    ],
    [t],
  )

  // Export handling
  const exportHeaders = React.useMemo<Array<string>>(() => {
    return [
      'STT',
      t('reports.massExtraAttendance.table.sessionDate'),
      t('reports.massExtraAttendance.table.studentCode'),
      t('reports.massExtraAttendance.table.fullName'),
      t('reports.massExtraAttendance.table.className'),
      t('reports.massExtraAttendance.table.scanTime'),
      t('reports.massExtraAttendance.table.recordedBy'),
      t('reports.massExtraAttendance.table.status'),
    ]
  }, [t])

  const exportRows = React.useMemo<Array<Record<string, CellValue>>>(() => {
    return records.map((r, i) => ({
      [exportHeaders[0]]: i + 1,
      [exportHeaders[1]]: r.sessionDate,
      [exportHeaders[2]]: r.studentCode,
      [exportHeaders[3]]: formatPersonName(r.saintName, r.fullName),
      [exportHeaders[4]]: r.className,
      [exportHeaders[5]]: formatDateTime(r.deviceQueuedAt),
      [exportHeaders[6]]: r.recordedByCatechistName,
      [exportHeaders[7]]: t(`attendance.status.${r.status}`),
    }))
  }, [records, exportHeaders, t])

  const pdfMeta = React.useMemo<Record<string, string>>(() => {
    return {
      [t('reports.massExtraAttendance.filters.date')]:
        `${dateFrom} - ${dateTo}`,
      [t('reports.massExtraAttendance.filters.type')]: t(
        `reports.massExtraAttendance.types.${selectedType}`,
      ),
      [t('reports.massExtraAttendance.stats.totalScans')]:
        stats.total.toString(),
    }
  }, [dateFrom, dateTo, selectedType, stats.total, t])

  const emptyText = React.useMemo(() => {
    if (!canFetch || !reportData) return undefined
    if (reportData.sessionCount === 0) {
      return t('reports.massExtraAttendance.noSession')
    }
    if (reportData.records.length === 0) {
      return t('reports.massExtraAttendance.emptyRecords')
    }
    return undefined
  }, [canFetch, reportData, t])

  return (
    <div className="flex-1 flex flex-col gap-6">
      <PageHeader
        title={t('reports.massExtraAttendance.title')}
        subtitle={t('reports.massExtraAttendance.description')}
        icon={ClipboardList}
        actions={
          <>
            {records.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="outline">
                      <Download className="size-4" />
                      {t('classes.export.title', 'Xuất báo cáo')}
                    </Button>
                  }
                />
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() =>
                      exportCsv(
                        exportRows,
                        `${selectedType}-attendance-${dateFrom}_${dateTo}.csv`,
                        exportHeaders,
                      )
                    }
                  >
                    {t('classes.export.csv', 'Xuất CSV')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      exportPdf(
                        exportRows,
                        t('reports.massExtraAttendance.title'),
                        pdfMeta,
                        `${selectedType}-attendance-${dateFrom}_${dateTo}.pdf`,
                        exportHeaders,
                        [
                          'auto',
                          'auto',
                          'auto',
                          '*',
                          'auto',
                          'auto',
                          '*',
                          'auto',
                        ],
                      )
                    }
                  >
                    {t('classes.export.pdf', 'Xuất PDF')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        }
      />

      {/* ─── DataTable Card ─── */}
      <div className="bg-card border rounded-xl p-4">
        {rangeTooWide && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle />
            <AlertDescription>
              {t('reports.massExtraAttendance.rangeTooWide', {
                max: MAX_RANGE_DAYS,
              })}
            </AlertDescription>
          </Alert>
        )}
        {canFetch && reportData === undefined ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-10 bg-slate-850 animate-pulse rounded-lg"
              />
            ))}
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={records}
            emptyText={emptyText}
            searchColumnKey="fullName"
            searchPlaceholder={t('common.search', 'Tìm kiếm Học sinh...')}
            filterExtra={
              <>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                    {t('reports.massExtraAttendance.filters.date')}
                  </span>
                  <Popover>
                    <PopoverTrigger
                      render={
                        <Button
                          variant="outline"
                          className="w-auto justify-start"
                        >
                          <CalendarIcon className="size-4" />
                          {dateRange?.from
                            ? dateRange.to
                              ? `${formatDate(dateRange.from)} - ${formatDate(dateRange.to)}`
                              : formatDate(dateRange.from)
                            : t('reports.massExtraAttendance.filters.date')}
                        </Button>
                      }
                    />
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="range"
                        selected={dateRange}
                        onSelect={setDateRange}
                        numberOfMonths={2}
                        resetOnSelect
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                    {t('reports.massExtraAttendance.filters.type')}
                  </span>
                  <Select
                    value={selectedType}
                    onValueChange={(val) => setSelectedType(val as any)}
                    items={[
                      {
                        value: 'mass',
                        label: t('reports.massExtraAttendance.types.mass'),
                      },
                      {
                        value: 'extracurricular',
                        label: t(
                          'reports.massExtraAttendance.types.extracurricular',
                        ),
                      },
                    ]}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mass">
                        {t('reports.massExtraAttendance.types.mass')}
                      </SelectItem>
                      <SelectItem value="extracurricular">
                        {t('reports.massExtraAttendance.types.extracurricular')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            }
          />
        )}
      </div>
    </div>
  )
}
