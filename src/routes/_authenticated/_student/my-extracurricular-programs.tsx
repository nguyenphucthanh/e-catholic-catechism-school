import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { Tent } from 'lucide-react'
import type { Id } from '~/../convex/_generated/dataModel'
import { api } from '~/../convex/_generated/api'
import { useAuth } from '~/lib/auth'
import { formatCurrency, formatDate } from '~/lib/locale'
import { PageHeader } from '~/components/page-header'
import { Badge } from '~/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Skeleton } from '~/components/ui/skeleton'

export const Route = createFileRoute(
  '/_authenticated/_student/my-extracurricular-programs',
)({
  component: MyExtracurricularProgramsPage,
  staticData: { crumb: 'extracurricular.title' },
})

function MyExtracurricularProgramsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()

  const programs = useQuery(
    api.extracurricularPrograms.listEligiblePrograms,
    user ? { studentRequesterId: user.userDocId as Id<'students'> } : 'skip',
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Tent}
        title={t('extracurricular.title')}
        subtitle={t('extracurricular.description')}
      />

      {programs === undefined ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : programs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t('extracurricular.myProgramsEmpty')}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {programs.map((program) => (
            <Link
              key={program._id}
              to="/my-extracurricular-programs/$id"
              params={{ id: program._id }}
              className="block"
            >
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="line-clamp-2">
                      {program.title}
                    </CardTitle>
                    {program.userEnrolled ? (
                      <Badge>{t('extracurricular.enrolled')}</Badge>
                    ) : (
                      <Badge variant="outline">
                        {t('extracurricular.notEnrolled')}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {formatDate(program.dateStart)} -{' '}
                    {formatDate(program.dateEnd)}
                  </p>
                  {program.feeRequired && (
                    <Badge variant="secondary">
                      {t('extracurricular.fee')}:{' '}
                      {formatCurrency(program.feeAmount || 0)}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
