import { useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { Link } from '@tanstack/react-router'
import { AlertCircle } from 'lucide-react'
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
      <CardContent>
        {students === undefined ? (
          <div className="flex flex-col gap-2">
            {['a', 'b', 'c'].map((key) => (
              <Skeleton key={key} className="h-12 w-full" />
            ))}
          </div>
        ) : students.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('dashboard.followUp.empty')}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {students.map((student) => (
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
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {t('dashboard.followUp.attendance', {
                      rate: student.attendanceRate,
                    })}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
