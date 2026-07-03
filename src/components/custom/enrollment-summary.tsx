import { useCallback, type FC, type ComponentProps } from 'react'
import { useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { Badge } from '~/components/ui/badge'
import { Skeleton } from '~/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  PencilIcon,
  PercentCircleIcon,
} from 'lucide-react'

interface EnrollmentSummaryProps {
  studentClassId: Id<'studentClasses'>
  requesterId: Id<'catechists'>
}

const MORALITY_VARIANT: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  excellent: 'default',
  good: 'default',
  average: 'secondary',
  below_average: 'destructive',
  poor: 'destructive',
}

const StatBlock: FC<
  {
    label: string
    value: string | number
    icon: React.ReactNode
  } & ComponentProps<typeof Card>
> = ({ label, value, icon, ...props }) => {
  return (
    <Card {...props}>
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
}

export function EnrollmentSummary({
  studentClassId,
  requesterId,
}: EnrollmentSummaryProps) {
  const { t } = useTranslation()

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
            <StatBlock
              label={t('students.enrollments.summary.attendance.present')}
              value={data.attendance.present}
              className="ring-2 ring-green-500/20"
              icon={<CheckCircleIcon />}
            />
            <StatBlock
              label={t('students.enrollments.summary.attendance.late')}
              value={data.attendance.late}
              className="ring-2 ring-yellow-500/20"
              icon={<ClockIcon />}
            />
            <StatBlock
              label={t(
                'students.enrollments.summary.attendance.excusedAbsence',
              )}
              value={data.attendance.excusedAbsence}
              className="ring-2 ring-purple-500/20"
              icon={<AlertCircleIcon />}
            />
            <StatBlock
              label={t(
                'students.enrollments.summary.attendance.unexcusedAbsence',
              )}
              value={data.attendance.unexcusedAbsence}
              className="ring-2 ring-red-500/20"
              icon={<AlertTriangleIcon />}
            />
            <StatBlock
              label={t('students.enrollments.summary.attendance.rate')}
              value={`${(data.attendance.rate * 100).toFixed(1)}%`}
              className="ring-2 ring-blue-500/20"
              icon={<PercentCircleIcon />}
            />
          </div>
          {data.attendance.total === 0 && (
            <p className="mt-3 text-sm text-muted-foreground">
              {t('students.enrollments.summary.attendance.noRecord')}
            </p>
          )}
        </TabsContent>

        <TabsContent value="grading">
          {data.grading.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('students.enrollments.summary.grading.noRecord')}
            </p>
          ) : (
            <div className="flex flex-col gap-4 md:grid md:grid-cols-2 lg:grid-cols-3">
              {data.grading.map((semester) => (
                <Card key={semester.semesterId}>
                  <CardHeader>
                    <CardTitle>{semesterLabel(semester)}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="flex flex-col gap-1.5 divide-y divide-border">
                      {semester.exams.map((exam) => (
                        <li
                          key={`${exam.columnType}-${exam.columnName}`}
                          className="flex items-center justify-between gap-2 text-sm pb-2"
                        >
                          <div className="flex flex-col items-start gap-1">
                            <div>{exam.columnName}</div>
                            <div className="text-xs text-accent-foreground">
                              {t(`exams.create.type.${exam.columnType}`, {
                                defaultValue: exam.columnType,
                              })}
                            </div>
                          </div>
                          <span className="font-medium text-xl rounded p-2 bg-muted text-muted-foreground">
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
                <CardTitle>
                  {t('students.enrollments.summary.semester.title')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.semesterResults.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t('students.enrollments.summary.semester.noRecord')}
                  </p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {data.semesterResults.map((result) => (
                      <li
                        key={result.semesterId}
                        className="border-b pb-2 last:border-0 last:pb-0"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {semesterLabel(result)}
                          </span>
                          {result.morality && (
                            <Badge
                              variant={
                                MORALITY_VARIANT[result.morality] ?? 'outline'
                              }
                            >
                              {t(`evaluations.morality.${result.morality}`)}
                            </Badge>
                          )}
                          {result.isCompleted !== undefined && (
                            <Badge
                              variant={
                                result.isCompleted ? 'default' : 'secondary'
                              }
                            >
                              {result.isCompleted
                                ? t('evaluations.isCompleted')
                                : t('students.status.withdrawn')}
                            </Badge>
                          )}
                        </div>
                        {result.teacherNote && (
                          <p className="mt-1 text-sm text-muted-foreground italic flex items-center gap-1">
                            <PencilIcon className="size-4" />
                            {result.teacherNote}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  {t('students.enrollments.summary.annual.title')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!data.annualResult ? (
                  <p className="text-sm text-muted-foreground">
                    {t('students.enrollments.summary.annual.noRecord')}
                  </p>
                ) : (
                  <div>
                    <div className="flex items-center gap-2">
                      {data.annualResult.conductGrade && (
                        <Badge
                          variant={
                            MORALITY_VARIANT[data.annualResult.conductGrade] ??
                            'outline'
                          }
                        >
                          {t(
                            `evaluations.morality.${data.annualResult.conductGrade}`,
                          )}
                        </Badge>
                      )}
                      {data.annualResult.isCompleted !== undefined && (
                        <Badge
                          variant={
                            data.annualResult.isCompleted
                              ? 'default'
                              : 'secondary'
                          }
                        >
                          {data.annualResult.isCompleted
                            ? t('evaluations.isCompleted')
                            : t('students.status.withdrawn')}
                        </Badge>
                      )}
                    </div>
                    {data.annualResult.remark && (
                      <p className="mt-1 text-sm text-muted-foreground italic flex items-center gap-1">
                        <PencilIcon className="size-4" />
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
