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
  X,
} from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import { z } from 'zod'
import { format } from 'date-fns'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import type { FunctionReturnType } from 'convex/server'
import { useAuth } from '~/lib/auth'
import { formatPersonName, sortByNameFormat } from '~/lib/name'
import { playBeep } from '~/lib/beep'
import { translateConvexError } from '~/lib/convex-errors'
import { useSelectedAcademicYear } from '~/lib/academic-year'
import { PageHeader } from '~/components/page-header'
import { QRScanner } from '~/components/custom/qr-scanner'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '~/components/ui/combobox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
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

type AssignedCatechist = NonNullable<
  FunctionReturnType<typeof api.classes.getClassDetails>
>['assignedCatechists'][number]

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

const isAbsent = (status: AttendanceStatus) =>
  status === 'unexcused_absence' || status === 'excused_absence'

// Substitutes are only offered when every assigned catechist is absent
const allAssignedAbsent = (
  assigned: ReadonlyArray<{ catechist: { _id: string } }>,
  records: Record<string, StudentRecord | undefined>,
) =>
  assigned.length > 0 &&
  assigned.every(({ catechist }) =>
    isAbsent(records[catechist._id]?.status ?? 'present'),
  )

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

function AttendanceTile({
  id,
  saintName,
  fullName,
  subtitle,
  status,
  expanded,
  onExpand,
  onCollapse,
  onSelect,
}: {
  id: string
  saintName?: string | null
  fullName: string
  subtitle: React.ReactNode
  status: AttendanceStatus
  expanded: boolean
  onExpand: () => void
  onCollapse: () => void
  onSelect: (status: AttendanceStatus) => void
}) {
  const { t } = useTranslation()
  const config = STATUS_CONFIG[status]
  const Icon = config.Icon

  return (
    <div
      id={id}
      className="relative border rounded-xl overflow-hidden bg-card flex justify-between items-center h-20 shadow-sm transition-all duration-300"
    >
      {/* Collapsed view left part (Always visible unless expanded covering it) */}
      <div className="pl-4 flex flex-col justify-center flex-1 pr-2 overflow-hidden">
        <div className="flex items-center gap-1.5 min-w-0">
          {saintName && (
            <span className="italic text-xs text-muted-foreground truncate max-w-[100px]">
              {saintName}
            </span>
          )}
          <span className="font-semibold text-sm text-foreground truncate min-w-0">
            {fullName}
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
          {subtitle}
        </span>
      </div>

      {/* Collapsed state status button */}
      <button
        type="button"
        onClick={onExpand}
        className={`h-full w-16 flex flex-col items-center justify-center cursor-pointer border-l ${config.bg} transition-colors duration-200 hover:brightness-95`}
      >
        <Icon className="h-6 w-6 text-neutral-900" />
      </button>

      {/* Expanded state slide-out panel */}
      {expanded && (
        <div className="absolute inset-0 bg-background flex items-center justify-end z-10 animate-in slide-in-from-right duration-200">
          <div
            className="flex-1 pl-4 pr-2 text-xs font-semibold text-muted-foreground truncate h-full flex items-center cursor-pointer"
            onClick={onCollapse}
            title={fullName}
          >
            {fullName}
          </div>
          <div className="flex h-full border-l shrink-0">
            {(Object.keys(STATUS_CONFIG) as Array<AttendanceStatus>).map(
              (st) => {
                const opt = STATUS_CONFIG[st]
                const OptIcon = opt.Icon
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => onSelect(st)}
                    className={`h-full px-3 flex flex-col items-center justify-center gap-0.5 border-r last:border-r-0 cursor-pointer ${opt.bg} transition-colors duration-200 hover:brightness-95`}
                    style={{ minWidth: '64px' }}
                  >
                    <OptIcon className="h-4.5 w-4.5 text-neutral-900" />
                    <span className="text-[8px] font-extrabold text-neutral-900 uppercase tracking-tight text-center leading-none">
                      {t(opt.labelKey)}
                    </span>
                  </button>
                )
              },
            )}
          </div>
        </div>
      )}
    </div>
  )
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

  // Active, non-deleted assignments (homeroom + co-teacher), sorted like students
  const assignedCatechists = React.useMemo(
    () =>
      sortByNameFormat<AssignedCatechist>(
        (classDetails?.assignedCatechists ?? []).filter(
          (a) => a.catechist.isActive,
        ),
        (a) => a.catechist.fullName,
        appConfig?.nameFormat,
      ),
    [classDetails?.assignedCatechists, appConfig?.nameFormat],
  )

  const formSchema = React.useMemo(() => {
    const recordSchema = z.record(
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
    )
    return z.object({
      sessionDate: z.string().min(1, t('common.required')),
      sessionType: z.enum(['catechism', 'supplemental']),
      semesterId: z.string().min(1, t('common.required')),
      notes: z.string(),
      attendance: recordSchema,
      catechistAttendance: recordSchema,
      substituteIds: z.array(z.string()),
    })
  }, [t])

  const form = useForm({
    defaultValues: {
      sessionDate: todayStr,
      sessionType: 'catechism' as 'catechism' | 'supplemental',
      semesterId: '',
      notes: '',
      attendance: initialAttendance,
      catechistAttendance: initialAttendance,
      substituteIds: [] as Array<string>,
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

        const substituteRecords = allAssignedAbsent(
          assignedCatechists,
          value.catechistAttendance,
        )
          ? value.substituteIds.map((id) => ({
              catechistId: id as Id<'catechists'>,
              status: 'present' as const,
              roleAtSession: 'substitute' as const,
            }))
          : []
        const catechistPayload = [
          ...assignedCatechists.map(({ catechist }) => {
            const record = value.catechistAttendance[catechist._id]
            return {
              catechistId: catechist._id,
              status: record?.status ?? ('present' as const),
              notes: record?.notes ? record.notes : undefined,
            }
          }),
          ...substituteRecords,
        ]

        await createMutation({
          requesterId,
          classYearId: classDetails.classYear._id,
          semesterId: value.semesterId as Id<'semesters'>,
          sessionDate: value.sessionDate,
          sessionType: value.sessionType,
          notes: value.notes ? value.notes : undefined,
          attendance: attendancePayload,
          catechistAttendance: catechistPayload.length
            ? catechistPayload
            : undefined,
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
    if (values.substituteIds.length > 0) return true
    return [
      ...Object.values(values.attendance),
      ...Object.values(values.catechistAttendance),
    ].some((r) => r && (r.status !== 'present' || r.notes !== ''))
  }, [values, todayStr, defaultSemesterId])

  const allAbsent = allAssignedAbsent(
    assignedCatechists,
    values.catechistAttendance,
  )

  // Assigned catechists no longer all absent: drop picked substitutes
  React.useEffect(() => {
    if (!allAbsent && form.getFieldValue('substituteIds').length > 0) {
      form.setFieldValue('substituteIds', [])
    }
  }, [allAbsent, form])

  const allActiveCatechists = useQuery(
    api.catechists.listAllActive,
    requesterId && allAbsent ? { requesterId } : 'skip',
  )
  const substituteItems = React.useMemo(() => {
    const assignedIds = new Set<string>(
      (classDetails?.assignedCatechists ?? []).map((a) => a.catechist._id),
    )
    return (allActiveCatechists ?? [])
      .filter((c) => !assignedIds.has(c._id))
      .map((c) => ({
        value: c._id,
        label: formatPersonName(c.saintName, c.fullName),
      }))
  }, [allActiveCatechists, classDetails?.assignedCatechists])
  const pickedSubstitutes = values.substituteIds.map((id) => ({
    value: id,
    label: substituteItems.find((i) => i.value === id)?.label ?? id,
  }))
  const pickableSubstitutes = substituteItems.filter(
    (i) => !values.substituteIds.includes(i.value),
  )

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

  // Scan mode: unset students start absent; existing records are kept
  const enterScanMode = () => {
    const current = form.getFieldValue('attendance')
    const attendance: Record<string, StudentRecord> = {}
    classDetails?.students.forEach((s) => {
      attendance[s.student._id] = current[s.student._id] ?? {
        status: 'unexcused_absence',
        notes: '',
      }
    })
    form.setFieldValue('attendance', attendance)
    setScanMode(true)
  }

  const handleScanDialogChange = (open: boolean) => {
    if (open) return enterScanMode()
    setScanMode(false)
    setScanFeedback(null)
    // Nothing scanned: back to the default (everyone present)
    if (!scanUsed) form.setFieldValue('attendance', {})
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

      {/* Assigned catechists */}
      {assignedCatechists.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="border-b pb-2 text-lg font-semibold">
            {t('attendance.createSession.catechists')}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {assignedCatechists.map(({ catechist, role }) => (
              <AttendanceTile
                key={catechist._id}
                id={`catechist-${catechist._id}`}
                saintName={catechist.saintName}
                fullName={catechist.fullName}
                subtitle={
                  <>
                    {catechist.memberId}
                    <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
                      {t(`catechistAttendance.role.${role}`)}
                    </Badge>
                  </>
                }
                status={
                  values.catechistAttendance[catechist._id]?.status ?? 'present'
                }
                expanded={expandedStudentId === catechist._id}
                onExpand={() => setExpandedStudentId(catechist._id)}
                onCollapse={() => setExpandedStudentId(null)}
                onSelect={(status) => {
                  form.setFieldValue('catechistAttendance', {
                    ...values.catechistAttendance,
                    [catechist._id]: {
                      status,
                      notes:
                        values.catechistAttendance[catechist._id]?.notes ?? '',
                    },
                  })
                  setExpandedStudentId(null)
                }}
              />
            ))}
          </div>
          {allAbsent && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">
                {t('attendance.createSession.substitutes')}
              </span>
              <Combobox
                value={null as string | null}
                onValueChange={(val) =>
                  val &&
                  form.setFieldValue('substituteIds', [
                    ...values.substituteIds,
                    val,
                  ])
                }
                items={pickableSubstitutes}
              >
                <ComboboxInput
                  placeholder={t(
                    'attendance.createSession.substitutePlaceholder',
                  )}
                />
                <ComboboxContent>
                  <ComboboxList>
                    {pickableSubstitutes.map((item) => (
                      <ComboboxItem key={item.value} value={item.value}>
                        {item.label}
                      </ComboboxItem>
                    ))}
                  </ComboboxList>
                  <ComboboxEmpty>
                    {t('attendance.createSession.substituteEmpty')}
                  </ComboboxEmpty>
                </ComboboxContent>
              </Combobox>
              {pickedSubstitutes.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {pickedSubstitutes.map((sub) => (
                    <li key={sub.value}>
                      <Badge variant="secondary" className="gap-1 pr-1">
                        {sub.label}
                        <button
                          type="button"
                          aria-label={t(
                            'attendance.createSession.substituteRemove',
                          )}
                          className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                          onClick={() =>
                            form.setFieldValue(
                              'substituteIds',
                              values.substituteIds.filter(
                                (i) => i !== sub.value,
                              ),
                            )
                          }
                        >
                          <X className="size-3" />
                        </button>
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      )}

      {/* Summary Badge Count Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-2">
        <h3 className="text-lg font-semibold">
          {t('classes.detail.tabs.students')}
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="lg"
            onClick={() => handleScanDialogChange(true)}
          >
            <QrCode />
            {t('attendance.createSession.scanStart')}
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

      <Dialog open={scanMode} onOpenChange={handleScanDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('attendance.createSession.scanStart')}</DialogTitle>
            <DialogDescription className="sr-only">
              {t('attendance.createSession.scanStart')}
            </DialogDescription>
          </DialogHeader>
          <div className="relative mx-auto aspect-square w-full overflow-hidden rounded-xl border">
            <QRScanner
              active={!confirmLeaveOpen && !confirmSubmitOpen && !isSubmitting}
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
        </DialogContent>
      </Dialog>

      {/* Student List */}
      {filteredStudents.length === 0 ? (
        <div className="text-center py-10 border border-dashed rounded-xl text-muted-foreground">
          {t('common.noResultsFound')}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredStudents.map(({ student }) => (
            <AttendanceTile
              key={student._id}
              id={`student-${student._id}`}
              saintName={student.saintName}
              fullName={student.fullName}
              subtitle={student.studentCode}
              status={values.attendance[student._id]?.status ?? 'present'}
              expanded={expandedStudentId === student._id}
              onExpand={() => setExpandedStudentId(student._id)}
              onCollapse={() => setExpandedStudentId(null)}
              onSelect={(status) => {
                form.setFieldValue('attendance', {
                  ...values.attendance,
                  [student._id]: {
                    status,
                    notes: values.attendance[student._id]?.notes || '',
                  },
                })
                setExpandedStudentId(null)
              }}
            />
          ))}
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
