import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'
import { useForm } from '@tanstack/react-form'
import type { AttendancePointConfig } from '~/lib/attendance'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Field, FieldError, FieldLabel } from '~/components/ui/field'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group'
import { Switch } from '~/components/ui/switch'
import { attendancePointValueSchema } from '~/lib/attendance'

interface AttendancePointConfigDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  currentConfig?: AttendancePointConfig
  globalConfig?: AttendancePointConfig
  onSave: (config: AttendancePointConfig | undefined) => Promise<void>
}

export function AttendancePointConfigDialog({
  isOpen,
  onOpenChange,
  currentConfig,
  globalConfig,
  onSave,
}: AttendancePointConfigDialogProps) {
  const { t } = useTranslation()
  const [useCustomRule, setUseCustomRule] = React.useState(!!currentConfig)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const effectiveFallback = currentConfig ?? globalConfig
  const initialMode = effectiveFallback?.mode ?? 'rate'
  const initialPresent =
    effectiveFallback && effectiveFallback.mode === 'type'
      ? effectiveFallback.present
      : 10
  const initialLate =
    effectiveFallback && effectiveFallback.mode === 'type'
      ? effectiveFallback.late
      : 9
  const initialExcused =
    effectiveFallback && effectiveFallback.mode === 'type'
      ? effectiveFallback.excused
      : 0
  const initialAbsentUnset =
    effectiveFallback && effectiveFallback.mode === 'type'
      ? effectiveFallback.absentUnset
      : -0.5

  const formSchema = React.useMemo(() => {
    const pointValue = attendancePointValueSchema(
      t('appConfig.fields.attendancePoint.rangeError'),
    )
    return z.object({
      mode: z.enum(['rate', 'type']),
      present: pointValue,
      late: pointValue,
      excused: pointValue,
      absentUnset: pointValue,
    })
  }, [t])

  const form = useForm({
    defaultValues: {
      mode: initialMode,
      present: initialPresent,
      late: initialLate,
      excused: initialExcused,
      absentUnset: initialAbsentUnset,
    },
    validators: {
      onSubmit: formSchema,
    },
    onSubmit: async ({ value }) => {
      setIsSubmitting(true)
      try {
        if (!useCustomRule) {
          await onSave(undefined)
        } else {
          const configToSave: AttendancePointConfig =
            value.mode === 'rate'
              ? { mode: 'rate' }
              : {
                  mode: 'type',
                  present: value.present,
                  late: value.late,
                  excused: value.excused,
                  absentUnset: value.absentUnset,
                }
          await onSave(configToSave)
        }
        toast.success(t('attendance.summary.configSuccess'))
        onOpenChange(false)
      } catch {
        toast.error(t('attendance.summary.configError'))
      } finally {
        setIsSubmitting(false)
      }
    },
  })

  // Reset state and form values from props each time the dialog opens
  React.useEffect(() => {
    if (isOpen) {
      setUseCustomRule(!!currentConfig)
      form.reset({
        mode: initialMode,
        present: initialPresent,
        late: initialLate,
        excused: initialExcused,
        absentUnset: initialAbsentUnset,
      })
    }
  }, [isOpen, currentConfig, globalConfig])

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('attendance.summary.configDialogTitle')}</DialogTitle>
          <DialogDescription>
            {t('attendance.summary.configDialogDesc')}
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
              <Label htmlFor="toggle-custom-rule" className="cursor-pointer">
                {t('attendance.summary.customRule')}
              </Label>
              <p className="text-xs text-muted-foreground">
                {useCustomRule
                  ? t('attendance.summary.customRule')
                  : t('attendance.summary.inheritGlobal')}
              </p>
            </div>
            <Switch
              id="toggle-custom-rule"
              checked={useCustomRule}
              onCheckedChange={setUseCustomRule}
            />
          </div>

          {useCustomRule && (
            <div className="flex flex-col gap-4 border-t pt-3">
              <form.Field
                name="mode"
                children={(field) => (
                  <RadioGroup
                    value={field.state.value}
                    onValueChange={(val) =>
                      field.handleChange(val as 'rate' | 'type')
                    }
                    className="flex flex-col gap-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="rate" id="dialog-ap-rate" />
                      <Label
                        htmlFor="dialog-ap-rate"
                        className="cursor-pointer"
                      >
                        {t('appConfig.fields.attendancePoint.modeRate')}
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="type" id="dialog-ap-type" />
                      <Label
                        htmlFor="dialog-ap-type"
                        className="cursor-pointer"
                      >
                        {t('appConfig.fields.attendancePoint.modeType')}
                      </Label>
                    </div>
                  </RadioGroup>
                )}
              />

              <form.Subscribe
                selector={(s) => s.values.mode}
                children={(mode) => {
                  if (mode !== 'type') return null
                  return (
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <form.Field
                        name="present"
                        children={(field) => (
                          <Field>
                            <FieldLabel htmlFor="dlg-pt-present">
                              {t('appConfig.fields.attendancePoint.present')}
                            </FieldLabel>
                            <Input
                              id="dlg-pt-present"
                              type="number"
                              step="0.1"
                              min="-10"
                              max="10"
                              value={field.state.value}
                              onChange={(e) =>
                                field.handleChange(
                                  parseFloat(e.target.value) || 0,
                                )
                              }
                            />
                            <FieldError errors={field.state.meta.errors} />
                          </Field>
                        )}
                      />

                      <form.Field
                        name="late"
                        children={(field) => (
                          <Field>
                            <FieldLabel htmlFor="dlg-pt-late">
                              {t('appConfig.fields.attendancePoint.late')}
                            </FieldLabel>
                            <Input
                              id="dlg-pt-late"
                              type="number"
                              step="0.1"
                              min="-10"
                              max="10"
                              value={field.state.value}
                              onChange={(e) =>
                                field.handleChange(
                                  parseFloat(e.target.value) || 0,
                                )
                              }
                            />
                            <FieldError errors={field.state.meta.errors} />
                          </Field>
                        )}
                      />

                      <form.Field
                        name="excused"
                        children={(field) => (
                          <Field>
                            <FieldLabel htmlFor="dlg-pt-excused">
                              {t('appConfig.fields.attendancePoint.excused')}
                            </FieldLabel>
                            <Input
                              id="dlg-pt-excused"
                              type="number"
                              step="0.1"
                              min="-10"
                              max="10"
                              value={field.state.value}
                              onChange={(e) =>
                                field.handleChange(
                                  parseFloat(e.target.value) || 0,
                                )
                              }
                            />
                            <FieldError errors={field.state.meta.errors} />
                          </Field>
                        )}
                      />

                      <form.Field
                        name="absentUnset"
                        children={(field) => (
                          <Field>
                            <FieldLabel htmlFor="dlg-pt-absent">
                              {t(
                                'appConfig.fields.attendancePoint.absentUnset',
                              )}
                            </FieldLabel>
                            <Input
                              id="dlg-pt-absent"
                              type="number"
                              step="0.1"
                              min="-10"
                              max="10"
                              value={field.state.value}
                              onChange={(e) =>
                                field.handleChange(
                                  parseFloat(e.target.value) || 0,
                                )
                              }
                            />
                            <FieldError errors={field.state.meta.errors} />
                          </Field>
                        )}
                      />
                    </div>
                  )
                }}
              />
            </div>
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
