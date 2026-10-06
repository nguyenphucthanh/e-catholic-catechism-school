import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router'
import { useForm, useSelector } from '@tanstack/react-form'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  Clock,
  QrCode,
  Search,
} from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import { z } from 'zod'
import { format } from 'date-fns'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import type { FunctionReturnType } from 'convex/server'
import { useAuth } from '~/lib/auth'
import { sortByNameFormat } from '~/lib/name'
import { playBeep } from '~/lib/beep'
import { translateConvexError } from '~/lib/convex-errors'
import { useSelectedAcademicYear } from '~/lib/academic-year'
import { PageHeader } from '~/components/page-header'
import { QRScanner } from '~/components/custom/qr-scanner'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Textarea } from '~/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
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
import { Card, CardContent } from '~/components/ui/card'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '~/components/ui/input-group'
import { Field, FieldError, FieldLabel } from '~/components/ui/field'

export const Route = createFileRoute(
  '/_authenticated/_catechist/classes_/$id_/sessions_/create',
)({
  component: CreateSessionWithAttendancePage,
  staticData: {
    crumbs: [
      { label: 'classes.title', path: '/classes' },
      { label: 'attendance.createSession.title' },
    ],
  },
})

type ClassStudent = NonNullable<
  FunctionReturnType<typeof api.classes.getClassDetails>
>['students'][number]

type AttendanceStatus =
  'present' | 'late' | 'unexcused_absence' | 'excused_absence'

interface StudentRecord {
  status: AttendanceStatus
  notes: string
}

type ScanFeedback = {
  status: 'success' | 'duplicate' | 'unknown'
  name: string
}

const SCAN_DEBOUNCE_MS = 500

const STATUS_CONFIG = {
  present: {
    bg: 'bg-[#bbf7d0]',
    textColor: 'text-green-800',
    iconColor: 'text-neutral-900',
    Icon: CheckCircle2,
    labelKey: 'attendance.status.present.short',
  },
  late: {
    bg: 'bg-[#fef08a]',
    textColor: 'text-yellow-800',
    iconColor: 'text-neutral-900',
    Icon: Clock,
    labelKey: 'attendance.status.late.short',
  },
  unexcused_absence: {
    bg: 'bg-[#fca5a5]',
    textColor: 'text-red-800',
    iconColor: 'text-neutral-900',
    Icon: AlertCircle,
    labelKey: 'attendance.status.unexcused_absence.short',
  },
  excused_absence: {
    bg: 'bg-[#e9d5ff]',
    textColor: 'text-purple-800',
    iconColor: 'text-neutral-900',
    Icon: AlertTriangle,
    labelKey: 'attendance.status.excused_absence.short',
  },
}

