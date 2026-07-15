import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { ClipboardList } from 'lucide-react'
import { useMemo } from 'react'
import type { Id } from '~/../convex/_generated/dataModel'
import { api } from '~/../convex/_generated/api'
import { useAuth } from '~/lib/auth'
import { formatDateTime } from '~/lib/locale'
import { PageHeader } from '~/components/page-header'
import { Badge } from '~/components/ui/badge'
import { Card, CardContent } from '~/components/ui/card'
import { Skeleton } from '~/components/ui/skeleton'

export const Route = createFileRoute('/_authenticated/_student/my-attendance')({
  component: MyAttendancePage,
  staticData: { crumb: 'nav.myAttendance' },
})

function groupByMonth<T extends { deviceQueuedAt: number }>(
  records: Array<T>,
  locale: string,
) {
  const groups = new Map<string, Array<T>>()
  for (const record of records) {
    const key = new Date(record.deviceQueuedAt).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
    })
    const group = groups.get(key)
    if (group) {
      group.push(record)
    } else {
      groups.set(key, [record])
    }
  }
  return groups
}

function MyAttendancePage() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()

  const records = useQuery(api.parishAttendance.listMyParishAttendance, {
    requesterId: user?.userDocId as Id<'students'>,
  })

  const groups = useMemo(
    () => (records ? groupByMonth(records, i18n.language) : null),
    [records, i18n.language],
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader icon={ClipboardList} title={t('nav.myAttendance')} />

      {records === undefined ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : records.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t('myAttendance.empty')}
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {Array.from(groups ?? []).map(([month, monthRecords]) => (
            <div key={month} className="flex flex-col gap-2">
              <h3 className="text-sm font-medium text-muted-foreground uppercase">
                {month}
              </h3>
              <Card className="p-0" size="sm">
                <CardContent className="flex flex-col divide-y p-0">
                  {monthRecords.map((record) => (
                    <div
                      key={record._id}
                      className="flex flex-wrap items-center justify-between gap-2 p-4"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">
                          {formatDateTime(record.deviceQueuedAt)}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {t('myAttendance.recordedBy', {
                            name: record.recordedByCatechistName,
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {t(`attendance.sessionType.${record.sessionType}`)}
                        </Badge>
                        <Badge variant="secondary">
                          {t(`attendance.status.${record.status}`)}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
