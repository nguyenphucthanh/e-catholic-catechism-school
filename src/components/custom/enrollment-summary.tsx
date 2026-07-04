import { useCallback, useMemo, useState } from 'react'
import { useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  AwardIcon,
  BookOpenIcon,
  CheckCircle2Icon,
  ClipboardCheckIcon,
  ClockIcon,
  GraduationCapIcon,
  NotebookPenIcon,
  PencilIcon,
  PercentCircleIcon,
  XCircleIcon,
} from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card'
import type { ComponentProps, FC } from 'react'
import type { Id } from '../../../convex/_generated/dataModel'
import { formatDate } from '~/lib/locale'
import { Badge } from '~/components/ui/badge'
import { Skeleton } from '~/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'

interface EnrollmentSummaryProps {
  studentClassId: Id<'studentClasses'>
  requesterId: Id<'catechists'>
}

type AttendanceStatus =
  'present' | 'late' | 'excused_absence' | 'unexcused_absence'

const ATTENDANCE_STYLE: Record<
  AttendanceStatus,
  { icon: React.ReactNode; card: string; chip: string }
> = {
  present: {
    icon: <CheckCircle2Icon className="size-5" />,
    card: 'border-green-500/30 bg-green-500/10 text-green-800 dark:text-green-200',
    chip: 'bg-green-500/15 text-green-700 dark:text-green-300',
  },
  late: {
    icon: <ClockIcon className="size-5" />,
    card: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-800 dark:text-yellow-200',
    chip: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300',
  },
  excused_absence: {
    icon: <AlertCircleIcon className="size-5" />,
    card: 'border-purple-500/30 bg-purple-500/10 text-purple-800 dark:text-purple-200',
    chip: 'bg-purple-500/15 text-purple-700 dark:text-purple-300',
  },
  unexcused_absence: {
    icon: <AlertTriangleIcon className="size-5" />,
    card: 'border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-200',
    chip: 'bg-red-500/15 text-red-700 dark:text-red-300',
  },
}

const ATTENDANCE_STAT_CONFIG: Array<{
  status: AttendanceStatus
  dataKey: 'present' | 'late' | 'excusedAbsence' | 'unexcusedAbsence'
  labelKey: string
}> = [
  {
    status: 'present',
    dataKey: 'present',
    labelKey: 'students.enrollments.summary.attendance.present',
  },
  {
    status: 'late',
    dataKey: 'late',
    labelKey: 'students.enrollments.summary.attendance.late',
  },
  {
    status: 'excused_absence',
    dataKey: 'excusedAbsence',
    labelKey: 'students.enrollments.summary.attendance.excusedAbsence',
  },
  {
    status: 'unexcused_absence',
    dataKey: 'unexcusedAbsence',
    labelKey: 'students.enrollments.summary.attendance.unexcusedAbsence',
  },
]

const EXAM_TYPE_ICON: Record<string, React.ReactNode> = {
  short_quiz: <NotebookPenIcon className="size-4" />,
  midterm_test: <ClipboardCheckIcon className="size-4" />,
  semester_exam: <AwardIcon className="size-4" />,
}

const MORALITY_TEXT_COLOR: Record<string, string> = {
  excellent: 'text-green-700 dark:text-green-300',
  good: 'text-green-700 dark:text-green-300',
  average: 'text-foreground',
  below_average: 'text-red-600 dark:text-red-400',
  poor: 'text-red-600 dark:text-red-400',
}

function ResultMiniCard({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={`rounded-md border bg-muted/40 px-3 py-2 ${className ?? ''}`}
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-medium">{children}</div>
    </div>
  )
}

function CompletionMiniCard({
  isCompleted,
  t,
}: {
  isCompleted: boolean
  t: (key: string) => string
}) {
  return (
    <ResultMiniCard label={t('students.enrollments.summary.completionLabel')}>
      <span className="flex items-center gap-1.5">
        {isCompleted ? (
          <CheckCircle2Icon className="size-4 shrink-0 text-green-600 dark:text-green-400" />
        ) : (
          <XCircleIcon className="size-4 shrink-0 text-red-500 dark:text-red-400" />
        )}
        {isCompleted
          ? t('evaluations.isCompleted')
          : t('students.status.withdrawn')}
      </span>
    </ResultMiniCard>
  )
}

