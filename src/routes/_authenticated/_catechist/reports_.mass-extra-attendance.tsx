import * as React from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { Calendar as CalendarIcon, ClipboardList, Download } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'

import type { Id } from '~/../convex/_generated/dataModel'
import type { CellValue } from '~/lib/export/types'
import { api } from '~/../convex/_generated/api'
import { useAuth } from '~/lib/auth'
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover'

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
  return date.toISOString().slice(0, 10)
}

// ─── Main Component ──────────────────────────────────────────────────────────

interface AttendanceReportRecord {
  _id: string
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
  const { user } = useAuth()

  // Default to today's local date in YYYY-MM-DD format
  const [selectedDate, setSelectedDate] = React.useState(() => {
    return new Date().toLocaleDateString('sv-SE') // Returns YYYY-MM-DD reliably in local time
  })
  const [selectedType, setSelectedType] = React.useState<
    'mass' | 'extracurricular'
  >('mass')

  const requesterId =
    user?.accountType === 'catechist'
      ? (user.userDocId as Id<'catechists'>)
      : undefined

  // Query database
  const reportData = useQuery(
    api.parishAttendance.getParishAttendanceReport,
    requesterId
      ? {
          requesterId,
          sessionDate: selectedDate,
          sessionType: selectedType,
        }
      : 'skip',
  )

  // Calculations for stats summary cards
  const stats = React.useMemo(() => {
    const records = reportData?.records ?? []
    return {
      total: records.length,
      present: records.filter((r) => r.status === 'present').length,
      late: records.filter((r) => r.status === 'late').length,
      excused: records.filter((r) => r.status === 'excused_absence').length,
      unexcused: records.filter((r) => r.status === 'unexcused_absence').length,
    }
  }, [reportData?.records])

  // Table columns definition
  const columns = React.useMemo<Array<ColumnDef<AttendanceReportRecord>>>(
    () => [
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
      t('reports.massExtraAttendance.table.studentCode'),
      t('reports.massExtraAttendance.table.fullName'),
      t('reports.massExtraAttendance.table.className'),
      t('reports.massExtraAttendance.table.scanTime'),
      t('reports.massExtraAttendance.table.recordedBy'),
      t('reports.massExtraAttendance.table.status'),
    ]
  }, [t])

  const exportRows = React.useMemo<Array<Record<string, CellValue>>>(() => {
    const records = reportData?.records ?? []
    return records.map((r, i) => ({
      [exportHeaders[0]]: i + 1,
      [exportHeaders[1]]: r.studentCode,
      [exportHeaders[2]]: formatPersonName(r.saintName, r.fullName),
      [exportHeaders[3]]: r.className,
      [exportHeaders[4]]: formatDateTime(r.deviceQueuedAt),
      [exportHeaders[5]]: r.recordedByCatechistName,
      [exportHeaders[6]]: t(`attendance.status.${r.status}`),
    }))
  }, [reportData?.records, exportHeaders, t])

  const pdfMeta = React.useMemo<Record<string, string>>(() => {
    return {
      [t('reports.massExtraAttendance.filters.date')]: selectedDate,
      [t('reports.massExtraAttendance.filters.type')]: t(
        `reports.massExtraAttendance.types.${selectedType}`,
      ),
      [t('reports.massExtraAttendance.stats.totalScans')]:
        stats.total.toString(),
    }
  }, [selectedDate, selectedType, stats.total, t])

  const emptyText = React.useMemo(() => {
    if (!reportData) return undefined
    if (reportData.session === null) {
      return t('reports.massExtraAttendance.noSession')
    }
    if (reportData.records.length === 0) {
      return t('reports.massExtraAttendance.emptyRecords')
    }
    return undefined
  }, [reportData, t])

  return (
    <div className="flex-1 flex flex-col gap-6">
      <PageHeader
        title={t('reports.massExtraAttendance.title')}
        subtitle={t('reports.massExtraAttendance.description')}
        icon={ClipboardList}
        actions={
          <>
            {reportData && reportData.records.length > 0 && (
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
                        `${selectedType}-attendance-${selectedDate}.csv`,
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
                        `${selectedType}-attendance-${selectedDate}.pdf`,
                        exportHeaders,
                        ['auto', 'auto', '*', 'auto', 'auto', '*', 'auto'],
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
        {reportData === undefined ? (
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
            data={reportData.records}
            emptyText={emptyText}
            searchColumnKey="fullName"
            searchPlaceholder={t('common.search', 'Tìm kiếm học viên...')}
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
                          className="w-40 justify-start"
                        >
                          <CalendarIcon className="size-4" />
                          {formatDate(new Date(`${selectedDate}T00:00:00`))}
                        </Button>
                      }
                    />
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={new Date(`${selectedDate}T00:00:00`)}
                        onSelect={(date) =>
                          date && setSelectedDate(toISODate(date))
                        }
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
