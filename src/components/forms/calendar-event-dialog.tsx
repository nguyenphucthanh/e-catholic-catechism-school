import { useEffect, useMemo, useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { z } from 'zod'
import { api } from '../../../convex/_generated/api'
import type { FunctionReturnType } from 'convex/server'
import type { Id } from '../../../convex/_generated/dataModel'
import { translateConvexError } from '~/lib/convex-errors'
import { getLiturgicalDateLabel } from '~/lib/romcal'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Button } from '~/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '~/components/ui/field'
import { Input } from '~/components/ui/input'
import { Checkbox } from '~/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { RichTextEditor } from '~/components/custom/richtext-editor'

type MyScopes = FunctionReturnType<typeof api.calendarEvents.myScopes>
type CalendarEventDoc = FunctionReturnType<typeof api.calendarEvents.get>

interface CalendarEventDefaults {
  date?: string
  endDate?: string
  startTime?: string
  endTime?: string
}

interface CalendarEventDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  requesterId: Id<'catechists'>
  academicYearId: Id<'academicYears'>
  event?: CalendarEventDoc
  defaultDate?: string
  defaults?: CalendarEventDefaults
}

function emptyDescription(): string {
  return JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] })
}

function buildDefaultValues(
  event: CalendarEventDoc | undefined,
  defaultDate: string | undefined,
  defaults: CalendarEventDefaults | undefined,
) {
  const date =
    event?.date ??
    defaults?.date ??
    defaultDate ??
    new Date().toLocaleDateString('sv-SE')
  return {
    date,
    endDate: event?.endDate ?? defaults?.endDate ?? date,
    isAllDay: event ? !event.startTime : !defaults?.startTime,
    startTime: event?.startTime ?? defaults?.startTime ?? '',
    endTime: event?.endTime ?? defaults?.endTime ?? '',
    liturgicalDate: event?.liturgicalDate ?? '',
    description: event?.description ?? emptyDescription(),
    severity: event?.severity ?? ('medium' as const),
    scope: event?.scope ?? ('board' as const),
    branchId: event?.branchId,
    classYearId: event?.classYearId,
  }
}

