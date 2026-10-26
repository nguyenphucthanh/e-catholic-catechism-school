import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { CalendarPlus } from 'lucide-react'
import { api } from '../../../../convex/_generated/api'
import { useSelectedAcademicYear } from '~/lib/academic-year'
import { PageHeader } from '~/components/page-header'
import { MeetingForm } from '~/components/forms/meeting-form'

export const Route = createFileRoute(
  '/_authenticated/_catechist/meetings_/create',
)({
  component: CreateMeetingPage,
  staticData: {
    crumbs: [
      { label: 'meetings.title', path: '/meetings' },
      { label: 'meetings.create.title' },
    ],
  },
})

function CreateMeetingPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { selectedYearId } = useSelectedAcademicYear()
  const perms = useQuery(
    api.catechistPermissions.getPermissions,
    selectedYearId ? { academicYearId: selectedYearId } : 'skip',
  )
  const back = () => navigate({ to: '/meetings' })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={CalendarPlus}
        title={t('meetings.create.title')}
        subtitle={t('meetings.create.subtitle')}
      />
      <div className="bg-card border rounded-xl p-4">
        {!selectedYearId || perms === undefined ? (
          <div className="h-10 bg-muted animate-pulse rounded-lg" />
        ) : !(perms.isAdmin || perms.isBoardMember) ? (
          <div className="p-4 text-destructive text-center">
            {t('common.contactAdmin')}
          </div>
        ) : (
          <MeetingForm
            academicYearId={selectedYearId}
            onSuccess={back}
            onCancel={back}
          />
        )}
      </div>
    </div>
  )
}
