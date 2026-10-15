import * as React from 'react'
import { useForm } from '@tanstack/react-form'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { z } from 'zod'
import { format, parseISO } from 'date-fns'
import { api } from '../../../convex/_generated/api'
import type { FunctionReturnType } from 'convex/server'
import type { Id } from '../../../convex/_generated/dataModel'
import { translateConvexError } from '~/lib/convex-errors'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Textarea } from '~/components/ui/textarea'
import { DateInput } from '~/components/custom/date-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '~/components/ui/field'
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

type Meeting = NonNullable<
  FunctionReturnType<typeof api.catechistMeetings.getMeeting>
>

interface MeetingFormProps {
  requesterId: Id<'catechists'>
  /** Required when creating. */
  academicYearId?: Id<'academicYears'>
  /** Present when editing. */
  meeting?: Meeting
  onSuccess: () => void
  onCancel: () => void
}

const SCOPES = ['all', 'board', 'branch'] as const

export function MeetingForm({
  requesterId,
  academicYearId,
  meeting,
  onSuccess,
  onCancel,
}: MeetingFormProps) {
  const { t } = useTranslation()
  const [formDirty, setFormDirty] = React.useState(false)
  const [confirmLeaveOpen, setConfirmLeaveOpen] = React.useState(false)
  const createMeeting = useMutation(api.catechistMeetings.createMeeting)
  const updateMeeting = useMutation(api.catechistMeetings.updateMeeting)
  const branches = useQuery(api.branches.list, { requesterId })

  const formSchema = React.useMemo(
    () =>
      z
        .object({
          title: z.string().trim().min(1, t('common.required')),
          meetingDate: z.string().min(1, t('common.required')),
          scope: z.enum(SCOPES),
          branchId: z.string(),
          startTime: z.string(),
          endTime: z.string(),
          location: z.string(),
          notes: z.string(),
        })
        .superRefine((v, ctx) => {
          if (v.scope === 'branch' && !v.branchId) {
            ctx.addIssue({
              code: 'custom',
              path: ['branchId'],
              message: t('common.required'),
            })
          }
          if (v.startTime && v.endTime && v.endTime <= v.startTime) {
            ctx.addIssue({
              code: 'custom',
              path: ['endTime'],
              message: t('meetings.form.endBeforeStart'),
            })
          }
        }),
    [t],
  )

  const scopeItems = SCOPES.map((s) => ({
    value: s,
    label: t(`meetings.scope.${s}`),
  }))
  const branchItems = (branches ?? []).map((b) => ({
    value: b._id,
    label: b.name,
  }))

  const form = useForm({
    defaultValues: {
      title: meeting?.title ?? '',
      meetingDate: meeting?.meetingDate ?? format(new Date(), 'yyyy-MM-dd'),
      scope: meeting?.scope ?? 'all',
      branchId: meeting?.branchId ?? '',
      startTime: meeting?.startTime ?? '',
      endTime: meeting?.endTime ?? '',
      location: meeting?.location ?? '',
      notes: meeting?.notes ?? '',
    },
    validators: { onSubmit: formSchema },
    onSubmit: async ({ value }) => {
      const branchId =
        value.scope === 'branch'
          ? (value.branchId as Id<'branches'>)
          : undefined
      try {
        if (meeting) {
          // Strings (even empty) are sent so cleared optional fields are overwritten.
          await updateMeeting({
            requesterId,
            meetingId: meeting._id,
            title: value.title.trim(),
            meetingDate: value.meetingDate,
            scope: value.scope,
            branchId,
            startTime: value.startTime,
            endTime: value.endTime,
            location: value.location,
            notes: value.notes,
          })
        } else {
          if (!academicYearId) return
          await createMeeting({
            requesterId,
            academicYearId,
            title: value.title.trim(),
            meetingDate: value.meetingDate,
            scope: value.scope,
            branchId,
            startTime: value.startTime || undefined,
            endTime: value.endTime || undefined,
            location: value.location || undefined,
            notes: value.notes || undefined,
          })
        }
        toast.success(t('common.saved'))
        onSuccess()
      } catch (err) {
        toast.error(translateConvexError(err, t))
      }
    },
  })

  const handleCancel = () =>
    formDirty ? setConfirmLeaveOpen(true) : onCancel()

  const textField = (
    name: 'title' | 'location' | 'startTime' | 'endTime',
    opts: { required?: boolean; type?: string } = {},
  ) => (
    <form.Field
      name={name}
      children={(field) => {
        const isInvalid =
          field.state.meta.isTouched && !field.state.meta.isValid
        return (
          <Field data-invalid={isInvalid}>
            <FieldLabel htmlFor={name}>
              {t(`meetings.fields.${name}`)}
              {opts.required && <span className="text-destructive"> *</span>}
            </FieldLabel>
            <Input
              id={name}
              name={name}
              type={opts.type}
              value={field.state.value}
              onChange={(e) => {
                field.handleChange(e.target.value)
                setFormDirty(true)
              }}
              onBlur={field.handleBlur}
              aria-invalid={isInvalid}
            />
            {isInvalid && <FieldError errors={field.state.meta.errors} />}
          </Field>
        )
      }}
    />
  )

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}
        className="flex flex-col gap-8"
      >
        <FieldSet>
          <FieldLegend>{t('meetings.form.basic')}</FieldLegend>
          <FieldDescription>
            {t('meetings.form.basicDescription')}
          </FieldDescription>
          <FieldGroup>
            {textField('title', { required: true })}
            <form.Field
              name="meetingDate"
              children={(field) => (
                <Field>
                  <FieldLabel>
                    {t('meetings.fields.meetingDate')}
                    <span className="text-destructive"> *</span>
                  </FieldLabel>
                  <DateInput
                    value={
                      field.state.value
                        ? parseISO(field.state.value)
                        : undefined
                    }
                    onChange={(d) => {
                      if (!d) return
                      field.handleChange(format(d, 'yyyy-MM-dd'))
                      setFormDirty(true)
                    }}
                  />
                </Field>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              {textField('startTime', { type: 'time' })}
              {textField('endTime', { type: 'time' })}
            </div>
            {textField('location')}
          </FieldGroup>
        </FieldSet>

        <FieldSet>
          <FieldLegend>{t('meetings.form.attendees')}</FieldLegend>
          <FieldDescription>
            {t('meetings.form.attendeesDescription')}
          </FieldDescription>
          <FieldGroup>
            <form.Field
              name="scope"
              children={(field) => (
                <Field>
                  <FieldLabel>
                    {t('meetings.fields.scope')}
                    <span className="text-destructive"> *</span>
                  </FieldLabel>
                  <Select
                    value={field.state.value}
                    items={scopeItems}
                    onValueChange={(val) => {
                      if (!val) return
                      field.handleChange(val)
                      setFormDirty(true)
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {scopeItems.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />
            <form.Subscribe
              selector={(s) => s.values.scope}
              children={(scope) =>
                scope === 'branch' && (
                  <form.Field
                    name="branchId"
                    children={(field) => {
                      const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid
                      return (
                        <Field data-invalid={isInvalid}>
                          <FieldLabel>
                            {t('meetings.fields.branch')}
                            <span className="text-destructive"> *</span>
                          </FieldLabel>
                          <Select
                            value={field.state.value || null}
                            items={branchItems}
                            onValueChange={(val) => {
                              field.handleChange(val ?? '')
                              setFormDirty(true)
                            }}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue
                                placeholder={t(
                                  'meetings.fields.branchPlaceholder',
                                )}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {branchItems.map((b) => (
                                <SelectItem key={b.value} value={b.value}>
                                  {b.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {isInvalid && (
                            <FieldError errors={field.state.meta.errors} />
                          )}
                        </Field>
                      )
                    }}
                  />
                )
              }
            />
          </FieldGroup>
        </FieldSet>

        <FieldSet>
          <FieldLegend>{t('meetings.form.extra')}</FieldLegend>
          <FieldDescription>
            {t('meetings.form.extraDescription')}
          </FieldDescription>
          <FieldGroup>
            <form.Field
              name="notes"
              children={(field) => (
                <Field>
                  <FieldLabel htmlFor="notes">
                    {t('meetings.fields.notes')}
                  </FieldLabel>
                  <Textarea
                    id="notes"
                    value={field.state.value}
                    onChange={(e) => {
                      field.handleChange(e.target.value)
                      setFormDirty(true)
                    }}
                    onBlur={field.handleBlur}
                  />
                </Field>
              )}
            />
          </FieldGroup>
        </FieldSet>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={handleCancel}>
            {t('common.cancel')}
          </Button>
          <form.Subscribe
            selector={(s) => ({ isSubmitting: s.isSubmitting })}
            children={({ isSubmitting }) => (
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? t('common.saving') : t('common.save')}
              </Button>
            )}
          />
        </div>
      </form>

      <AlertDialog open={confirmLeaveOpen} onOpenChange={setConfirmLeaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('meetings.confirmLeave.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('meetings.confirmLeave.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmLeaveOpen(false)
                onCancel()
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('meetings.confirmLeave.discard')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
