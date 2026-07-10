import * as React from 'react'
import { useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { Download } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import type { CellValue } from '~/lib/export'
import { exportCsv } from '~/lib/export'
import { formatPersonName } from '~/lib/name'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Skeleton } from '~/components/ui/skeleton'
import { DataTable } from '~/components/custom/data-table'

interface AttendanceSummaryReportProps {
  classId: Id<'classes'>
  academicYearId: Id<'academicYears'>
  requesterId: Id<'catechists'>
}

type AttendanceStatusValue =
  'present' | 'late' | 'excused_absence' | 'unexcused_absence'

interface StudentSummary {
  studentClassId: Id<'studentClasses'>
  fullName: string
  saintName: string | null
  studentCode: string
  present: number
  late: number
  excused: number
  unexcused: number
  unset: number
  rate: number | null
}

const ALL_SEMESTERS = 'all'

function rateBadgeClassName(rate: number): string {
  if (rate >= 90) {
    return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
  }
  if (rate >= 80) {
    return 'bg-amber-500/10 text-amber-500 border-amber-500/20'
  }
  return 'bg-destructive/10 text-destructive border-destructive/20'
}

function compareByName(
  a: { fullName: string; saintName: string | null },
  b: { fullName: string; saintName: string | null },
  nameFormat: string,
): number {
  const nameA = formatPersonName(a.saintName, a.fullName)
  const nameB = formatPersonName(b.saintName, b.fullName)

  if (nameFormat === 'firstName_lastName') {
    return nameA.toLocaleLowerCase().localeCompare(nameB.toLocaleLowerCase())
  }
  const lastNameA = nameA.split(' ').pop() || ''
  const lastNameB = nameB.split(' ').pop() || ''
  return lastNameA
    .toLocaleLowerCase()
    .localeCompare(lastNameB.toLocaleLowerCase())
}

