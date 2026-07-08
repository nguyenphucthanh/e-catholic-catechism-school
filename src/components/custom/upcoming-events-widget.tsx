import { useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { Link } from '@tanstack/react-router'
import { addDays, format } from 'date-fns'
import { CalendarDays, SignalHigh, SignalLow, SignalMedium } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { formatDate } from '~/lib/locale'
import { Badge } from '~/components/ui/badge'
import { buttonVariants } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Skeleton } from '~/components/ui/skeleton'

const DATE_FORMAT = 'yyyy-MM-dd'

function SeverityBadge({ severity }: { severity: 'high' | 'medium' | 'low' }) {
  const { t } = useTranslation()
  switch (severity) {
    case 'high':
      return (
        <span
          className="text-destructive inline-flex"
          title={t('calendarEvents.severity.high')}
        >
          <SignalHigh className="size-5" />
          <span className="sr-only">{t('calendarEvents.severity.high')}</span>
        </span>
      )
    case 'medium':
      return (
        <span
          className="text-yellow-600 dark:text-yellow-400 inline-flex"
          title={t('calendarEvents.severity.medium')}
        >
          <SignalMedium className="size-5" />
          <span className="sr-only">{t('calendarEvents.severity.medium')}</span>
        </span>
      )
    case 'low':
    default:
      return (
        <span
          className="text-muted-foreground inline-flex"
          title={t('calendarEvents.severity.low')}
        >
          <SignalLow className="size-5" />
          <span className="sr-only">{t('calendarEvents.severity.low')}</span>
        </span>
      )
  }
}

function extractPlainText(serialized: string): string {
  try {
    const doc = JSON.parse(serialized)
    const parts: Array<string> = []
    const walk = (node: unknown) => {
      if (!node || typeof node !== 'object') return
      const { text, content } = node as { text?: unknown; content?: unknown }
      if (typeof text === 'string') parts.push(text)
      if (Array.isArray(content)) content.forEach(walk)
    }
    walk(doc)
    return parts.join(' ').trim()
  } catch {
    return serialized
  }
}

export function UpcomingEventsWidget({
  requesterId,
  academicYearId,
}: {
  requesterId: Id<'catechists'>
  academicYearId: Id<'academicYears'> | null
}) {
  const { t } = useTranslation()
  const now = new Date()
  const today = format(now, DATE_FORMAT)
  const dateTo = format(addDays(now, 28), DATE_FORMAT)

  const events = useQuery(
    api.calendarEvents.list,
    academicYearId
      ? {
          requesterId,
          academicYearId,
          dateFrom: today,
          dateTo,
        }
      : 'skip',
  )

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="size-5 text-muted-foreground" />
          {t('dashboard.upcomingEvents.title')}
        </CardTitle>
        <Link
          to="/calendar-events"
          className={buttonVariants({ variant: 'ghost', size: 'sm' })}
        >
          {t('dashboard.upcomingEvents.viewAll')}
        </Link>
      </CardHeader>
      <CardContent>
        {events === undefined ? (
          <div className="flex flex-col gap-2">
            {['a', 'b', 'c'].map((key) => (
              <Skeleton key={key} className="h-16 w-full" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('dashboard.upcomingEvents.empty')}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {events.map((event) => (
              <div
                key={event._id}
                className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-col gap-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <SeverityBadge severity={event.severity} />
                    <span className="text-sm font-medium">
                      {formatDate(event.date)}
                    </span>
                    {event.liturgicalDate && (
                      <span className="text-xs font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        {event.liturgicalDate}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-foreground line-clamp-2 mt-1 break-words">
                    {extractPlainText(event.description)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <Badge variant="outline">
                    {t(`calendarEvents.scope.${event.scope}`)}
                  </Badge>
                  {event.scope === 'branch' && event.branchName && (
                    <span className="text-xs text-muted-foreground">
                      {event.branchName}
                    </span>
                  )}
                  {event.scope === 'class' && event.className && (
                    <span className="text-xs text-muted-foreground">
                      {event.className}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
