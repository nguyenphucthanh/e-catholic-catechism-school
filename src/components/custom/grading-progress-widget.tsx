import { useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { Link } from '@tanstack/react-router'
import { ClipboardList } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { Badge } from '~/components/ui/badge'
import { buttonVariants } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Skeleton } from '~/components/ui/skeleton'

export function GradingProgressWidget({
  requesterId,
  academicYearId,
}: {
  requesterId: Id<'catechists'>
  academicYearId: Id<'academicYears'> | null
}) {
  const { t } = useTranslation()
  const columns = useQuery(
    api.grading.getMyGradingProgress,
    academicYearId ? { requesterId, academicYearId } : 'skip',
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="size-5 text-muted-foreground" />
          {t('dashboard.gradingProgress.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {columns === undefined ? (
          <div className="flex flex-col gap-2">
            {['a', 'b', 'c'].map((key) => (
              <Skeleton key={key} className="h-14 w-full" />
            ))}
          </div>
        ) : columns.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('dashboard.gradingProgress.empty')}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {columns.map((column) => (
              <div
                key={column.scoreColumnId}
                className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{column.className}</p>
                    <Badge variant="outline">
                      {t(`exams.create.type.${column.columnType}`, {
                        defaultValue: column.columnType,
                      })}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {column.columnName} ·{' '}
                    {t('semesters.numberLabel', {
                      defaultValue: `Semester ${column.semesterNumber}`,
                      number: column.semesterNumber,
                    })}{' '}
                    ·{' '}
                    {t('dashboard.gradingProgress.entered', {
                      entered: column.enteredCount,
                      total: column.studentCount,
                    })}
                  </p>
                </div>
                <Link
                  to="/classes/$id"
                  params={{ id: column.classId }}
                  search={{ tab: 'exams' }}
                  className={buttonVariants({ size: 'sm' })}
                >
                  {t('dashboard.gradingProgress.enterScores')}
                </Link>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