export function AttendanceSummaryReport({
  classId,
  academicYearId,
  requesterId,
}: AttendanceSummaryReportProps) {
  const { t } = useTranslation()
  const [selectedSemester, setSelectedSemester] =
    React.useState<string>(ALL_SEMESTERS)
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'fullName', desc: false },
  ])
  const appConfig = useQuery(api.appConfig.get)
  const nameFormat = appConfig?.nameFormat ?? 'firstName_lastName'

  React.useEffect(() => {
    setSelectedSemester(ALL_SEMESTERS)
  }, [classId, academicYearId])

  const gridData = useQuery(api.attendance.getAttendanceGrid, {
    classId,
    academicYearId,
    requesterId,
  })
  const semesters = useQuery(api.academicYears.listSemesters, {
    requesterId,
    academicYearId,
  })

  const semesterOptions = React.useMemo(
    () =>
      (semesters ?? []).map((semester) => ({
        label:
          semester.name ??
          t('semesters.numberLabel', {
            defaultValue: `Semester ${semester.semesterNumber}`,
            number: semester.semesterNumber,
          }),
        value: semester._id,
      })),
    [semesters, t],
  )

  const summary = React.useMemo(() => {
    if (!gridData) return null

    const scopedSessions = gridData.sessions.filter(
      (session) =>
        !session.isCancelled &&
        (selectedSemester === ALL_SEMESTERS ||
          session.semesterId === selectedSemester),
    )
    const sessionCount = scopedSessions.length

    const students: Array<StudentSummary> = gridData.students.map((student) => {
      let present = 0
      let late = 0
      let excused = 0
      let unexcused = 0
      let unset = 0

      for (const session of scopedSessions) {
        const record = gridData.attendanceMap[
          `${student.studentClassId}_${session._id}`
        ] as (typeof gridData.attendanceMap)[string] | undefined
        const status = record?.status as AttendanceStatusValue | undefined
        switch (status) {
          case 'present':
            present++
            break
          case 'late':
            late++
            break
          case 'excused_absence':
            excused++
            break
          case 'unexcused_absence':
            unexcused++
            break
          default:
            unset++
            break
        }
      }

      const rate =
        sessionCount === 0 ? null : ((present + late) / sessionCount) * 100

      return {
        studentClassId: student.studentClassId,
        fullName: student.fullName,
        saintName: student.saintName,
        studentCode: student.studentCode,
        present,
        late,
        excused,
        unexcused,
        unset,
        rate,
      }
    })

    const ratedStudents = students.filter(
      (s): s is StudentSummary & { rate: number } => s.rate !== null,
    )
    const averageRate =
      ratedStudents.length === 0
        ? null
        : ratedStudents.reduce((sum, s) => sum + s.rate, 0) /
          ratedStudents.length
    const perfectAttendanceCount = ratedStudents.filter(
      (s) => s.rate === 100,
    ).length

    return { sessionCount, students, averageRate, perfectAttendanceCount }
  }, [gridData, selectedSemester])

  const columns = React.useMemo<Array<ColumnDef<StudentSummary>>>(
    () => [
      {
        id: 'fullName',
        accessorFn: (row) =>
          `${formatPersonName(row.saintName, row.fullName)} ${row.studentCode}`,
        header: t('attendance.grid.studentName'),
        sortingFn: (rowA, rowB) =>
          compareByName(rowA.original, rowB.original, nameFormat),
        cell: ({ row }) => {
          const { saintName, fullName, studentCode } = row.original
          return (
            <div>
              <div className="font-medium">
                {formatPersonName(saintName, fullName)}
              </div>
              <div className="text-xs text-muted-foreground">
                {t('students.col.studentCode')}: {studentCode}
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: 'rate',
        header: t('attendance.summary.rate'),
        sortingFn: (rowA, rowB) =>
          (rowA.original.rate ?? -1) - (rowB.original.rate ?? -1),
        cell: ({ row }) => {
          const rate = row.original.rate
          if (rate === null) return '—'
          return (
            <Badge variant="outline" className={rateBadgeClassName(rate)}>
              {rate.toFixed(1)}%
            </Badge>
          )
        },
      },
      {
        accessorKey: 'present',
        header: t('attendance.summary.present'),
      },
      {
        accessorKey: 'late',
        header: t('attendance.summary.late'),
      },
      {
        accessorKey: 'excused',
        header: t('attendance.summary.excused'),
      },
      {
        accessorKey: 'unexcused',
        header: t('attendance.summary.unexcused'),
      },
      {
        accessorKey: 'unset',
        header: t('attendance.summary.unset'),
      },
    ],
    [t, nameFormat],
  )

  const exportHeaders = React.useMemo<Array<string>>(
    () => [
      t('attendance.grid.studentName'),
      t('students.col.studentCode'),
      t('attendance.summary.rate'),
      t('attendance.summary.present'),
      t('attendance.summary.late'),
      t('attendance.summary.excused'),
      t('attendance.summary.unexcused'),
      t('attendance.summary.unset'),
    ],
    [t],
  )

  const exportRows = React.useMemo<Array<Record<string, CellValue>>>(() => {
    const students = summary?.students ?? []
    return [...students]
      .sort((a, b) => compareByName(a, b, nameFormat))
      .map((student) => ({
        [exportHeaders[0]]: formatPersonName(
          student.saintName,
          student.fullName,
        ),
        [exportHeaders[1]]: student.studentCode,
        [exportHeaders[2]]:
          student.rate === null ? '—' : `${student.rate.toFixed(1)}%`,
        [exportHeaders[3]]: student.present,
        [exportHeaders[4]]: student.late,
        [exportHeaders[5]]: student.excused,
        [exportHeaders[6]]: student.unexcused,
        [exportHeaders[7]]: student.unset,
      }))
  }, [summary, nameFormat, exportHeaders])

  const handleExportCsv = () => {
    exportCsv(exportRows, 'bao-cao-diem-danh.csv', exportHeaders)
  }

  if (!gridData || !summary) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={handleExportCsv}
        >
          <Download className="h-4 w-4" />
          <span>{t('classes.export.csv')}</span>
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              {t('attendance.summary.totalSessions')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{summary.sessionCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              {t('attendance.summary.averageRate')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {summary.averageRate === null
                ? '—'
                : `${summary.averageRate.toFixed(1)}%`}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              {t('attendance.summary.perfectAttendance')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {summary.perfectAttendanceCount}
              <span className="ml-1 text-base font-normal text-muted-foreground">
                / {summary.students.length}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <DataTable
            columns={columns}
            data={summary.students}
            getRowId={(student) => student.studentClassId}
            sorting={sorting}
            onSortingChange={setSorting}
            searchColumnKey="fullName"
            searchPlaceholder={t('attendance.summary.searchPlaceholder')}
            filterExtra={
              <Select
                value={selectedSemester}
                onValueChange={(val) => {
                  if (val) setSelectedSemester(val)
                }}
                items={[
                  {
                    label: t('attendance.summary.allSemesters'),
                    value: ALL_SEMESTERS,
                  },
                  ...semesterOptions,
                ]}
              >
                <SelectTrigger className="sm:w-56">
                  <SelectValue
                    placeholder={t('attendance.summary.allSemesters')}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_SEMESTERS}>
                    {t('attendance.summary.allSemesters')}
                  </SelectItem>
                  {semesterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          />
        </CardContent>
      </Card>
    </div>
  )
}
