import { useMutation } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { translateConvexError } from '~/lib/convex-errors'
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

/** Confirm + soft-delete a meeting. Open while `meeting` is non-null. */
export function MeetingDeleteDialog({
  requesterId,
  meeting,
  onClose,
  onDeleted,
}: {
  requesterId: Id<'catechists'>
  meeting: { _id: Id<'catechistMeetings'>; title: string } | null
  onClose: () => void
  onDeleted?: () => void
}) {
  const { t } = useTranslation()
  const softDelete = useMutation(api.catechistMeetings.softDeleteMeeting)

  const confirm = async () => {
    if (!meeting) return
    try {
      await softDelete({ requesterId, meetingId: meeting._id })
      toast.success(t('meetings.deleted'))
      onClose()
      onDeleted?.()
    } catch (err) {
      toast.error(translateConvexError(err, t))
    }
  }

  return (
    <AlertDialog
      open={meeting !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('meetings.delete.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('meetings.delete.description', { name: meeting?.title ?? '' })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={confirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {t('common.delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
