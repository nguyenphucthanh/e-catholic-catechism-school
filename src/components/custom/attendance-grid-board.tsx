import * as React from 'react'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'
import { api } from '../../../convex/_generated/api'
import { Textarea } from '../ui/textarea'
import type { Id } from '../../../convex/_generated/dataModel'
import { Button } from '~/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover'
import { Skeleton } from '~/components/ui/skeleton'

interface AttendanceGridBoardProps {
  classId: Id<'classes'>
  academicYearId: Id<'academicYears'>
  requesterId: Id<'catechists'>
}

const ATTENDANCE_CONFIG = {
  unset: {
    Icon: Circle,
    color: 'text-gray-400',
    bg: 'bg-gray-100',
  },
  present: {
    Icon: CheckCircle2,
    color: 'text-green-600',
    bg: 'bg-green-100',
  },
  late: {
    Icon: Clock,
    color: 'text-yellow-500',
    bg: 'bg-yellow-100',
  },
  excused_absence: {
    Icon: AlertCircle,
    color: 'text-purple-500',
    bg: 'bg-purple-100',
  },
  unexcused_absence: {
    Icon: AlertTriangle,
    color: 'text-red-500',
    bg: 'bg-red-100',
  },
}

type AttendanceStatus = keyof typeof ATTENDANCE_CONFIG

function AttendanceCell({
  status,
  isCancelled,
  className = '',
}: {
  status: AttendanceStatus
  isCancelled: boolean
  className?: string
}) {
  const config = ATTENDANCE_CONFIG[status]
  const Icon = config.Icon
  return (
    <div
      className={`flex h-12 w-12 items-center justify-center rounded ${config.bg} ${className} ${
        isCancelled ? 'opacity-50 line-through' : ''
      }`}
    >
      <Icon className={`${config.color} h-5 w-5`} />
    </div>
  )
}

function AttendancePopover({
  studentName,
  sessionDate,
  status,
  notes,
  onSave,
  isSaving,
  isCancelled,
}: {
  studentName: string
  sessionDate: string
  status: AttendanceStatus
  notes?: string
  onSave: (status: AttendanceStatus | null, notes: string) => void
  isSaving: boolean
  isCancelled: boolean
}) {
  const { t } = useTranslation()
  const [selectedStatus, setSelectedStatus] =
    React.useState<AttendanceStatus>(status)
  const [notesText, setNotesText] = React.useState(notes || '')

  if (isCancelled) {
    return (
      <div className="p-3 text-center text-xs text-muted-foreground">
        {t('attendance.status.cancelled', {
          defaultValue: 'Session Cancelled',
        })}
      </div>
    )
  }

  return (
    <div className="w-72 space-y-4">
      <div>
        <h3 className="font-medium">{t('attendance.popover.title')}</h3>
        <p className="text-sm text-muted-foreground">{studentName}</p>
        <p className="text-xs text-gray-500">
          {format(parseISO(sessionDate), 'MMM dd, yyyy')}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {(Object.keys(ATTENDANCE_CONFIG) as Array<AttendanceStatus>)
          .filter((s) => s !== 'unset')
          .map((s) => {
            const config = ATTENDANCE_CONFIG[s]
            const Icon = config.Icon
            return (
              <Button
                key={s}
                onClick={() => setSelectedStatus(s)}
                disabled={isSaving}
                variant={'outline'}
                className={`${
                  selectedStatus === s
                    ? `${config.bg} ${config.color} border-2 border-current`
                    : ''
                }`}
              >
                <Icon className="h-4 w-4" />
                {t(`attendance.status.${s}`, { defaultValue: s })}
              </Button>
            )
          })}
      </div>

      <div>
        <Textarea
          value={notesText}
          onChange={(e) => setNotesText(e.target.value)}
          disabled={isSaving}
          placeholder={t('attendance.popover.notesPlaceholder')}
          rows={2}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onSave(null, '')}
          disabled={isSaving}
        >
          {t('attendance.popover.clearBtn')}
        </Button>
        <Button
          size="sm"
          onClick={() => onSave(selectedStatus, notesText)}
          disabled={isSaving}
        >
          {t('attendance.popover.saveBtn')}
        </Button>
      </div>
    </div>
  )
}

