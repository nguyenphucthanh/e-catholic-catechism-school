import { useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { Link } from '@tanstack/react-router'
import { HeartPulse, Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { Badge } from '~/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Skeleton } from '~/components/ui/skeleton'

function rateBadgeClassName(rate: number): string {
  if (rate >= 90) {
    return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
  }
  if (rate >= 80) {
    return 'bg-amber-500/10 text-amber-500 border-amber-500/20'
  }
  return 'bg-destructive/10 text-destructive border-destructive/20'
}

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'flat' }) {
  if (trend === 'up') {
    return <TrendingUp className="size-4 text-emerald-500" />
  }
  if (trend === 'down') {
    return <TrendingDown className="size-4 text-destructive" />
  }
  return <Minus className="size-4 text-muted-foreground" />
}

export function AttendanceHealthWidget({
  requesterId,
  academicYearId,
  dateFrom,
  dateTo,
}: {
  requesterId: Id<'catechists'>
  academicYearId: Id<'academicYears'> | null
  dateFrom: string
  dateTo: string
}) {
  const { t } = useTranslation()
  const health = useQuery(
    api.attendanceHealth.getMyAttendanceHealth,
    academicYearId ? { requesterId, academicYearId, dateFrom, dateTo } : 'skip',
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HeartPulse className="size-5 text-muted-foreground" />
          {t('dashboard.attendanceHealth.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {health === undefined ? (
          <div className="flex flex-col gap-2">
            {['a', 'b', 'c'].map((key) => (
              <Skeleton key={key} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <>
            <div className="@container">
              {health.classSummaries.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('dashboard.attendanceHealth.empty')}
                </p>
              ) : (
                <div className="grid gap-2 @md:grid-cols-2 @lg:grid-cols-3">
                  {health.classSummaries.map((summary) => (
                    <Link
                      key={summary.classId}
                      className="flex items-center justify-between gap-2 rounded-lg border p-3 group"
                      to={'/classes/$id'}
                      params={{ id: summary.classId }}
                    >
                      <p className="font-medium text-primary group-hover:underline">
                        {summary.className}
                      </p>
                      <div className="flex items-center gap-2">
                        <TrendIcon trend={summary.trend} />
                        {summary.rate === null ? (
                          <Badge variant="outline">
                            {t('dashboard.attendanceHealth.noData')}
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className={`${rateBadgeClassName(summary.rate)} tabular-nums`}
                          >
                            {summary.rate}%
                          </Badge>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">
                {t('dashboard.attendanceHealth.atRiskTitle')}
              </p>
              {health.atRiskStudents.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('dashboard.attendanceHealth.atRiskEmpty')}
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {health.atRiskStudents.map((student) => (
                    <div
                      key={student.studentClassId}
                      className="flex items-center justify-between gap-2 rounded-lg border p-3"
                    >
                      <div className="flex flex-col">
                        <Link
                          to="/students/$id"
                          params={{ id: student.studentId }}
                          className="font-medium hover:underline"
                        >
                          {student.fullName}
                        </Link>
                        <p className="text-sm text-muted-foreground">
                          {student.className}
                        </p>
                      </div>
                      <Badge variant="destructive" className="tabular-nums">
                        {t('dashboard.attendanceHealth.consecutiveAbsences', {
                          count: student.consecutiveAbsences,
                        })}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
