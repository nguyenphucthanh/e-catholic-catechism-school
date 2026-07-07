import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { Pencil, Users } from 'lucide-react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { useAuth } from '~/lib/auth'
import { isAdmin } from '~/lib/permissions'
import { PageHeader } from '~/components/page-header'
import { Card, CardContent } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { StudentDetailCards } from '~/components/custom/student-detail-cards'
import { formatPersonName } from '~/lib/name'
import { ProfileAvatar } from '~/components/custom/profile-avatar'

export const Route = createFileRoute(
  '/_authenticated/_catechist/students_/$id',
)({
  component: StudentDetailPage,
  staticData: {
    crumbs: [
      { label: 'students.title', path: '/students' },
      { label: 'students.detail.title' },
    ],
  },
})

function StudentDetailPage() {
  const { id } = useParams({ strict: false })
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user } = useAuth()
  const requesterId = user?.userDocId as Id<'catechists'> | undefined
  const canManage = isAdmin(user)

  const data = useQuery(
    api.students.getStudentDetail,
    requesterId ? { requesterId, studentId: id as Id<'students'> } : 'skip',
  )

  if (data === null) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader icon={Users} title={t('students.detail.title')} />
        <div className="bg-card border rounded-xl p-6 flex flex-col items-center gap-4 text-center">
          <p className="text-sm text-muted-foreground font-medium">
            {t('students.notFound')}
          </p>
          <Button
            onClick={() => navigate({ to: '/students' })}
            variant="outline"
          >
            {t('common.back')}
          </Button>
        </div>
      </div>
    )
  }

  const actions = canManage ? (
    <Button
      onClick={() =>
        navigate({ to: '/students/$id/edit', params: { id: id! } })
      }
      variant="outline"
    >
      <Pencil className="mr-2 size-4" />
      {t('common.edit')}
    </Button>
  ) : undefined

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Users}
        title={
          data
            ? formatPersonName(data.saintName, data.fullName)
            : t('students.detail.title')
        }
        actions={actions}
      />

      {data && (
        <Card>
          <CardContent>
            <div className="flex items-center gap-4">
              <ProfileAvatar
                size="lg"
                className={'size-32!'}
                userType={'catechist'}
                userId={data._id}
                fullName={data.fullName}
              />
              <div>
                <h2 className="text-lg font-semibold">
                  {formatPersonName(data.saintName, data.fullName)}
                </h2>
                <p className="text-sm text-muted-foreground">
                  #{data.studentCode}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <StudentDetailCards
        data={data}
        requester={
          requesterId ? { accountType: 'catechist', requesterId } : undefined
        }
      />
    </div>
  )
}
