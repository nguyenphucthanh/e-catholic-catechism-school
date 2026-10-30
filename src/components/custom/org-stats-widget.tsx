import { useTranslation } from 'react-i18next'
import { RefreshCw, SchoolIcon } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { Button } from '~/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { Skeleton } from '~/components/ui/skeleton'
import { useOneShotQuery } from '~/hooks/use-one-shot-query'

interface OrgStatsWidgetProps {
  academicYearId: Id<'academicYears'>
}

export function OrgStatsWidget({ academicYearId }: OrgStatsWidgetProps) {
  const { t } = useTranslation()
  // One-shot: a reactive query would re-run on every enrollment/student write.
  const { data, isRefreshing, refresh } = useOneShotQuery(
    api.orgStats.getOrgStats,
    { academicYearId },
  )

  if (data === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SchoolIcon className="size-5 text-muted-foreground" />
            {t('dashboard.orgStats.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="flex flex-col gap-1.5">
          <CardTitle className="flex items-center gap-2">
            <SchoolIcon className="size-5 text-muted-foreground" />
            {t('dashboard.orgStats.title')}
          </CardTitle>
          <CardDescription>
            {t('dashboard.orgStats.description')}
          </CardDescription>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('dashboard.orgStats.refresh')}
          disabled={isRefreshing}
          onClick={refresh}
        >
          <RefreshCw
            className={isRefreshing ? 'size-4 animate-spin' : 'size-4'}
          />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-sm text-muted-foreground">
              {t('dashboard.orgStats.totalClasses')}
            </div>
            <div className="text-2xl font-bold tabular-nums">
              {data.totalClasses || 0}
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">
              {t('dashboard.orgStats.totalStudents')}
            </div>
            <div className="text-2xl font-bold tabular-nums">
              {data.totalStudents || 0}
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">
              {t('dashboard.orgStats.totalCatechists')}
            </div>
            <div className="text-2xl font-bold tabular-nums">
              {data.totalCatechists || 0}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
