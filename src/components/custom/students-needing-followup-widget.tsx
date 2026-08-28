import { useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { Link } from '@tanstack/react-router'
import { AlertCircle, AlertTriangle, FileSpreadsheet } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { Badge } from '~/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Skeleton } from '~/components/ui/skeleton'

export function StudentsNeedingFollowupWidget({
  requesterId,
  academicYearId,
}: {
  requesterId: Id<'catechists'>
  academicYearId: Id<'academicYears'> | null
}) {
  const { t } = useTranslation()
  const students = useQuery(
    api.studentFollowUp.getStudentsNeedingFollowUp,
    academicYearId ? { requesterId, academicYearId } : 'skip',
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="size-5 text-muted-foreground" />
          {t('dashboard.followUp.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {students === undefined ? (
          <div className="flex flex-col gap-2 p-4">
            {['a', 'b', 'c'].map((key) => (
              <Skeleton key={key} className="h-12 w-full" />
            ))}
          </div>
        ) : students.length === 0 ? (
          <p className="text-sm text-muted-foreground p-4">
            {t('dashboard.followUp.empty')}
          </p>
        ) : (
          <div className="flex flex-col gap-2 divide-y *:pb-2">
            {students.map((student) => (
              <div
                key={student.studentClassId}
                className="flex flex-col gap-1.5 px-4"
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
                <div className="flex flex-wrap items-center gap-1.5">
                  {student.attendanceRate < 75 && (
                    <Badge variant="destructive" className="tabular-nums">
                      <AlertTriangle className="size-3" />
                      {t('dashboard.followUp.reasons.lowAttendance', {
                        rate: student.attendanceRate,
                      })}
                    </Badge>
                  )}
                  {student.scoreEntriesCount < 3 && (
                    <Badge
                      variant="outline"
                      className="tabular-nums text-muted-foreground"
                    >
                      <FileSpreadsheet className="size-3" />
                      {t('dashboard.followUp.reasons.missingScores', {
                        count: student.scoreEntriesCount,
                      })}
                    </Badge>
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
