import { useMutation } from 'convex/react'
import { useTranslation } from 'react-i18next'
import * as React from 'react'
import { toast } from 'sonner'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
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

interface UnenrollStudentDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  requesterId: Id<'catechists'>
  /** Enrollment row to withdraw; null while no student is targeted. */
  studentClassId: Id<'studentClasses'> | null
  /** Already formatted via formatPersonName. */
  studentName: string
  className: string
  onSuccess?: () => void
}

export function UnenrollStudentDialog({
  isOpen,
  onOpenChange,
  requesterId,
  studentClassId,
  studentName,
  className,
  onSuccess,
}: UnenrollStudentDialogProps) {
  const { t } = useTranslation()
  const updateStatus = useMutation(api.students.updateEnrollmentsStatus)
  const [isSaving, setIsSaving] = React.useState(false)

  const handleConfirm = async () => {
    if (!studentClassId) return
    setIsSaving(true)
    try {
      await updateStatus({
        requesterId,
        studentClassIds: [studentClassId],
        status: 'withdrawn',
        statusChangedDate: new Date().toISOString().split('T')[0],
      })
      toast.success(t('classes.enrollment.remove.success'))
      onOpenChange(false)
      onSuccess?.()
    } catch {
      toast.error(t('classes.enrollment.remove.error'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('classes.enrollment.remove.title')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('classes.enrollment.remove.description', {
              student: studentName,
              class: className,
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSaving}>
            {t('common.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isSaving}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {t('classes.enrollment.remove.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
