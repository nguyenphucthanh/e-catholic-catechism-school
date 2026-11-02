import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'
import { useForm } from '@tanstack/react-form'
import type { DefaultAttendanceStatus } from '~/lib/attendance'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Label } from '~/components/ui/label'
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group'
import { Switch } from '~/components/ui/switch'
import { DEFAULT_ATTENDANCE_STATUSES } from '~/lib/attendance'

interface DefaultAttendanceStatusDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  currentStatus?: DefaultAttendanceStatus
  globalStatus?: DefaultAttendanceStatus
  onSave: (status: DefaultAttendanceStatus | undefined) => Promise<void>
}

const formSchema = z.object({
  status: z.enum(DEFAULT_ATTENDANCE_STATUSES),
})

export function DefaultAttendanceStatusDialog({
  isOpen,
  onOpenChange,
  currentStatus,
  globalStatus,
  onSave,
}: DefaultAttendanceStatusDialogProps) {
  const { t } = useTranslation()
  const [useCustom, setUseCustom] = React.useState(!!currentStatus)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const initialStatus = currentStatus ?? globalStatus ?? 'present'

  const form = useForm({
    defaultValues: { status: initialStatus },
    validators: { onSubmit: formSchema },
    onSubmit: async ({ value }) => {
      setIsSubmitting(true)
      try {
        await onSave(useCustom ? value.status : undefined)
        toast.success(t('attendance.createSession.defaultStatusSuccess'))
        onOpenChange(false)
      } catch {
        toast.error(t('attendance.createSession.defaultStatusError'))
      } finally {
        setIsSubmitting(false)
      }
    },
  })

  // Reset state and form values from props each time the dialog opens
  React.useEffect(() => {
    if (isOpen) {
      setUseCustom(!!currentStatus)
      form.reset({ status: initialStatus })
    }
  }, [isOpen, currentStatus, globalStatus])

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t('attendance.createSession.defaultStatusTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('attendance.createSession.defaultStatusDesc')}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            form.handleSubmit()
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="toggle-custom-default" className="cursor-pointer">
                {t('attendance.createSession.defaultStatusCustom')}
              </Label>
              <p className="text-xs text-muted-foreground">
                {useCustom
                  ? t('attendance.createSession.defaultStatusCustom')
                  : t('attendance.summary.inheritGlobal')}
              </p>
            </div>
            <Switch
              id="toggle-custom-default"
              checked={useCustom}
              onCheckedChange={setUseCustom}
            />
          </div>

          {useCustom && (
            <form.Field
              name="status"
              children={(field) => (
                <RadioGroup
                  value={field.state.value}
                  onValueChange={(val) =>
                    field.handleChange(val as DefaultAttendanceStatus)
                  }
                  className="flex flex-col gap-2 border-t pt-3"
                >
                  {DEFAULT_ATTENDANCE_STATUSES.map((status) => (
                    <div key={status} className="flex items-center gap-2">
                      <RadioGroupItem value={status} id={`dlg-das-${status}`} />
                      <Label
                        htmlFor={`dlg-das-${status}`}
                        className="cursor-pointer"
                      >
                        {t(`attendance.status.${status}`)}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}
            />
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('common.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
