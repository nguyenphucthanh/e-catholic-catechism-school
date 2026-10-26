import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { CalendarCog } from 'lucide-react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { PageHeader } from '~/components/page-header'
import { MeetingForm } from '~/components/forms/meeting-form'

export const Route = createFileRoute(
  '/_authenticated/_catechist/meetings_/$id_/edit',
)({
  component: EditMeetingPage,
  staticData: {
    crumbs: [
      { label: 'meetings.title', path: '/meetings' },
      { label: 'meetings.edit.title' },
    ],
  },
})

function EditMeetingPage() {
  const { id } = useParams({ strict: false })
  const { t } = useTranslation()
  const navigate = useNavigate()
  const meeting = useQuery(api.catechistMeetings.getMeeting, {
    meetingId: id as Id<'catechistMeetings'>,
  })
  const back = () => navigate({ to: '/meetings/$id', params: { id: id! } })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={CalendarCog}
        title={t('meetings.edit.title')}
        subtitle={t('meetings.edit.subtitle')}
      />
      <div className="bg-card border rounded-xl p-4">
        {meeting === undefined ? (
          <div className="h-10 bg-muted animate-pulse rounded-lg" />
        ) : meeting === null ? (
          <div className="text-center text-muted-foreground py-10">
            {t('meetings.notFound')}
          </div>
        ) : !meeting.canManage ? (
          <div className="p-4 text-destructive text-center">
            {t('common.contactAdmin')}
          </div>
        ) : (
          <MeetingForm meeting={meeting} onSuccess={back} onCancel={back} />
        )}
      </div>
    </div>
  )
}
