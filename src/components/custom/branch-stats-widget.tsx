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

interface BranchStatsWidgetProps {
  requesterId: Id<'catechists'>
  academicYearId: Id<'academicYears'>
}

export function BranchStatsWidget({
  requesterId,
  academicYearId,
}: BranchStatsWidgetProps) {
  const data = useQuery(api.branchStats.getBranchStats, {
    requesterId,
    academicYearId,
  })

  if (data === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Branch Stats</CardTitle>
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
          <CardTitle>Branch Statistics</CardTitle>
          <CardDescription>Branches you head</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            No branch data available
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Branch Statistics</CardTitle>
        <CardDescription>Branches you head</CardDescription>
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
                  <div className="text-muted-foreground">Classes</div>
                  <div className="font-bold">{branch.classCount}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Students</div>
                  <div className="font-bold">{branch.studentCount}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Catechists</div>
                  <div className="font-bold">{branch.catechistCount}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
