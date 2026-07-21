import { useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { Link } from '@tanstack/react-router'
import { endOfWeek, format, startOfWeek } from 'date-fns'
import { CalendarClock, ClipboardCheckIcon } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { formatDate } from '~/lib/locale'
import { Badge } from '~/components/ui/badge'
import { buttonVariants } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Skeleton } from '~/components/ui/skeleton'

const DATE_FORMAT = 'yyyy-MM-dd'

export function TodayThisWeekWidget({
  requesterId,
  academicYearId,
}: {
  requesterId: Id<'catechists'>
  academicYearId: Id<'academicYears'> | null
}) {
  const { t } = useTranslation()
  const today = format(new Date(), DATE_FORMAT)
  const dateFrom = format(
    startOfWeek(new Date(), { weekStartsOn: 1 }),
    DATE_FORMAT,
  )
  const dateTo = format(endOfWeek(new Date(), { weekStartsOn: 1 }), DATE_FORMAT)

  const sessions = useQuery(
    api.classSessions.listMySessionsInRange,
    academicYearId ? { requesterId, academicYearId, dateFrom, dateTo } : 'skip',
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="size-5 text-muted-foreground" />
          {t('dashboard.todayThisWeek.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {sessions === undefined ? (
          <div className="flex flex-col gap-2 p-4">
            {['a', 'b', 'c'].map((key) => (
              <Skeleton key={key} className="h-14 w-full" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground p-4">
            {t('dashboard.todayThisWeek.empty')}
          </p>
        ) : (
          <div className="flex flex-col gap-2 divide-y *:pb-2">
            {sessions.map((session) => {
              const isDone =
                session.studentCount > 0 &&
                session.recordedCount >= session.studentCount
              const isOverdue = !isDone && session.sessionDate < today

              return (
                <div
                  key={session.sessionId}
                  className="flex flex-col gap-2 p-4"
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 justify-between">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{session.className}</p>
                        <Badge variant="outline">
                          {t(`attendance.sessionType.${session.sessionType}`)}
                        </Badge>
                      </div>
                      {isDone ? (
                        <Badge variant="secondary">
                          {t('dashboard.todayThisWeek.done')}
                        </Badge>
                      ) : isOverdue ? (
                        <Badge variant="destructive">
                          {t('dashboard.todayThisWeek.overdue')}
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          {t('dashboard.todayThisWeek.pending')}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{formatDate(session.sessionDate)}</span>
                      <span className="tabular-nums">
                        {t('dashboard.todayThisWeek.recorded', {
                          recorded: session.recordedCount,
                          total: session.studentCount,
                        })}
                      </span>
                    </div>
                  </div>
                  <Link
                    to="/classes/$id"
                    params={{ id: session.classId }}
                    search={{ tab: 'attendance' }}
                    className={buttonVariants({ size: 'sm' })}
                  >
                    <ClipboardCheckIcon className="size-4" />
                    {t('dashboard.myClasses.takeAttendance')}
                  </Link>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
