import * as React from 'react'
import { Link, createFileRoute, useParams } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { CalendarCheck, Calendar as CalendarIcon, Download } from 'lucide-react'
import { api } from '../../../../convex/_generated/api'
import type { ColumnDef } from '@tanstack/react-table'
import type { FunctionReturnType } from 'convex/server'

import type { Id } from '../../../../convex/_generated/dataModel'
import type { CellValue } from '~/lib/export/types'
import { useAuth } from '~/lib/auth'
import { formatDateTime } from '~/lib/locale'
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
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '~/components/ui/input-group'
import { DataTable } from '~/components/custom/data-table'
import { PageHeader } from '~/components/page-header'

export const Route = createFileRoute(
  '/_authenticated/_catechist/students_/$id_/attendance',
)({
  component: StudentAttendanceReportPage,
  staticData: {
    crumbs: [
      { label: 'students.title', path: '/students' },
      { label: 'students.attendance.title' },
    ],
  },
})

type SessionTypeFilter = 'all' | 'mass' | 'extracurricular'

type StudentAttendanceRecord = FunctionReturnType<
  typeof api.attendance.getStudentAttendanceReport
>[number]

function StudentAttendanceReportPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { id } = useParams({ strict: false })
  const studentId = id as Id<'students'>

  const [typeFilter, setTypeFilter] = React.useState<SessionTypeFilter>('all')
  const [dateFrom, setDateFrom] = React.useState('')
  const [dateTo, setDateTo] = React.useState('')

  const requesterId =
    user?.accountType === 'catechist'
      ? (user.userDocId as Id<'catechists'>)
      : undefined

  const student = useQuery(
    api.students.getStudentDetail,
    requesterId ? { requesterId, studentId } : 'skip',
  )

  const records = useQuery(
    api.attendance.getStudentAttendanceReport,
    requesterId ? { requesterId, studentId } : 'skip',
  )

  const filteredRecords = React.useMemo(() => {
    if (!records) return []
    return records.filter((r) => {
      if (typeFilter !== 'all' && r.sessionType !== typeFilter) return false
      if (dateFrom && r.sessionDate < dateFrom) return false
      if (dateTo && r.sessionDate > dateTo) return false
      return true
    })
  }, [records, typeFilter, dateFrom, dateTo])

  const columns = React.useMemo<Array<ColumnDef<StudentAttendanceRecord>>>(
    () => [
      {
        accessorKey: 'deviceQueuedAt',
        header: t('students.attendance.table.time'),
        cell: ({ row }) => (
          <span>{formatDateTime(row.original.deviceQueuedAt)}</span>
        ),
      },
      {
        accessorKey: 'sessionType',
        header: t('students.attendance.table.type'),
        cell: ({ row }) => (
          <span>
            {t(`students.attendance.types.${row.original.sessionType}`)}
          </span>
        ),
      },
      {
        accessorKey: 'className',
        header: t('students.attendance.table.className'),
        cell: ({ row }) => {
          const { classId, className } = row.original
          if (!classId || !className) return <span>—</span>
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
        accessorKey: 'status',
        header: t('students.attendance.table.status'),
        cell: ({ row }) => (
          <span>{t(`attendance.status.${row.original.status}`)}</span>
        ),
      },
      {
        accessorKey: 'recordedByCatechistName',
        header: t('students.attendance.table.recordedBy'),
        cell: ({ row }) => {
          const { recordedByCatechistId, recordedByCatechistName } =
            row.original
          if (!recordedByCatechistId) {
            return <span>{recordedByCatechistName}</span>
          }
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
    ],
    [t],
  )

  const exportHeaders = React.useMemo<Array<string>>(() => {
    return [
      'STT',
      t('students.attendance.table.time'),
      t('students.attendance.table.type'),
      t('students.attendance.table.className'),
      t('students.attendance.table.status'),
      t('students.attendance.table.recordedBy'),
    ]
  }, [t])

  const exportRows = React.useMemo<Array<Record<string, CellValue>>>(() => {
    return filteredRecords.map((r, i) => ({
      [exportHeaders[0]]: i + 1,
      [exportHeaders[1]]: formatDateTime(r.deviceQueuedAt),
      [exportHeaders[2]]: t(`students.attendance.types.${r.sessionType}`),
      [exportHeaders[3]]: r.className ?? '—',
      [exportHeaders[4]]: t(`attendance.status.${r.status}`),
      [exportHeaders[5]]: r.recordedByCatechistName,
    }))
  }, [filteredRecords, exportHeaders, t])

  const studentName = student
    ? formatPersonName(student.saintName, student.fullName)
    : undefined

  const fileNamePrefix = studentName
    ? studentName.replace(/\s+/g, '-').toLowerCase()
    : 'student'

  const emptyText = React.useMemo(() => {
    if (!records) return undefined
    if (filteredRecords.length === 0) {
      return t('students.attendance.empty')
    }
    return undefined
  }, [records, filteredRecords, t])

  return (
    <div className="flex-1 flex flex-col gap-6">
      <PageHeader
        title={t('students.attendance.title')}
        subtitle={studentName}
        icon={CalendarCheck}
        actions={
          <>
            {filteredRecords.length > 0 && (
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
                        `${fileNamePrefix}-attendance.csv`,
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
                        t('students.attendance.title'),
                        studentName
                          ? { [t('students.col.fullName')]: studentName }
                          : {},
                        `${fileNamePrefix}-attendance.pdf`,
                        exportHeaders,
                        ['auto', 'auto', 'auto', '*', 'auto', '*'],
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

      <div className="bg-card border rounded-xl p-4">
        {records === undefined ? (
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
            data={filteredRecords}
            emptyText={emptyText}
            disableSearch
            filterExtra={
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                    {t('students.attendance.filters.dateFrom')}
                  </span>
                  <InputGroup>
                    <InputGroupAddon>
                      <CalendarIcon />
                    </InputGroupAddon>
                    <InputGroupInput
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </InputGroup>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                    {t('students.attendance.filters.dateTo')}
                  </span>
                  <InputGroup>
                    <InputGroupAddon>
                      <CalendarIcon />
                    </InputGroupAddon>
                    <InputGroupInput
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </InputGroup>
                </div>
                <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                  {t('students.attendance.filters.type')}
                </span>
                <Select
                  value={typeFilter}
                  onValueChange={(val) =>
                    setTypeFilter(val as SessionTypeFilter)
                  }
                  items={[
                    {
                      value: 'all',
                      label: t('students.attendance.filters.allTypes'),
                    },
                    {
                      value: 'mass',
                      label: t('students.attendance.types.mass'),
                    },
                    {
                      value: 'extracurricular',
                      label: t('students.attendance.types.extracurricular'),
                    },
                  ]}
                >
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {t('students.attendance.filters.allTypes')}
                    </SelectItem>
                    <SelectItem value="mass">
                      {t('students.attendance.types.mass')}
                    </SelectItem>
                    <SelectItem value="extracurricular">
                      {t('students.attendance.types.extracurricular')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            }
          />
        )}
      </div>
    </div>
  )
}
