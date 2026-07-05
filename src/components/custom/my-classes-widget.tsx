import { useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { Link } from '@tanstack/react-router'
import { ClipboardCheckIcon, Layers, Users } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { Badge } from '~/components/ui/badge'
import { buttonVariants } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Skeleton } from '~/components/ui/skeleton'

export function MyClassesWidget({
  requesterId,
  academicYearId,
}: {
  requesterId: Id<'catechists'>
  academicYearId: Id<'academicYears'> | null
}) {
  const { t } = useTranslation()
  const classes = useQuery(
    api.classes.listMyClasses,
    academicYearId ? { requesterId, academicYearId } : 'skip',
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="size-5 text-muted-foreground" />
          {t('dashboard.myClasses.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {classes === undefined ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {['a', 'b', 'c'].map((key) => (
              <Skeleton key={key} className="h-32 w-full" />
            ))}
          </div>
        ) : classes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('dashboard.myClasses.empty')}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {classes.map((cls) => (
              <div
                key={cls.classId}
                className="flex flex-col justify-between gap-3 rounded-lg border p-4"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{cls.className}</p>
                    {cls.role && (
                      <Badge variant="secondary">
                        {t(
                          `classes.detail.catechists.${cls.role === 'homeroom' ? 'homeroom' : 'coTeacher'}`,
                        )}
                      </Badge>
                    )}
                  </div>
                  {cls.branchName && (
                    <p className="text-sm text-muted-foreground">
                      {cls.branchName}
                    </p>
                  )}
                  <p className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Users className="size-3.5" />
                    {t('dashboard.myClasses.studentCount', {
                      count: cls.studentCount,
                    })}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link
                    to="/classes/$id"
                    params={{ id: cls.classId }}
                    className={buttonVariants({
                      size: 'sm',
                      variant: 'outline',
                      className: 'flex-1',
                    })}
                  >
                    {t('dashboard.myClasses.viewDetails')}
                  </Link>
                  <Link
                    to="/classes/$id"
                    params={{ id: cls.classId }}
                    search={{ tab: 'attendance' }}
                    className={buttonVariants({
                      size: 'sm',
                      className: 'flex-1',
                    })}
                  >
                    <ClipboardCheckIcon className="size-4" />
                    {t('dashboard.myClasses.takeAttendance')}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
