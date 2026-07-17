import { useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { GitBranchIcon } from 'lucide-react'
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

interface BranchStatsWidgetProps {
  requesterId: Id<'catechists'>
  academicYearId: Id<'academicYears'>
}

export function BranchStatsWidget({
  requesterId,
  academicYearId,
}: BranchStatsWidgetProps) {
  const { t } = useTranslation()
  const data = useQuery(api.branchStats.getBranchStats, {
    requesterId,
    academicYearId,
  })

  if (data === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.branchStats.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20" />
        </CardContent>
      </Card>
    )
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranchIcon className="size-5 text-muted-foreground" />
            {t('dashboard.branchStats.title')}
          </CardTitle>
          <CardDescription>
            {t('dashboard.branchStats.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            {t('dashboard.branchStats.empty')}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitBranchIcon className="size-5 text-muted-foreground" />
          {t('dashboard.branchStats.title')}
        </CardTitle>
        <CardDescription>
          {t('dashboard.branchStats.description')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((branch) => (
            <div
              key={branch.branchId}
              className="p-3 border rounded-lg space-y-2"
            >
              <div className="font-semibold">{branch.branchName}</div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <div className="text-muted-foreground">
                    {t('dashboard.branchStats.classes')}
                  </div>
                  <div className="font-bold tabular-nums">
                    {branch.classCount}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">
                    {t('dashboard.branchStats.students')}
                  </div>
                  <div className="font-bold tabular-nums">
                    {branch.studentCount}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">
                    {t('dashboard.branchStats.catechists')}
                  </div>
                  <div className="font-bold tabular-nums">
                    {branch.catechistCount}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