export function AttendanceGridBoard({
  classId,
  academicYearId,
  requesterId,
}: AttendanceGridBoardProps) {
  const { t } = useTranslation()
  const gridData = useQuery(api.attendance.getAttendanceGrid, {
    classId,
    academicYearId,
    requesterId,
  })
  const saveAttendance = useMutation(api.attendance.saveGridAttendance)
  const [savingCell, setSavingCell] = React.useState<string | null>(null)

  // Group sessions by month-year
  const sessionsByMonth = React.useMemo(() => {
    const grouped: Record<string, NonNullable<typeof gridData>['sessions']> = {}
    if (!gridData) return grouped
    for (const session of gridData.sessions) {
      const monthYear = format(parseISO(session.sessionDate), 'MMM yyyy')
      grouped[monthYear] ??= []
      grouped[monthYear].push(session)
    }
    return grouped
  }, [gridData])

  if (!gridData) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (gridData.students.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="font-semibold">
          {t('attendance.grid.noStudents', {
            defaultValue: 'No students enrolled',
          })}
        </p>
      </div>
    )
  }

  const monthYearOrder = Object.keys(sessionsByMonth)

  const handleSaveAttendance = async (
    studentId: Id<'students'>,
    studentClassId: Id<'studentClasses'>,
    sessionId: Id<'classSessions'>,
    status: AttendanceStatus | null,
    notes: string,
  ) => {
    const cellKey = `${studentClassId}_${sessionId}`
    setSavingCell(cellKey)
    try {
      const statusValue =
        status === null || status === 'unset' ? undefined : status
      await saveAttendance({
        requesterId,
        sessionId,
        studentId,
        status: statusValue,
        notes: notes || undefined,
      })
      toast.success(t('common.saved'))
    } catch (error) {
      toast.error(t('common.error', { defaultValue: 'Failed to save' }))
      console.error(error)
    } finally {
      setSavingCell(null)
    }
  }

  return (
    <div
      className="w-full rounded-lg border min-w-0"
      style={{
        height: '100vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div className="overflow-auto flex-1 min-w-0">
        <table className="border-collapse w-full">
          <thead>
            {/* Header Row 1: Month-Year */}
            <tr>
              <th
                className="sticky left-0 top-0 z-40 border bg-background p-2 text-left text-sm font-semibold"
                style={{ minWidth: '200px' }}
              >
                {t('attendance.grid.studentName')}
              </th>
              {monthYearOrder.map((monthYear) => {
                const count = sessionsByMonth[monthYear].length
                return (
                  <th
                    key={monthYear}
                    colSpan={count}
                    className="sticky top-0 z-30 border bg-background p-2 text-center text-sm font-semibold"
                  >
                    {monthYear}
                  </th>
                )
              })}
            </tr>

            {/* Header Row 2: Day & Date */}
            <tr>
              <th
                className="sticky left-0 top-[38px] z-40 border bg-background p-2"
                style={{ minWidth: '200px' }}
              />
              {monthYearOrder.flatMap((monthYear) =>
                sessionsByMonth[monthYear].map((session) => (
                  <th
                    key={session._id}
                    className="sticky top-[38px] z-30 border bg-background p-1 text-center text-xs"
                  >
                    <div>{format(parseISO(session.sessionDate), 'dd')}</div>
                    <div className="text-gray-500">
                      {format(parseISO(session.sessionDate), 'EEE')}
                    </div>
                  </th>
                )),
              )}
            </tr>
          </thead>

          <tbody>
            {gridData.students.map((student) => {
              const fullName =
                student.saintName && student.fullName
                  ? `${student.saintName} ${student.fullName}`
                  : student.fullName
              return (
                <tr key={student.studentClassId}>
                  <td
                    className="sticky left-0 z-20 border bg-background p-2 text-sm shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"
                    style={{ minWidth: '200px' }}
                  >
                    <div className="font-medium">{fullName}</div>
                    <div className="text-xs text-muted-foreground">
                      {student.studentCode}
                    </div>
                  </td>
                  {monthYearOrder.flatMap((monthYear) =>
                    sessionsByMonth[monthYear].map((session) => {
                      const cellKey = `${student.studentClassId}_${session._id}`
                      const record = gridData.attendanceMap[
                        `${student.studentClassId}_${session._id}`
                      ] as (typeof gridData.attendanceMap)[string] | undefined
                      const status: AttendanceStatus = record
                        ? (record.status as AttendanceStatus)
                        : 'unset'
                      const isSaving = savingCell === cellKey

                      return (
                        <td
                          key={session._id}
                          className="border p-1 text-center"
                        >
                          <Popover>
                            <PopoverTrigger
                              disabled={session.isCancelled || isSaving}
                              className="h-12 w-12 rounded transition hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <AttendanceCell
                                status={status}
                                isCancelled={session.isCancelled}
                              />
                            </PopoverTrigger>
                            {!session.isCancelled && (
                              <PopoverContent
                                side="right"
                                align="start"
                                className="w-auto"
                              >
                                <AttendancePopover
                                  studentName={fullName}
                                  sessionDate={session.sessionDate}
                                  status={status}
                                  notes={record?.notes}
                                  onSave={(newStatus, notes) =>
                                    handleSaveAttendance(
                                      student.studentId,
                                      student.studentClassId,
                                      session._id,
                                      newStatus,
                                      notes,
                                    )
                                  }
                                  isSaving={isSaving}
                                  isCancelled={session.isCancelled}
                                />
                              </PopoverContent>
                            )}
                          </Popover>
                        </td>
                      )
                    }),
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
