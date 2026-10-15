import * as React from 'react'
import {
  Link,
  createFileRoute,
  useNavigate,
  useParams,
} from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import {
  CalendarClock,
  ClipboardCheck,
  Pencil,
  Trash2,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { useAuth } from '~/lib/auth'
import { translateConvexError } from '~/lib/convex-errors'
import { formatDate } from '~/lib/locale'
import { PageHeader } from '~/components/page-header'
import { MeetingScopeBadge } from '~/components/custom/meeting-scope-badge'
import { MeetingDeleteDialog } from '~/components/custom/meeting-delete-dialog'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Skeleton } from '~/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog'

export const Route = createFileRoute(
  '/_authenticated/_catechist/meetings_/$id',
)({
  component: MeetingDetailPage,
  staticData: {
    crumbs: [
      { label: 'meetings.title', path: '/meetings' },
      { label: 'meetings.detail.title' },
    ],
  },
})

function MeetingDetailPage() {
  const { id } = useParams({ strict: false })
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const requesterId = user?.userDocId as Id<'catechists'> | undefined
  const meeting = useQuery(
    api.catechistMeetings.getMeeting,
    requesterId
      ? { requesterId, meetingId: id as Id<'catechistMeetings'> }
      : 'skip',
  )
  const cancelMeeting = useMutation(api.catechistMeetings.cancelMeeting)
  const [cancelOpen, setCancelOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)

  const onCancel = async () => {
    if (!requesterId || !meeting) return
    try {
      await cancelMeeting({ requesterId, meetingId: meeting._id })
      toast.success(t('meetings.cancelled'))
    } catch (err) {
      toast.error(translateConvexError(err, t))
    }
    setCancelOpen(false)
  }

  const rows: Array<[string, React.ReactNode]> = meeting
    ? [
        [t('meetings.fields.meetingDate'), formatDate(meeting.meetingDate)],
        [
          t('meetings.detail.time'),
          meeting.startTime
            ? `${meeting.startTime}${meeting.endTime ? ` - ${meeting.endTime}` : ''}`
            : '—',
        ],
        [t('meetings.fields.location'), meeting.location || '—'],
        [
          t('meetings.fields.scope'),
          <MeetingScopeBadge
            key="scope"
            scope={meeting.scope}
            branchName={meeting.branchName}
          />,
        ],
        [t('meetings.fields.notes'), meeting.notes || '—'],
      ]
    : []

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={CalendarClock}
        title={meeting?.title ?? t('meetings.detail.title')}
        actions={
          meeting && (
            <>
              {meeting.canRecord && !meeting.isCancelled && (
                <Button
                  nativeButton={false}
                  render={
                    <Link
                      to="/attendance/catechists"
                      search={{
                        category: 'meeting',
                        date: meeting.meetingDate,
                        meetingId: meeting._id,
                      }}
                    />
                  }
                >
                  <ClipboardCheck className="size-4" />
                  {t('meetings.takeAttendance')}
                </Button>
              )}
              {meeting.canManage && (
                <>
                  <Button
                    variant="outline"
                    nativeButton={false}
                    render={
                      <Link
                        to="/meetings/$id/edit"
                        params={{ id: meeting._id }}
                      />
                    }
                  >
                    <Pencil className="size-4" />
                    {t('common.edit')}
                  </Button>
                  {!meeting.isCancelled && (
                    <Button
                      variant="outline"
                      onClick={() => setCancelOpen(true)}
                    >
                      <XCircle className="size-4" />
                      {t('meetings.cancel.action')}
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 className="size-4" />
                    {t('common.delete')}
                  </Button>
                </>
              )}
            </>
          )
        }
      />

      {meeting === undefined ? (
        <Skeleton className="h-48 w-full" />
      ) : meeting === null ? (
        <Card>
          <CardContent className="text-center text-muted-foreground">
            {t('meetings.notFound')}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <CardTitle>{t('meetings.detail.info')}</CardTitle>
            {meeting.isCancelled && (
              <Badge variant="destructive">
                {t('meetings.cancelledBadge')}
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              {rows.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                  <dd className="font-medium whitespace-pre-wrap">{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('meetings.cancel.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('meetings.cancel.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.back')}</AlertDialogCancel>
            <AlertDialogAction onClick={onCancel}>
              {t('meetings.cancel.action')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {requesterId && (
        <MeetingDeleteDialog
          requesterId={requesterId}
          meeting={deleteOpen ? (meeting ?? null) : null}
          onClose={() => setDeleteOpen(false)}
          onDeleted={() => navigate({ to: '/meetings' })}
        />
      )}
    </div>
  )
}
