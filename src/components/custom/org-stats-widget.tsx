import { useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { SchoolIcon } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { Skeleton } from '~/components/ui/skeleton'

interface OrgStatsWidgetProps {
  requesterId: Id<'catechists'>
  academicYearId: Id<'academicYears'>
}

export function OrgStatsWidget({
  requesterId,
  academicYearId,
}: OrgStatsWidgetProps) {
  const { t } = useTranslation()
  const data = useQuery(api.orgStats.getOrgStats, {
    requesterId,
    academicYearId,
  })

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
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SchoolIcon className="size-5 text-muted-foreground" />
          {t('dashboard.orgStats.title')}
        </CardTitle>
        <CardDescription>{t('dashboard.orgStats.description')}</CardDescription>
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