const StatBlock: FC<
  {
    label: string
    value: string | number
    icon: React.ReactNode
    onClick?: () => void
  } & ComponentProps<typeof Card>
> = ({ label, value, icon, onClick, className, ...props }) => {
  const card = (
    <Card
      className={
        onClick
          ? `h-full transition-shadow hover:shadow-md ${className ?? ''}`
          : className
      }
      {...props}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-center">
          {icon && <div className="">{icon}</div>}
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  )

  if (!onClick) return card

  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {card}
    </button>
  )
}

function AttendanceRecordsDialog({
  studentClassId,
  requesterId,
  status,
  onOpenChange,
}: {
  studentClassId: Id<'studentClasses'>
  requesterId: Id<'catechists'>
  status: AttendanceStatus | null
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()

  const records = useQuery(
    api.attendance.listAttendanceRecordsForStudentClass,
    status ? { requesterId, studentClassId } : 'skip',
  )

  const filtered = useMemo(
    () => records?.filter((r) => r.status === status) ?? [],
    [records, status],
  )

  const isAbsence =
    status === 'excused_absence' || status === 'unexcused_absence'

  return (
    <Dialog open={status !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {status && ATTENDANCE_STYLE[status].icon}
            {status && t(`attendance.status.${status}`)}
          </DialogTitle>
        </DialogHeader>

        {records === undefined ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('students.enrollments.summary.attendance.records.empty')}
          </p>
        ) : (
          <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
            {filtered.map((record) => (
              <li key={record._id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {formatDate(record.sessionDate)}
                  </span>
                  <Badge variant="outline">
                    {t(`attendance.sessionType.${record.sessionType}`)}
                  </Badge>
                </div>
                {isAbsence && (
                  <p className="mt-1.5 text-muted-foreground">
                    <span className="font-medium">
                      {t(
                        'students.enrollments.summary.attendance.records.reason',
                      )}
                      :{' '}
                    </span>
                    {record.notes ||
                      t(
                        'students.enrollments.summary.attendance.records.noReason',
                      )}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function EnrollmentSummary({
  studentClassId,
  requesterId,
}: EnrollmentSummaryProps) {
  const { t } = useTranslation()
  const [selectedStatus, setSelectedStatus] = useState<AttendanceStatus | null>(
    null,
  )

  const data = useQuery(api.students.getEnrollmentSummary, {
    requesterId,
    studentClassId,
  })

  const semesterLabel = useCallback(
    (info: { semesterName?: string; semesterNumber: number }) =>
      info.semesterName ||
      t('students.enrollments.summary.grading.semesterLabel', {
        number: info.semesterNumber,
      }),
    [t],
  )

  if (data === undefined) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (data === null) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        {t('students.enrollments.noRecord')}
      </p>
    )
  }

  return (
    <div className="p-4">
      <Tabs defaultValue="attendance">
        <TabsList>
          <TabsTrigger value="attendance">
            {t('students.enrollments.summary.tabs.attendance')}
          </TabsTrigger>
          <TabsTrigger value="grading">
            {t('students.enrollments.summary.tabs.grading')}
          </TabsTrigger>
          <TabsTrigger value="semesterYear">
            {t('students.enrollments.summary.tabs.semesterYear')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="attendance">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {ATTENDANCE_STAT_CONFIG.map(({ status, dataKey, labelKey }) => (
              <StatBlock
                key={status}
                label={t(labelKey)}
                value={data.attendance[dataKey]}
                className={ATTENDANCE_STYLE[status].card}
                icon={ATTENDANCE_STYLE[status].icon}
                onClick={() => setSelectedStatus(status)}
              />
            ))}
            <StatBlock
              label={t('students.enrollments.summary.attendance.rate')}
              value={`${(data.attendance.rate * 100).toFixed(1)}%`}
              className="border-blue-500/30 bg-blue-500/10 text-blue-800 dark:text-blue-200"
              icon={<PercentCircleIcon className="size-5" />}
            />
          </div>
          {data.attendance.total === 0 && (
            <p className="mt-3 text-sm text-muted-foreground">
              {t('students.enrollments.summary.attendance.noRecord')}
            </p>
          )}

          <AttendanceRecordsDialog
            studentClassId={studentClassId}
            requesterId={requesterId}
            status={selectedStatus}
            onOpenChange={(open) => !open && setSelectedStatus(null)}
          />
        </TabsContent>

        <TabsContent value="grading">
          {data.grading.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('students.enrollments.summary.grading.noRecord')}
            </p>
          ) : (
            <div className="flex flex-col gap-4 md:grid md:grid-cols-2 lg:grid-cols-3">
              {data.grading.map((semester) => (
                <Card key={semester.semesterId} className="ring-primary/10">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <GraduationCapIcon className="size-5 text-primary" />
                      {semesterLabel(semester)}
                    </CardTitle>
                    <CardDescription>
                      {t('students.enrollments.summary.grading.examCount', {
                        count: semester.exams.length,
                      })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="flex flex-col gap-2">
                      {semester.exams.map((exam) => (
                        <li
                          key={`${exam.columnType}-${exam.columnName}`}
                          className="flex items-center justify-between gap-3 rounded-lg border p-2.5 text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                              {EXAM_TYPE_ICON[exam.columnType] ?? (
                                <BookOpenIcon className="size-4" />
                              )}
                            </div>
                            <div className="flex flex-col items-start">
                              <span className="font-medium">
                                {exam.columnName}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {t(`exams.create.type.${exam.columnType}`, {
                                  defaultValue: exam.columnType,
                                })}
                              </span>
                            </div>
                          </div>
                          <span className="rounded-full bg-primary/10 px-3 py-1 text-base font-semibold text-primary">
                            {exam.scoreValue ?? exam.scoreLabel ?? '—'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="semesterYear">
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCapIcon className="size-5 text-primary" />
                  {t('students.enrollments.summary.semester.title')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.semesterResults.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t('students.enrollments.summary.semester.noRecord')}
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {data.semesterResults.map((result) => (
                      <li
                        key={result.semesterId}
                        className="rounded-lg border p-3"
                      >
                        <div className="text-sm font-medium">
                          {semesterLabel(result)}
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          {result.morality && (
                            <ResultMiniCard label={t('evaluations.morality')}>
                              <span
                                className={
                                  MORALITY_TEXT_COLOR[result.morality] ??
                                  'text-foreground'
                                }
                              >
                                {t(`evaluations.morality.${result.morality}`)}
                              </span>
                            </ResultMiniCard>
                          )}
                          {result.isCompleted !== undefined && (
                            <CompletionMiniCard
                              isCompleted={result.isCompleted}
                              t={t}
                            />
                          )}
                        </div>
                        {result.teacherNote && (
                          <p className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground italic">
                            <PencilIcon className="mt-0.5 size-4 shrink-0" />
                            {result.teacherNote}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="border-amber-500/30 ring-amber-500/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                  <AwardIcon className="size-5 text-amber-500" />
                  {t('students.enrollments.summary.annual.title')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!data.annualResult ? (
                  <p className="text-sm text-muted-foreground">
                    {t('students.enrollments.summary.annual.noRecord')}
                  </p>
                ) : (
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                    <div className="grid grid-cols-2 gap-2">
                      {data.annualResult.conductGrade && (
                        <ResultMiniCard
                          label={t('evaluations.morality')}
                          className="border-amber-500/20 bg-amber-500/10"
                        >
                          <span
                            className={
                              MORALITY_TEXT_COLOR[
                                data.annualResult.conductGrade
                              ] ?? 'text-foreground'
                            }
                          >
                            {t(
                              `evaluations.morality.${data.annualResult.conductGrade}`,
                            )}
                          </span>
                        </ResultMiniCard>
                      )}
                      {data.annualResult.isCompleted !== undefined && (
                        <CompletionMiniCard
                          isCompleted={data.annualResult.isCompleted}
                          t={t}
                        />
                      )}
                    </div>
                    {data.annualResult.remark && (
                      <p className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground italic">
                        <PencilIcon className="mt-0.5 size-4 shrink-0" />
                        {data.annualResult.remark}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
