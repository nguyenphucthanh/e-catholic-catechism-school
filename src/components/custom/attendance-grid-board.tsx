import * as React from 'react'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { Link } from '@tanstack/react-router'
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpDown,
  CheckCircle2,
  CheckSquare,
  Circle,
  Clock,
  Download,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  XSquare,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'
import { api } from '../../../convex/_generated/api'
import { Textarea } from '../ui/textarea'
import { Field, FieldGroup, FieldLabel } from '../ui/field'
import type { Id } from '../../../convex/_generated/dataModel'
import type { CellValue } from '~/lib/export'
import { translateConvexError } from '~/lib/convex-errors'
import { exportCsv } from '~/lib/export'
import { formatPersonName } from '~/lib/name'
import { Alert, AlertDescription } from '~/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover'
import { Skeleton } from '~/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Card, CardContent, CardHeader } from '~/components/ui/card'

interface AttendanceGridBoardProps {
  classId: Id<'classes'>
  academicYearId: Id<'academicYears'>
  requesterId: Id<'catechists'>
  canManage?: boolean
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

type SessionConfirmActionType =
  'cancel' | 'delete' | 'markAllPresent' | 'clearAll'

interface SessionInfo {
  _id: Id<'classSessions'>
  sessionDate: string
  isCancelled: boolean
  notes?: string
}

function SessionActionsPopover({
  session,
  isSaving,
  onSaveFields,
  onCancelSession,
  onRestoreSession,
  onDeleteSession,
  onMarkAllPresent,
  onClearAll,
}: {
  session: SessionInfo
  isSaving: boolean
  onSaveFields: (sessionDate: string, notes: string) => void
  onCancelSession: () => void
  onRestoreSession: () => void
  onDeleteSession: () => void
  onMarkAllPresent: () => void
  onClearAll: () => void
}) {
  const { t } = useTranslation()
  const [sessionDate, setSessionDate] = React.useState(session.sessionDate)
  const [notes, setNotes] = React.useState(session.notes || '')

  return (
    <div className="w-72 space-y-3">
      <div>
        <h3 className="font-medium">{t('attendance.session.popover.title')}</h3>
        <p className="text-xs text-gray-500">
          {format(parseISO(session.sessionDate), 'MMM dd, yyyy')}
        </p>
      </div>

      <FieldGroup>
        <Field>
          <FieldLabel>{t('attendance.session.popover.dateLabel')}</FieldLabel>
          <Input
            type="date"
            value={sessionDate}
            onChange={(e) => setSessionDate(e.target.value)}
            disabled={isSaving}
          />
        </Field>
        <Field>
          <FieldLabel>{t('attendance.session.popover.notesLabel')}</FieldLabel>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isSaving}
            rows={2}
          />
        </Field>
        <Button
          size="sm"
          className="w-full"
          disabled={isSaving}
          onClick={() => onSaveFields(sessionDate, notes)}
        >
          {t('common.save')}
        </Button>
      </FieldGroup>

      <div className="grid grid-cols-1 gap-2 border-t pt-2">
        <Button
          variant="outline"
          size="sm"
          disabled={isSaving}
          onClick={onMarkAllPresent}
        >
          <CheckSquare className="h-4 w-4" />
          {t('attendance.session.actions.markAllPresent')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={isSaving}
          onClick={onClearAll}
        >
          <XSquare className="h-4 w-4" />
          {t('attendance.session.actions.clearAll')}
        </Button>
        {session.isCancelled ? (
          <Button
            variant="outline"
            size="sm"
            disabled={isSaving}
            onClick={onRestoreSession}
          >
            {t('attendance.session.actions.restore')}
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={isSaving}
            onClick={onCancelSession}
          >
            <AlertTriangle className="h-4 w-4" />
            {t('attendance.session.actions.cancel')}
          </Button>
        )}
        <Button
          variant="destructive"
          size="sm"
          disabled={isSaving}
          onClick={onDeleteSession}
        >
          <Trash2 className="h-4 w-4" />
          {t('attendance.session.actions.delete')}
        </Button>
      </div>
    </div>
  )
}

export function AttendanceGridBoard({
  classId,
  academicYearId,
  requesterId,
  canManage = false,
}: AttendanceGridBoardProps) {
  const { t } = useTranslation()
  const gridData = useQuery(api.attendanceQueries.getAttendanceGrid, {
    classId,
    academicYearId,
    requesterId,
  })
  const appConfig = useQuery(api.appConfig.get)
  const nameFormat = appConfig?.nameFormat ?? 'firstName_lastName'
  const saveAttendance = useMutation(api.attendance.saveGridAttendance)
  const updateSession = useMutation(api.classSessions.update)
  const deleteSession = useMutation(api.classSessions.softDelete)
  const bulkSaveAttendance = useMutation(api.attendance.bulkSaveGridAttendance)

  const isSunday = React.useMemo(() => new Date().getDay() === 0, [])
  const todayStr = React.useMemo(() => format(new Date(), 'yyyy-MM-dd'), [])
  const hasSessionToday = React.useMemo(() => {
    return gridData?.sessions.some((s) => s.sessionDate === todayStr) ?? false
  }, [gridData?.sessions, todayStr])
  const showSundayAlert = isSunday && !hasSessionToday && canManage
  const [savingCell, setSavingCell] = React.useState<string | null>(null)
  const [showCancelled, setShowCancelled] = React.useState(true)
  const [dateOrder, setDateOrder] = React.useState<'asc' | 'desc'>('desc')
  const [selectedSemester, setSelectedSemester] = React.useState<string>('all')
  const [sessionActionSavingId, setSessionActionSavingId] =
    React.useState<Id<'classSessions'> | null>(null)
  const [confirmAction, setConfirmAction] = React.useState<{
    type: SessionConfirmActionType
    sessionId: Id<'classSessions'>
  } | null>(null)

  React.useEffect(() => {
    setSelectedSemester('all')
  }, [classId, academicYearId])

  const semesters = useQuery(api.academicYears.listSemesters, {
    requesterId,
    academicYearId,
  })

  const semesterOptions = React.useMemo(
    () =>
      (Array.isArray(semesters) ? semesters : []).map((semester) => ({
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

  // Filter by cancelled visibility, selected semester and sort by
  // semester order first, then by date order within each semester
  const visibleSessions = React.useMemo(() => {
    if (!gridData) return []
    let list = showCancelled
      ? gridData.sessions
      : gridData.sessions.filter((s) => !s.isCancelled)
    if (selectedSemester !== 'all') {
      list = list.filter((s) => s.semesterId === selectedSemester)
    }
    const semesterIndex = new Map(semesterOptions.map((s, i) => [s.value, i]))
    return [...list].sort((a, b) => {
      const semA = (a.semesterId && semesterIndex.get(a.semesterId)) ?? 0
      const semB = (b.semesterId && semesterIndex.get(b.semesterId)) ?? 0
      if (semA !== semB) return semA - semB
      const diff =
        new Date(a.sessionDate).getTime() - new Date(b.sessionDate).getTime()
      return dateOrder === 'asc' ? diff : -diff
    })
  }, [gridData, showCancelled, dateOrder, selectedSemester, semesterOptions])

  // Group consecutive sessions sharing the same semester for the header group row
  const sessionGroups = React.useMemo(() => {
    const groups: Array<{
      semesterId: string
      label: string
      sessions: typeof visibleSessions
    }> = []
    let current: (typeof groups)[number] | undefined
    for (const session of visibleSessions) {
      const semesterId = session.semesterId ?? ''
      if (current && current.semesterId === semesterId) {
        current.sessions.push(session)
      } else {
        const label =
          semesterOptions.find((s) => s.value === semesterId)?.label ?? ''
        current = { semesterId, label, sessions: [session] }
        groups.push(current)
      }
    }
    return groups
  }, [visibleSessions, semesterOptions])

  const hasSemesterGroups = semesterOptions.length > 0

  // Group each semester's sessions by month-year (scoped to the semester so
  // the same month-year label appearing in two different semesters doesn't
  // merge into one non-contiguous colSpan group)
  const monthGroupsBySemester = React.useMemo(() => {
    return sessionGroups.map((group) => {
      const months: Array<{
        monthYear: string
        sessions: typeof group.sessions
      }> = []
      let current: (typeof months)[number] | undefined
      for (const session of group.sessions) {
        const monthYear = format(parseISO(session.sessionDate), 'MMM yyyy')
        if (current && current.monthYear === monthYear) {
          current.sessions.push(session)
        } else {
          current = { monthYear, sessions: [session] }
          months.push(current)
        }
      }
      return { ...group, months }
    })
  }, [sessionGroups])

  const sortedStudents = React.useMemo(() => {
    if (!gridData) return []
    return [...gridData.students].sort((a, b) => {
      const nameA = formatPersonName(a.saintName, a.fullName)
      const nameB = formatPersonName(b.saintName, b.fullName)

      if (nameFormat === 'firstName_lastName') {
        return nameA
          .toLocaleLowerCase()
          .localeCompare(nameB.toLocaleLowerCase())
      }
      const lastNameA = nameA.split(' ').pop() || ''
      const lastNameB = nameB.split(' ').pop() || ''
      return lastNameA
        .toLocaleLowerCase()
        .localeCompare(lastNameB.toLocaleLowerCase())
    })
  }, [gridData, nameFormat])

  const exportHeaders = React.useMemo<Array<string>>(
    () => [
      t('attendance.grid.studentName'),
      t('students.col.studentCode'),
      ...visibleSessions.map((session) =>
        format(parseISO(session.sessionDate), 'dd/MM/yyyy'),
      ),
    ],
    [t, visibleSessions],
  )

  const exportRows = React.useMemo<Array<Record<string, CellValue>>>(() => {
    if (!gridData) return []
    return sortedStudents.map((student) => {
      const fullName = formatPersonName(student.saintName, student.fullName)
      const row: Record<string, CellValue> = {
        [exportHeaders[0]]: fullName,
        [exportHeaders[1]]: student.studentCode,
      }
      visibleSessions.forEach((session, i) => {
        const record = gridData.attendanceMap[
          `${student.studentClassId}_${session._id}`
        ] as (typeof gridData.attendanceMap)[string] | undefined
        const status = record?.status as AttendanceStatus | undefined
        row[exportHeaders[i + 2]] = session.isCancelled
          ? t('attendance.status.cancelled', { defaultValue: 'Cancelled' })
          : t(`attendance.status.${status ?? 'unset'}`, {
              defaultValue: status ?? 'unset',
            })
      })
      return row
    })
  }, [gridData, sortedStudents, visibleSessions, exportHeaders, t])

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

  const handleExportCsv = () => {
    exportCsv(exportRows, 'diem-danh.csv', exportHeaders)
  }

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
        notes: statusValue === undefined ? undefined : notes,
      })
      toast.success(t('common.saved'))
    } catch (error) {
      toast.error(translateConvexError(error, t))
      console.error(error)
    } finally {
      setSavingCell(null)
    }
  }

  const handleSaveSessionFields = async (
    sessionId: Id<'classSessions'>,
    sessionDate: string,
    notes: string,
  ) => {
    setSessionActionSavingId(sessionId)
    try {
      await updateSession({
        requesterId,
        sessionId,
        sessionDate,
        notes: notes,
      })
      toast.success(t('common.saved'))
    } catch (error) {
      toast.error(translateConvexError(error, t))
      console.error(error)
    } finally {
      setSessionActionSavingId(null)
    }
  }

  const handleRestoreSession = async (sessionId: Id<'classSessions'>) => {
    setSessionActionSavingId(sessionId)
    try {
      await updateSession({ requesterId, sessionId, isCancelled: false })
      toast.success(t('common.saved'))
    } catch (error) {
      toast.error(translateConvexError(error, t))
      console.error(error)
    } finally {
      setSessionActionSavingId(null)
    }
  }

  const handleConfirmedAction = async () => {
    if (!confirmAction) return
    const { type, sessionId } = confirmAction
    setSessionActionSavingId(sessionId)
    try {
      if (type === 'cancel') {
        await updateSession({ requesterId, sessionId, isCancelled: true })
      } else if (type === 'delete') {
        await deleteSession({ requesterId, sessionId })
      } else if (type === 'markAllPresent') {
        await bulkSaveAttendance({
          requesterId,
          sessionId,
          studentIds: gridData.students.map((s) => s.studentId),
          status: 'present',
        })
      } else {
        await bulkSaveAttendance({
          requesterId,
          sessionId,
          studentIds: gridData.students.map((s) => s.studentId),
          status: null,
        })
      }
      toast.success(t('common.saved'))
    } catch (error) {
      toast.error(translateConvexError(error, t))
      console.error(error)
    } finally {
      setSessionActionSavingId(null)
      setConfirmAction(null)
    }
  }

  const confirmCopy: Record<
    SessionConfirmActionType,
    { title: string; desc: string; confirmBtn: string }
  > = {
    cancel: {
      title: t('attendance.session.confirm.cancelTitle'),
      desc: t('attendance.session.confirm.cancelDesc'),
      confirmBtn: t('attendance.session.actions.cancel'),
    },
    delete: {
      title: t('attendance.session.confirm.deleteTitle'),
      desc: t('attendance.session.confirm.deleteDesc'),
      confirmBtn: t('common.delete'),
    },
    markAllPresent: {
      title: t('attendance.session.confirm.bulkTitle'),
      desc: t('attendance.session.confirm.bulkDesc'),
      confirmBtn: t('common.save'),
    },
    clearAll: {
      title: t('attendance.session.confirm.bulkTitle'),
      desc: t('attendance.session.confirm.bulkDesc'),
      confirmBtn: t('common.save'),
    },
  }

  return (
    <div
      className="flex w-full flex-col gap-2 min-w-0"
      style={{ height: '100vh' }}
    >
      {showSundayAlert && (
        <Alert className="border-yellow-500/30 bg-yellow-500/10 text-yellow-800 dark:text-yellow-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
            <span>{t('attendance.grid.sundayAlert')}</span>
            <Link to="/classes/$id/sessions/create" params={{ id: classId }}>
              <Button
                size="sm"
                variant="outline"
                className="text-xs py-1 h-8 border-yellow-500/30 text-yellow-800 dark:text-yellow-200 hover:bg-yellow-500/20 bg-transparent"
              >
                {t('attendance.grid.sundayAlertAction')}
              </Button>
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap justify-end gap-2 items-center">
        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          onClick={handleExportCsv}
        >
          <Download className="h-4 w-4" />
          <span>{t('classes.export.csv')}</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCancelled((v) => !v)}
        >
          {showCancelled ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
          {showCancelled
            ? t('attendance.grid.toolbar.hideCancelled')
            : t('attendance.grid.toolbar.showCancelled')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setDateOrder((order) => (order === 'asc' ? 'desc' : 'asc'))
          }
        >
          <ArrowUpDown className="h-4 w-4" />
          {dateOrder === 'desc'
            ? t('attendance.grid.toolbar.newestFirst')
            : t('attendance.grid.toolbar.oldestFirst')}
        </Button>
        {canManage && (
          <Link to="/classes/$id/sessions/create" params={{ id: classId }}>
            <Button
              size="sm"
              className="gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              <span>{t('attendance.grid.toolbar.createSession')}</span>
            </Button>
          </Link>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Select
              value={selectedSemester}
              onValueChange={(val) => {
                if (val) setSelectedSemester(val)
              }}
              items={[
                {
                  label: t('attendance.summary.allSemesters'),
                  value: 'all',
                },
                ...semesterOptions,
              ]}
            >
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue
                  placeholder={t('attendance.summary.allSemesters')}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t('attendance.summary.allSemesters')}
                </SelectItem>
                {semesterOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="h-screen min-h-0">
          <div className="w-full h-full overflow-hidden relative">
            <div className="overflow-auto min-w-0 w-full h-full scroll-fade">
              <table className="border-collapse w-full">
                <thead className="z-10 relative drop-shadow-xl">
                  {/* Header Row 1: Semester grouping (only when semesters exist) */}
                  {hasSemesterGroups && (
                    <tr className="">
                      <th
                        className="sticky left-0 top-0 z-40 border bg-background p-2 text-left text-sm font-semibold"
                        style={{ minWidth: '200px' }}
                      >
                        {t('attendance.grid.studentName')}
                      </th>
                      {sessionGroups.map((group) => (
                        <th
                          key={group.semesterId}
                          colSpan={group.sessions.length}
                          className="sticky top-0 z-30 border bg-background p-2 text-center text-xs font-semibold"
                        >
                          {group.label}
                        </th>
                      ))}
                    </tr>
                  )}

                  {/* Header Row 2: Month-Year */}
                  <tr className=" border">
                    <th
                      className={`sticky left-0 z-40 border bg-background p-2 text-left text-sm font-semibold ${
                        hasSemesterGroups ? 'top-[38px]' : 'top-0'
                      }`}
                      style={{ minWidth: '200px' }}
                    >
                      {!hasSemesterGroups && t('attendance.grid.studentName')}
                    </th>
                    {monthGroupsBySemester.flatMap((group) =>
                      group.months.map((month) => (
                        <th
                          key={`${group.semesterId}-${month.monthYear}`}
                          colSpan={month.sessions.length}
                          className={`sticky z-30 border bg-background p-2 text-center text-sm font-semibold ${
                            hasSemesterGroups ? 'top-[38px]' : 'top-0'
                          }`}
                        >
                          {month.monthYear}
                        </th>
                      )),
                    )}
                  </tr>

                  {/* Header Row 3: Day & Date */}
                  <tr className="">
                    <th
                      className={`sticky left-0 z-40 border bg-background p-2 ${
                        hasSemesterGroups ? 'top-[76px]' : 'top-[38px]'
                      }`}
                      style={{ minWidth: '200px' }}
                    />
                    {visibleSessions.map((session) => (
                      <th
                        key={session._id}
                        className={`sticky z-30 border bg-background p-1 text-center text-xs ${
                          hasSemesterGroups ? 'top-[76px]' : 'top-[38px]'
                        }`}
                      >
                        {canManage ? (
                          <Popover>
                            <PopoverTrigger
                              disabled={sessionActionSavingId === session._id}
                              className="cursor-pointer hover:bg-accent w-full rounded transition hover:opacity-80 disabled:opacity-50"
                            >
                              <div>
                                {format(parseISO(session.sessionDate), 'dd')}
                              </div>
                              <div className="text-gray-500">
                                {format(parseISO(session.sessionDate), 'EEE')}
                              </div>
                            </PopoverTrigger>
                            <PopoverContent
                              side="bottom"
                              align="center"
                              className="w-auto"
                            >
                              <SessionActionsPopover
                                session={session}
                                isSaving={sessionActionSavingId === session._id}
                                onSaveFields={(sessionDate, notes) =>
                                  handleSaveSessionFields(
                                    session._id,
                                    sessionDate,
                                    notes,
                                  )
                                }
                                onCancelSession={() =>
                                  setConfirmAction({
                                    type: 'cancel',
                                    sessionId: session._id,
                                  })
                                }
                                onRestoreSession={() =>
                                  handleRestoreSession(session._id)
                                }
                                onDeleteSession={() =>
                                  setConfirmAction({
                                    type: 'delete',
                                    sessionId: session._id,
                                  })
                                }
                                onMarkAllPresent={() =>
                                  setConfirmAction({
                                    type: 'markAllPresent',
                                    sessionId: session._id,
                                  })
                                }
                                onClearAll={() =>
                                  setConfirmAction({
                                    type: 'clearAll',
                                    sessionId: session._id,
                                  })
                                }
                              />
                            </PopoverContent>
                          </Popover>
                        ) : (
                          <div className="p-1">
                            <div>
                              {format(parseISO(session.sessionDate), 'dd')}
                            </div>
                            <div className="text-gray-500">
                              {format(parseISO(session.sessionDate), 'EEE')}
                            </div>
                          </div>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="z-5 relative">
                  {sortedStudents.map((student) => {
                    const fullName = formatPersonName(
                      student.saintName,
                      student.fullName,
                    )
                    return (
                      <tr
                        key={student.studentClassId}
                        className="hover:bg-accent group transition-colors"
                      >
                        <td
                          className="sticky transition-colors left-0 z-20 border bg-background group-hover:bg-accent p-2 text-sm drop-shadow-xl"
                          style={{ minWidth: '200px' }}
                        >
                          <div className="font-medium whitespace-nowrap">
                            {fullName}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {t('students.col.studentCode')}:{' '}
                            {student.studentCode}
                          </div>
                        </td>
                        {visibleSessions.map((session) => {
                          const cellKey = `${student.studentClassId}_${session._id}`
                          const record = gridData.attendanceMap[
                            `${student.studentClassId}_${session._id}`
                          ] as
                            (typeof gridData.attendanceMap)[string] | undefined
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
                                  disabled={
                                    session.isCancelled ||
                                    isSaving ||
                                    !canManage
                                  }
                                  className="h-12 w-12 rounded transition hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <AttendanceCell
                                    status={status}
                                    isCancelled={session.isCancelled}
                                  />
                                </PopoverTrigger>
                                {!session.isCancelled && canManage && (
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
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog
        open={confirmAction !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null)
        }}
      >
        <AlertDialogContent>
          {confirmAction && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {confirmCopy[confirmAction.type].title}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {confirmCopy[confirmAction.type].desc}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmedAction}>
                  {confirmCopy[confirmAction.type].confirmBtn}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