function CreateSessionWithAttendancePage() {
  const { id: classId } = useParams({ strict: false })
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { selectedYearId } = useSelectedAcademicYear()
  const requesterId = user?.userDocId as Id<'catechists'> | undefined

  const todayStr = React.useMemo(() => format(new Date(), 'yyyy-MM-dd'), [])

  const [expandedStudentId, setExpandedStudentId] = React.useState<
    string | null
  >(null)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [confirmLeaveOpen, setConfirmLeaveOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [scanMode, setScanMode] = React.useState(false)
  const [scanUsed, setScanUsed] = React.useState(false)
  const [scanFeedback, setScanFeedback] = React.useState<ScanFeedback | null>(
    null,
  )
  const [confirmResetOpen, setConfirmResetOpen] = React.useState(false)
  const [confirmSubmitOpen, setConfirmSubmitOpen] = React.useState(false)
  const lastScanned = React.useRef<Record<string, number>>({})

  // Fetch Class & Semester Details
  const classDetails = useQuery(
    api.classes.getClassDetails,
    requesterId && selectedYearId && classId
      ? {
          requesterId,
          classId: classId as Id<'classes'>,
          academicYearId: selectedYearId,
        }
      : 'skip',
  )

  const semesters = useQuery(
    api.academicYears.listSemesters,
    requesterId && selectedYearId
      ? {
          requesterId,
          academicYearId: selectedYearId,
        }
      : 'skip',
  )

  const appConfig = useQuery(api.appConfig.get)

  const createMutation = useMutation(api.classSessions.createWithAttendance)

  // Set default semester once loaded
  const semesterOptions = React.useMemo(() => {
    if (!semesters || semesters.length === 0) return []
    return semesters.map((sem) => ({
      label:
        sem.name ?? t('semesters.numberLabel', { number: sem.semesterNumber }),
      value: sem._id,
    }))
  }, [semesters, t])

  const defaultSemesterId = semesterOptions[0]?.value || ''

  const initialAttendance: Record<string, StudentRecord | undefined> = {}

  const formSchema = React.useMemo(
    () =>
      z.object({
        sessionDate: z.string().min(1, t('common.required')),
        sessionType: z.enum(['catechism', 'supplemental']),
        semesterId: z.string().min(1, t('common.required')),
        notes: z.string(),
        attendance: z.record(
          z.string(),
          z
            .object({
              status: z.enum([
                'present',
                'late',
                'unexcused_absence',
                'excused_absence',
              ]),
              notes: z.string(),
            })
            .optional(),
        ),
      }),
    [t],
  )

  const form = useForm({
    defaultValues: {
      sessionDate: todayStr,
      sessionType: 'catechism' as 'catechism' | 'supplemental',
      semesterId: '',
      notes: '',
      attendance: initialAttendance,
    },
    validators: {
      onSubmit: formSchema,
    },
    onSubmit: async ({ value }) => {
      if (!requesterId || !classDetails?.classYear || !value.semesterId) return

      setIsSubmitting(true)
      try {
        const attendancePayload = classDetails.students.map((s) => {
          const record = value.attendance[s.student._id] || {
            status: 'present' as const,
            notes: '',
          }
          return {
            studentId: s.student._id,
            status: record.status,
            notes: record.notes ? record.notes : undefined,
          }
        })

        await createMutation({
          requesterId,
          classYearId: classDetails.classYear._id,
          semesterId: value.semesterId as Id<'semesters'>,
          sessionDate: value.sessionDate,
          sessionType: value.sessionType,
          notes: value.notes ? value.notes : undefined,
          attendance: attendancePayload,
        })

        toast.success(t('attendance.createSession.success'))
        void navigate({
          to: '/classes/$id',
          params: { id: classId! },
          search: { tab: 'attendance' },
        })
      } catch (err) {
        toast.error(translateConvexError(err, t))
        console.error(err)
      } finally {
        setIsSubmitting(false)
      }
    },
  })

  React.useEffect(() => {
    if (semesterOptions.length > 0 && !form.state.values.semesterId) {
      form.setFieldValue('semesterId', semesterOptions[0].value)
    }
  }, [semesterOptions, form])

  const values = useSelector(form.store, (state) => state.values)

  // Compute dirty flag
  const isDirty = React.useMemo(() => {
    if (values.sessionDate !== todayStr) return true
    if (values.notes !== '') return true
    if (values.semesterId && values.semesterId !== defaultSemesterId)
      return true
    return Object.values(values.attendance).some(
      (r) => r && (r.status !== 'present' || r.notes !== ''),
    )
  }, [values, todayStr, defaultSemesterId])

  // Sorted by nameFormat setting, then filtered by search
  const sortedStudents = React.useMemo(
    () =>
      sortByNameFormat<ClassStudent>(
        classDetails?.students ?? [],
        (s) => s.student.fullName,
        appConfig?.nameFormat,
      ),
    [classDetails?.students, appConfig?.nameFormat],
  )

  const filteredStudents = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return sortedStudents

    return sortedStudents.filter((s) => {
      const name = s.student.fullName.toLowerCase()
      const saint = (s.student.saintName || '').toLowerCase()
      const code = s.student.studentCode.toLowerCase()
      return (
        name.includes(query) || saint.includes(query) || code.includes(query)
      )
    })
  }, [sortedStudents, searchQuery])

  // Calculate live summary
  const summary = React.useMemo(() => {
    const total = classDetails?.students.length || 0
    let present = 0
    let late = 0
    let absent = 0
    let excused = 0

    classDetails?.students.forEach((s) => {
      const record = values.attendance[s.student._id]
      const status = record ? record.status : 'present'
      if (status === 'present') present++
      else if (status === 'late') late++
      else if (status === 'unexcused_absence') absent++
      else excused++
    })

    return { total, present, late, absent, excused }
  }, [classDetails?.students, values.attendance])

  // Scan mode: everyone absent until their QR is scanned
  const enterScanMode = () => {
    const attendance: Record<string, StudentRecord> = {}
    classDetails?.students.forEach((s) => {
      attendance[s.student._id] = {
        status: 'unexcused_absence',
        notes: form.getFieldValue('attendance')[s.student._id]?.notes ?? '',
      }
    })
    form.setFieldValue('attendance', attendance)
    setScanMode(true)
  }

  const handleToggleScan = () => {
    if (scanMode) {
      setScanMode(false)
      // Nothing scanned: back to the default (everyone present)
      if (!scanUsed) form.setFieldValue('attendance', {})
      return
    }
    // Only ask when a manual edit would be lost
    const hasEdits = Object.values(form.getFieldValue('attendance')).some(
      (r) => r && (r.status !== 'present' || r.notes !== ''),
    )
    if (hasEdits) setConfirmResetOpen(true)
    else enterScanMode()
  }

  // Stable identity: QRScanner restarts the camera when onScan changes
  const classStudentsRef = React.useRef(classDetails?.students)
  classStudentsRef.current = classDetails?.students
  const handleScan = React.useCallback(
    (code: string) => {
      const now = Date.now()
      if (now - (lastScanned.current[code] ?? 0) < SCAN_DEBOUNCE_MS) return
      lastScanned.current[code] = now

      const match = classStudentsRef.current?.find(
        (s) =>
          s.student.studentCode.toLowerCase() === code.trim().toLowerCase(),
      )
      if (!match) {
        setScanFeedback({ status: 'unknown', name: code })
        return
      }
      const id = match.student._id
      const attendance = form.getFieldValue('attendance')
      const current = attendance[id]
      setScanFeedback({
        status:
          current?.status === 'present' || current?.status === 'late'
            ? 'duplicate'
            : 'success',
        name: match.student.fullName,
      })
      if (current?.status === 'present' || current?.status === 'late') return

      setScanUsed(true)
      playBeep('success')
      // Not available on iOS Safari
      if ('vibrate' in navigator) navigator.vibrate(100)
      form.setFieldValue('attendance', {
        ...attendance,
        [id]: { status: 'present', notes: current?.notes ?? '' },
      })
    },
    [form],
  )

  React.useEffect(() => {
    if (!scanFeedback) return
    const timer = setTimeout(() => setScanFeedback(null), 2000)
    return () => clearTimeout(timer)
  }, [scanFeedback])

  const absentStudents = classDetails?.students.filter((s) => {
    const status = values.attendance[s.student._id]?.status ?? 'present'
    return status === 'unexcused_absence' || status === 'excused_absence'
  })

  const handleSubmitClick = () => {
    if (scanUsed) setConfirmSubmitOpen(true)
    else void form.handleSubmit()
  }

  const handleBack = () => {
    if (isDirty) {
      setConfirmLeaveOpen(true)
    } else {
      void navigate({ to: `/classes/${classId}` })
    }
  }

  if (!classDetails || !semesters) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          icon={CheckCircle2}
          title={t('attendance.createSession.title')}
        />
        <div className="h-10 bg-muted animate-pulse rounded-lg" />
        <div className="h-64 bg-muted animate-pulse rounded-lg" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 pb-24 min-w-0">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={handleBack}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <PageHeader
          icon={CheckCircle2}
          title={t('attendance.createSession.title')}
          subtitle={classDetails.class.name}
        />
      </div>

      {/* Session Metadata Card */}
      <Card>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSubmitClick()
            }}
            className="grid gap-4 md:grid-cols-2"
          >
            <form.Field
              name="sessionDate"
              children={(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor="session-date">
                      {t('attendance.createSession.date')}{' '}
                      <span className="text-destructive">*</span>
                    </FieldLabel>
                    <Input
                      id="session-date"
                      name={field.name}
                      type="date"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      aria-invalid={isInvalid}
                    />
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            />

            <form.Field
              name="semesterId"
              children={(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor="session-semester">
                      {t('attendance.createSession.semester')}{' '}
                      <span className="text-destructive">*</span>
                    </FieldLabel>
                    <Select
                      value={field.state.value}
                      onValueChange={(val) => field.handleChange(val || '')}
                      items={semesterOptions}
                    >
                      <SelectTrigger id="session-semester" className="w-full">
                        <SelectValue
                          placeholder={t('attendance.createSession.semester')}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {semesterOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            />

            <form.Field
              name="sessionType"
              children={(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor="session-type">
                      {t('attendance.createSession.type')}
                    </FieldLabel>
                    <Select
                      value={field.state.value}
                      onValueChange={(val: any) => field.handleChange(val)}
                      items={[
                        {
                          label: t('attendance.createSession.type.catechism'),
                          value: 'catechism',
                        },
                        {
                          label: t(
                            'attendance.createSession.type.supplemental',
                          ),
                          value: 'supplemental',
                        },
                      ]}
                    >
                      <SelectTrigger id="session-type" className="w-full">
                        <SelectValue
                          placeholder={t('attendance.createSession.type')}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="catechism">
                          {t('attendance.createSession.type.catechism')}
                        </SelectItem>
                        <SelectItem value="supplemental">
                          {t('attendance.createSession.type.supplemental')}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            />

            <form.Field
              name="notes"
              children={(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor="session-notes">
                      {t('attendance.createSession.notes')}
                    </FieldLabel>
                    <Textarea
                      id="session-notes"
                      name={field.name}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      placeholder={t('attendance.popover.notesPlaceholder')}
                      rows={1}
                      className="resize-none"
                      aria-invalid={isInvalid}
                    />
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            />
          </form>
        </CardContent>
      </Card>

      {/* Summary Badge Count Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-2">
        <h3 className="text-lg font-semibold">
          {t('classes.detail.tabs.students')}
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={scanMode ? 'secondary' : 'default'}
            size="lg"
            onClick={handleToggleScan}
          >
            <QrCode />
            {scanMode
              ? t('attendance.createSession.scanStop')
              : t('attendance.createSession.scanStart')}
          </Button>
          <div className="text-sm font-medium text-muted-foreground bg-muted px-3 py-1.5 rounded-full shadow-inner">
            {t('attendance.createSession.summary', {
              total: summary.total,
              present: summary.present,
              late: summary.late,
              absent: summary.absent,
              excused: summary.excused,
            })}
          </div>
        </div>
      </div>

      {scanMode && (
        <div className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-xl border">
          <QRScanner
            active={
              !confirmLeaveOpen &&
              !confirmResetOpen &&
              !confirmSubmitOpen &&
              !isSubmitting
            }
            onScan={handleScan}
          />
          {scanFeedback && (
            <div
              role="status"
              className={`absolute inset-x-4 top-4 rounded-full px-4 py-2 text-center text-sm font-semibold text-white shadow-md ${
                scanFeedback.status === 'success'
                  ? 'bg-emerald-600'
                  : scanFeedback.status === 'duplicate'
                    ? 'bg-amber-500'
                    : 'bg-red-600'
              }`}
            >
              {scanFeedback.status === 'unknown'
                ? t('attendance.scanning.overlay.unknownLabel')
                : `${scanFeedback.name} — ${t(
                    scanFeedback.status === 'success'
                      ? 'attendance.scanning.overlay.success'
                      : 'attendance.scanning.overlay.duplicate',
                  )}`}
            </div>
          )}
        </div>
      )}

      {/* Student List */}
      {filteredStudents.length === 0 ? (
        <div className="text-center py-10 border border-dashed rounded-xl text-muted-foreground">
          {t('common.noResultsFound')}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredStudents.map(({ student }) => {
            const record = values.attendance[student._id] || {
              status: 'present' as const,
              notes: '',
            }
            const isExpanded = expandedStudentId === student._id
            const config = STATUS_CONFIG[record.status]
            const Icon = config.Icon

            return (
              <div
                key={student._id}
                id={`student-${student._id}`}
                className="relative border rounded-xl overflow-hidden bg-card flex justify-between items-center h-20 shadow-sm transition-all duration-300"
              >
                {/* Collapsed view left part (Always visible unless expanded covering it) */}
                <div className="pl-4 flex flex-col justify-center flex-1 pr-2 overflow-hidden">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {student.saintName && (
                      <span className="italic text-xs text-muted-foreground truncate max-w-[100px]">
                        {student.saintName}
                      </span>
                    )}
                    <span className="font-semibold text-sm text-foreground truncate min-w-0">
                      {student.fullName}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-0.5">
                    {student.studentCode}
                  </span>
                </div>

                {/* Collapsed state status button */}
                <button
                  type="button"
                  onClick={() => setExpandedStudentId(student._id)}
                  className={`h-full w-16 flex flex-col items-center justify-center cursor-pointer border-l ${config.bg} transition-colors duration-200 hover:brightness-95`}
                >
                  <Icon className="h-6 w-6 text-neutral-900" />
                </button>

                {/* Expanded state slide-out panel */}
                {isExpanded && (
                  <div className="absolute inset-0 bg-background flex items-center justify-end z-10 animate-in slide-in-from-right duration-200">
                    <div
                      className="flex-1 pl-4 pr-2 text-xs font-semibold text-muted-foreground truncate h-full flex items-center cursor-pointer"
                      onClick={() => setExpandedStudentId(null)}
                      title={student.fullName}
                    >
                      {student.fullName}
                    </div>
                    <div className="flex h-full border-l shrink-0">
                      {(
                        Object.keys(STATUS_CONFIG) as Array<AttendanceStatus>
                      ).map((st) => {
                        const opt = STATUS_CONFIG[st]
                        const OptIcon = opt.Icon
                        return (
                          <button
                            key={st}
                            type="button"
                            onClick={() => {
                              form.setFieldValue('attendance', {
                                ...values.attendance,
                                [student._id]: {
                                  status: st,
                                  notes:
                                    values.attendance[student._id]?.notes || '',
                                },
                              })
                              setExpandedStudentId(null)
                            }}
                            className={`h-full px-3 flex flex-col items-center justify-center gap-0.5 border-r last:border-r-0 cursor-pointer ${opt.bg} transition-colors duration-200 hover:brightness-95`}
                            style={{ minWidth: '64px' }}
                          >
                            <OptIcon className="h-4.5 w-4.5 text-neutral-900" />
                            <span className="text-[8px] font-extrabold text-neutral-900 uppercase tracking-tight text-center leading-none">
                              {t(opt.labelKey)}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Sticky Bottom Search Input & Save Actions */}
      <div className="fixed bottom-0 left-0 right-0 sm:left-[var(--sidebar-width)] z-50 p-4 border-t bg-background/80 backdrop-blur-md shadow-lg flex items-center gap-4 transition-[left] ease-linear duration-200">
        <InputGroup className="flex-1">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            type="text"
            placeholder={t('attendance.createSession.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </InputGroup>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={isSubmitting}
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSubmitClick}
            disabled={isSubmitting || !values.semesterId}
          >
            {isSubmitting
              ? t('common.saving')
              : t('attendance.createSession.submit')}
          </Button>
        </div>
      </div>

      {/* Reset to absent before scanning */}
      <AlertDialog open={confirmResetOpen} onOpenChange={setConfirmResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('attendance.createSession.scanResetTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('attendance.createSession.scanResetDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmResetOpen(false)
                enterScanMode()
              }}
            >
              {t('attendance.createSession.scanResetConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm absent list when submitting after scanning */}
      <AlertDialog open={confirmSubmitOpen} onOpenChange={setConfirmSubmitOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('attendance.createSession.scanSubmitTitle', {
                count: absentStudents?.length ?? 0,
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('attendance.createSession.scanSubmitDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {!!absentStudents?.length && (
            <ul className="max-h-48 overflow-y-auto rounded-md border p-2 text-sm">
              {absentStudents.map(({ student }) => (
                <li key={student._id}>
                  {student.saintName} {student.fullName}
                </li>
              ))}
            </ul>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.back')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmSubmitOpen(false)
                void form.handleSubmit()
              }}
            >
              {t('attendance.createSession.scanSubmitConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unsaved Changes AlertDialog */}
      <AlertDialog open={confirmLeaveOpen} onOpenChange={setConfirmLeaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('attendance.createSession.confirmLeaveTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('attendance.createSession.confirmLeaveDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmLeaveOpen(false)
                form.reset()
                void navigate({ to: `/classes/${classId}` })
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('classes.confirmLeave.discard')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
