import { useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { Link } from '@tanstack/react-router'
import { GraduationCap } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Skeleton } from '~/components/ui/skeleton'
import { EnrollmentSummary } from '~/components/custom/enrollment-summary'

export function StudentDashboard({ studentId }: { studentId: Id<'students'> }) {
  const { t } = useTranslation()
  const data = useQuery(api.students.getMyProfile, { requesterId: studentId })

  if (data === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="size-5 text-muted-foreground" />
            {t('students.detail.enrollments.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-full mb-3" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    )
  }

  const latestEnrollment = data?.enrollments
    .slice()
    .sort((a, b) => b.enrolledDate.localeCompare(a.enrolledDate))
    .at(0)

  if (!latestEnrollment) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="size-5 text-muted-foreground" />
            {t('students.detail.enrollments.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t('students.enrollments.noRecord')}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="size-5 text-muted-foreground" />
          {latestEnrollment.classYear.className}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {latestEnrollment.classYear.academicYearName}
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <EnrollmentSummary
          studentClassId={latestEnrollment._id}
          requester={{ accountType: 'student', requesterId: studentId }}
        />
        <p className="px-4 pb-4 text-sm text-muted-foreground">
          {t('students.dashboard.viewAllHistoryPrefix')}{' '}
          <Link
            to="/profile"
            className="text-primary underline underline-offset-4"
          >
            {t('students.dashboard.viewAllHistoryLink')}
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