export function CalendarEventDialog({
  isOpen,
  onOpenChange,
  requesterId,
  academicYearId,
  event,
  defaultDate,
  defaults,
}: CalendarEventDialogProps) {
  const { t } = useTranslation()
  const isEdit = !!event

  const createMutation = useMutation(api.calendarEvents.create)
  const updateMutation = useMutation(api.calendarEvents.update)

  const myScopes: MyScopes | undefined = useQuery(api.calendarEvents.myScopes, {
    requesterId,
    academicYearId,
  })

  const branches = useQuery(api.branches.list, { requesterId })
  const classYears = useQuery(api.classes.listClassYears, {
    requesterId,
    academicYearId,
  })
  const appConfig = useQuery(api.appConfig.get)
  const romcalOptions = {
    epiphanyOnSunday: appConfig?.epiphanyOnSunday ?? true,
    corpusChristiOnSunday: appConfig?.corpusChristiOnSunday ?? true,
    ascensionOnSunday: appConfig?.ascensionOnSunday ?? true,
  }

  const [liturgicalDateTouched, setLiturgicalDateTouched] = useState(isEdit)

  const formSchema = useMemo(
    () =>
      z
        .object({
          date: z
            .string()
            .trim()
            .min(1, t('common.required')),
          endDate: z.string().optional(),
          isAllDay: z.boolean(),
          startTime: z.string().optional(),
          endTime: z.string().optional(),
          liturgicalDate: z.string().optional(),
          description: z.string(),
          severity: z.enum(['high', 'medium', 'low']),
          scope: z.enum(['board', 'branch', 'class']),
          branchId: z.custom<Id<'branches'>>().optional(),
          classYearId: z.custom<Id<'classYears'>>().optional(),
        })
        .superRefine((data, ctx) => {
          if (data.scope === 'branch' && !data.branchId) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['branchId'],
              message: t('common.required'),
            })
          }
          if (data.scope === 'class' && !data.classYearId) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['classYearId'],
              message: t('common.required'),
            })
          }
        }),
    [t],
  )

  const form = useForm({
    defaultValues: buildDefaultValues(event, defaultDate, defaults),
    validators: {
      onSubmit: formSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        if (event) {
          // `null` explicitly clears startTime/endTime on the existing doc;
          // a plain `undefined` arg gets stripped before reaching the
          // mutation and would leave the stored value untouched instead.
          const timeFields = value.isAllDay
            ? { startTime: null, endTime: null }
            : { startTime: value.startTime, endTime: value.endTime }
          await updateMutation({
            requesterId,
            id: event._id,
            date: value.date,
            endDate: value.endDate,
            ...timeFields,
            liturgicalDate: value.liturgicalDate || undefined,
            description: value.description,
            severity: value.severity,
          })
          toast.success(t('calendarEvents.dialog.updateSuccess'))
        } else {
          const timeFields = value.isAllDay
            ? {}
            : { startTime: value.startTime, endTime: value.endTime }
          await createMutation({
            requesterId,
            academicYearId,
            date: value.date,
            endDate: value.endDate,
            ...timeFields,
            liturgicalDate: value.liturgicalDate || undefined,
            description: value.description,
            severity: value.severity,
            scope: value.scope,
            branchId: value.scope === 'branch' ? value.branchId : undefined,
            classYearId:
              value.scope === 'class' ? value.classYearId : undefined,
          })
          toast.success(t('calendarEvents.dialog.createSuccess'))
        }
        onOpenChange(false)
      } catch (error) {
        toast.error(translateConvexError(error, t))
      }
    },
  })

  useEffect(() => {
    if (isOpen) {
      const values = buildDefaultValues(event, defaultDate, defaults)
      form.reset(values)
      if (!isEdit) {
        getLiturgicalDateLabel(values.date, romcalOptions).then((label) => {
          if (label) form.setFieldValue('liturgicalDate', label)
        })
      }
    }
    setLiturgicalDateTouched(isEdit)
  }, [isOpen])

  const allowedBranches = (branches ?? []).filter(
    (b) => myScopes?.isAdmin || myScopes?.branchIds?.includes(b._id),
  )
  const allowedClassYears = (classYears ?? []).filter(
    (cy) =>
      myScopes?.isAdmin || myScopes?.classYearIds?.includes(cy.classYearId),
  )
  const boardAllowed = !!myScopes && (myScopes.isAdmin || myScopes.board)

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? t('calendarEvents.dialog.editTitle')
              : t('calendarEvents.dialog.createTitle')}
          </DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
          className="flex flex-col gap-4"
        >
          <form.Field
            name="isAllDay"
            children={(field) => (
              <Field orientation="horizontal">
                <Checkbox
                  id="event-all-day"
                  checked={field.state.value}
                  onCheckedChange={(checked) =>
                    field.handleChange(checked === true)
                  }
                />
                <FieldLabel htmlFor="event-all-day">
                  {t('calendarEvents.dialog.allDay')}
                </FieldLabel>
              </Field>
            )}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-4">
              <form.Field
                name="date"
                children={(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor="event-date">
                        {t('calendarEvents.dialog.date')}{' '}
                        <span className="text-destructive">*</span>
                      </FieldLabel>
                      <Input
                        id="event-date"
                        name={field.name}
                        type="date"
                        value={field.state.value}
                        onChange={async (e) => {
                          const newDate = e.target.value
                          field.handleChange(newDate)
                          if (!liturgicalDateTouched) {
                            const label = await getLiturgicalDateLabel(
                              newDate,
                              romcalOptions,
                            )
                            form.setFieldValue('liturgicalDate', label ?? '')
                          }
                        }}
                        onBlur={field.handleBlur}
                        aria-invalid={isInvalid}
                      />
                      {isInvalid && (
                        <FieldError errors={field.state.meta.errors} />
                      )}
                    </Field>
                  )
                }}
              />

              <form.Subscribe
                selector={(state) => state.values.isAllDay}
                children={(isAllDay) =>
                  isAllDay ? null : (
                    <form.Field
                      name="startTime"
                      children={(field) => {
                        const isInvalid =
                          field.state.meta.isTouched && !field.state.meta.isValid
                        return (
                          <Field data-invalid={isInvalid}>
                            <FieldLabel htmlFor="event-start-time">
                              {t('calendarEvents.dialog.startTime')}
                            </FieldLabel>
                            <Input
                              id="event-start-time"
                              name={field.name}
                              type="time"
                              value={field.state.value}
                              onChange={(e) => field.handleChange(e.target.value)}
                              onBlur={field.handleBlur}
                              aria-invalid={isInvalid}
                            />
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
            </div>

            <div className="flex flex-col gap-4">
              <form.Field
                name="endDate"
                children={(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor="event-end-date">
                        {t('calendarEvents.dialog.endDate')}
                      </FieldLabel>
                      <Input
                        id="event-end-date"
                        name={field.name}
                        type="date"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        aria-invalid={isInvalid}
                      />
                      {isInvalid && (
                        <FieldError errors={field.state.meta.errors} />
                      )}
                    </Field>
                  )
                }}
              />

              <form.Subscribe
                selector={(state) => state.values.isAllDay}
                children={(isAllDay) =>
                  isAllDay ? null : (
                    <form.Field
                      name="endTime"
                      children={(field) => {
                        const isInvalid =
                          field.state.meta.isTouched && !field.state.meta.isValid
                        return (
                          <Field data-invalid={isInvalid}>
                            <FieldLabel htmlFor="event-end-time">
                              {t('calendarEvents.dialog.endTime')}
                            </FieldLabel>
                            <Input
                              id="event-end-time"
                              name={field.name}
                              type="time"
                              value={field.state.value}
                              onChange={(e) => field.handleChange(e.target.value)}
                              onBlur={field.handleBlur}
                              aria-invalid={isInvalid}
                            />
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
            </div>

            <form.Field
              name="severity"
              children={(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel>{t('calendarEvents.dialog.severity')}</FieldLabel>
                    <Select
                      value={field.state.value}
                      onValueChange={(val) => {
                        if (val) field.handleChange(val as 'high' | 'medium' | 'low')
                      }}
                      items={[
                        {
                          value: 'high',
                          label: t('calendarEvents.severity.high'),
                        },
                        {
                          value: 'medium',
                          label: t('calendarEvents.severity.medium'),
                        },
                        { value: 'low', label: t('calendarEvents.severity.low') },
                      ]}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">
                          {t('calendarEvents.severity.high')}
                        </SelectItem>
                        <SelectItem value="medium">
                          {t('calendarEvents.severity.medium')}
                        </SelectItem>
                        <SelectItem value="low">
                          {t('calendarEvents.severity.low')}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            />
          </div>

          <form.Field
            name="liturgicalDate"
            children={(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor="liturgical-date">
                    {t('calendarEvents.dialog.liturgicalDate')}
                  </FieldLabel>
                  <Input
                    id="liturgical-date"
                    name={field.name}
                    value={field.state.value}
                    onChange={(e) => {
                      setLiturgicalDateTouched(true)
                      field.handleChange(e.target.value)
                    }}
                    onBlur={field.handleBlur}
                    aria-invalid={isInvalid}
                  />
                  <FieldDescription>
                    {t('calendarEvents.dialog.liturgicalDateHint')}
                  </FieldDescription>
                  {isInvalid && (
                    <FieldError errors={field.state.meta.errors} />
                  )}
                </Field>
              )
            }}
          />

          {!isEdit && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <form.Field
                name="scope"
                children={(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel>{t('calendarEvents.dialog.scope')}</FieldLabel>
                      <Select
                        value={field.state.value}
                        onValueChange={(val) => {
                          if (val) field.handleChange(val as 'board' | 'branch' | 'class')
                        }}
                        items={[
                          {
                            value: 'board',
                            label: t('calendarEvents.scope.board'),
                          },
                          {
                            value: 'branch',
                            label: t('calendarEvents.scope.branch'),
                          },
                          {
                            value: 'class',
                            label: t('calendarEvents.scope.class'),
                          },
                        ]}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="board" disabled={!boardAllowed}>
                            {t('calendarEvents.scope.board')}
                          </SelectItem>
                          <SelectItem
                            value="branch"
                            disabled={allowedBranches.length === 0}
                          >
                            {t('calendarEvents.scope.branch')}
                          </SelectItem>
                          <SelectItem
                            value="class"
                            disabled={allowedClassYears.length === 0}
                          >
                            {t('calendarEvents.scope.class')}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      {isInvalid && (
                        <FieldError errors={field.state.meta.errors} />
                      )}
                    </Field>
                  )
                }}
              />

              <form.Subscribe
                selector={(state) => state.values.scope}
                children={(scope) => {
                  if (scope === 'branch') {
                    return (
                      <form.Field
                        name="branchId"
                        children={(field) => {
                          const isInvalid =
                            field.state.meta.isTouched && !field.state.meta.isValid
                          return (
                            <Field data-invalid={isInvalid}>
                              <FieldLabel>
                                {t('calendarEvents.dialog.branch')}{' '}
                                <span className="text-destructive">*</span>
                              </FieldLabel>
                              <Select
                                value={field.state.value ?? null}
                                onValueChange={(val) =>
                                  field.handleChange(val ?? undefined)
                                }
                                items={allowedBranches.map((b) => ({
                                  value: b._id,
                                  label: b.name,
                                }))}
                              >
                                <SelectTrigger>
                                  <SelectValue
                                    placeholder={t(
                                      'calendarEvents.dialog.selectBranch',
                                    )}
                                  />
                                </SelectTrigger>
                                <SelectContent>
                                  {allowedBranches.map((b) => (
                                    <SelectItem key={b._id} value={b._id}>
                                      {b.name}
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
                  if (scope === 'class') {
                    return (
                      <form.Field
                        name="classYearId"
                        children={(field) => {
                          const isInvalid =
                            field.state.meta.isTouched && !field.state.meta.isValid
                          return (
                            <Field data-invalid={isInvalid}>
                              <FieldLabel>
                                {t('calendarEvents.dialog.classYear')}{' '}
                                <span className="text-destructive">*</span>
                              </FieldLabel>
                              <Select
                                value={field.state.value ?? null}
                                onValueChange={(val) =>
                                  field.handleChange(val ?? undefined)
                                }
                                items={allowedClassYears.map((cy) => ({
                                  value: cy.classYearId,
                                  label: cy.className,
                                }))}
                              >
                                <SelectTrigger>
                                  <SelectValue
                                    placeholder={t(
                                      'calendarEvents.dialog.selectClass',
                                    )}
                                  />
                                </SelectTrigger>
                                <SelectContent>
                                  {allowedClassYears.map((cy) => (
                                    <SelectItem
                                      key={cy.classYearId}
                                      value={cy.classYearId}
                                    >
                                      {cy.className}
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
                  return null
                }}
              />
            </div>
          )}

          <form.Field
            name="description"
            children={(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel>
                    {t('calendarEvents.dialog.description')}
                  </FieldLabel>
                  <RichTextEditor
                    value={field.state.value}
                    onChange={field.handleChange}
                  />
                  {isInvalid && (
                    <FieldError errors={field.state.meta.errors} />
                  )}
                </Field>
              )
            }}
          />

          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              onClick={() => onOpenChange(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit">
              {isEdit ? t('common.save') : t('calendarEvents.dialog.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
