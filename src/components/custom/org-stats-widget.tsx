import { useQuery } from 'convex/react'
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
  const data = useQuery(api.orgStats.getOrgStats, {
    requesterId,
    academicYearId,
  })

  if (data === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Org Stats</CardTitle>
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
        <CardTitle>Organization Statistics</CardTitle>
        <CardDescription>Academic year totals</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-sm text-muted-foreground">Total Classes</div>
            <div className="text-2xl font-bold">{data.totalClasses || 0}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Total Students</div>
            <div className="text-2xl font-bold">{data.totalStudents || 0}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">
              Total Catechists
            </div>
            <div className="text-2xl font-bold">
              {data.totalCatechists || 0}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
