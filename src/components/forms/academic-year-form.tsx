import * as React from 'react'
import { useForm, useSelector } from '@tanstack/react-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ACADEMIC_YEAR_ERRORS } from '../../../convex/lib/errors'
import type { Id } from '../../../convex/_generated/dataModel'
import { DEFAULT_TIMEZONE } from '~/lib/locale'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
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

interface AcademicYearFormProps {
  yearId?: Id<'academicYears'>
  initialValues?: {
    name: string
    startDate: string
    endDate: string
  }
  requesterId: Id<'catechists'>
  createMutation: (args: {
    requesterId: Id<'catechists'>
    name: string
    startDate: string
    endDate: string
    timezone: string
    numberOfSemesters: number
  }) => Promise<unknown>
  updateMutation: (args: {
    requesterId: Id<'catechists'>
    academicYearId: Id<'academicYears'>
    name?: string
    startDate?: string
    endDate?: string
    timezone?: string
  }) => Promise<unknown>
  onSuccess: () => void
  onCancel: () => void
}

const getDefaultStartDate = (): string => {
  const year = new Date().getFullYear()
  return `${year}-08-01`
}

const getDefaultEndDate = (): string => {
  const year = new Date().getFullYear()
  const date = new Date(year, 7, 1) // August 1st local time
  date.setDate(date.getDate() + 365)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function AcademicYearForm({
  yearId,
  initialValues,
  requesterId,
  createMutation,
  updateMutation,
  onSuccess,
  onCancel,
}: AcademicYearFormProps) {
  const { t } = useTranslation()
  const [formDirty, setFormDirty] = React.useState(false)
  const [confirmLeaveOpen, setConfirmLeaveOpen] = React.useState(false)

  const handleCancel = () => {
    if (formDirty) {
      setConfirmLeaveOpen(true)
    } else {
      onCancel()
    }
  }

  const form = useForm({
    defaultValues: {
      name: initialValues?.name ?? '',
      startDate:
        initialValues?.startDate ?? (!yearId ? getDefaultStartDate() : ''),
      endDate: initialValues?.endDate ?? (!yearId ? getDefaultEndDate() : ''),
      numberOfSemesters: !yearId ? 2 : undefined,
    },
    onSubmit: async ({ value }) => {
      // Basic validation
      if (!value.name || !value.startDate || !value.endDate) {
        return
      }

      // Start date must be before end date
      if (new Date(value.startDate) >= new Date(value.endDate)) {
        toast.error(t('academicYears.fields.endDate.refine'))
        return
      }

      try {
        if (yearId) {
          await updateMutation({
            requesterId,
            academicYearId: yearId,
            name: value.name,
            startDate: value.startDate,
            endDate: value.endDate,
            timezone: DEFAULT_TIMEZONE,
          })
        } else {
          await createMutation({
            requesterId,
            name: value.name,
            startDate: value.startDate,
            endDate: value.endDate,
            timezone: DEFAULT_TIMEZONE,
            numberOfSemesters: value.numberOfSemesters!,
          })
        }
        toast.success(t('common.saved'))
        onSuccess()
      } catch (err: any) {
        const msg = err.message || ''
        if (msg.includes(ACADEMIC_YEAR_ERRORS.DUPLICATE_NAME)) {
          toast.error(t('academicYears.fields.name.duplicate'))
        } else if (msg.includes(ACADEMIC_YEAR_ERRORS.INVALID_SEMESTER_COUNT)) {
          toast.error(t('academicYears.fields.numberOfSemesters.error'))
        } else {
          toast.error(t('academicYears.saveError'))
        }
      }
    },
  })

  const startDate = useSelector(form.store, (s) => s.values.startDate)

  React.useEffect(() => {
    const currentEndDate = form.getFieldValue('endDate')
    if (startDate && !currentEndDate) {
      const date = new Date(startDate)
      if (!isNaN(date.getTime())) {
        date.setDate(date.getDate() + 365)
        const calculatedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        form.setFieldValue('endDate', calculatedDate)
      }
    }
  }, [startDate, form])

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}
        className="flex flex-col gap-6"
      >
        <FieldSet>
          <FieldLegend>
            {t('academicYears.form.basicInfo', 'Basic Information')}
          </FieldLegend>
          <p className="text-sm text-muted-foreground mb-4">
            {t(
              'academicYears.form.basicInfo.description',
              'Enter the name for this academic year.',
            )}
          </p>
          <FieldGroup>
            <form.Field
              name="name"
              children={(field) => {
                const isInvalid = field.state.meta.errors.length > 0
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor="name">
                      {t('academicYears.fields.name')}{' '}
                      <span className="text-destructive">*</span>
                    </FieldLabel>
                    <Input
                      id="name"
                      placeholder={t('academicYears.fields.name.placeholder')}
                      value={field.state.value}
                      onChange={(e) => {
                        field.handleChange(e.target.value)
                        setFormDirty(true)
                      }}
                      onBlur={field.handleBlur}
                    />
                    {isInvalid && (
                      <FieldError
                        errors={field.state.meta.errors.map((message) => ({
                          message,
                        }))}
                      />
                    )}
                  </Field>
                )
              }}
            />
          </FieldGroup>
        </FieldSet>

        <FieldSet>
          <FieldLegend>
            {t('academicYears.form.dateRange', 'Date Range')}
          </FieldLegend>
          <p className="text-sm text-muted-foreground mb-4">
            {t(
              'academicYears.form.dateRange.description',
              'Set the start and end dates for this academic year.',
            )}
          </p>
          <FieldGroup className="grid sm:grid-cols-2 gap-4">
            <form.Field
              name="startDate"
              children={(field) => {
                const isInvalid = field.state.meta.errors.length > 0
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor="startDate">
                      {t('academicYears.fields.startDate')}{' '}
                      <span className="text-destructive">*</span>
                    </FieldLabel>
                    <Input
                      id="startDate"
                      type="date"
                      value={field.state.value}
                      onChange={(e) => {
                        field.handleChange(e.target.value)
                        setFormDirty(true)
                      }}
                      onBlur={field.handleBlur}
                      placeholder={t('academicYears.fields.startDate')}
                    />
                    {isInvalid && (
                      <FieldError
                        errors={field.state.meta.errors.map((message) => ({
                          message,
                        }))}
                      />
                    )}
                  </Field>
                )
              }}
            />

            <form.Field
              name="endDate"
              children={(field) => {
                const isInvalid = field.state.meta.errors.length > 0
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor="endDate">
                      {t('academicYears.fields.endDate')}{' '}
                      <span className="text-destructive">*</span>
                    </FieldLabel>
                    <Input
                      id="endDate"
                      type="date"
                      value={field.state.value}
                      onChange={(e) => {
                        field.handleChange(e.target.value)
                        setFormDirty(true)
                      }}
                      onBlur={field.handleBlur}
                      placeholder={t('academicYears.fields.endDate')}
                    />
                    {isInvalid && (
                      <FieldError
                        errors={field.state.meta.errors.map((message) => ({
                          message,
                        }))}
                      />
                    )}
                  </Field>
                )
              }}
            />
          </FieldGroup>
        </FieldSet>

        {!yearId && (
          <FieldSet>
            <FieldLegend>
              {t('academicYears.form.semesters', 'Semesters')}
            </FieldLegend>
            <p className="text-sm text-muted-foreground mb-4">
              {t(
                'academicYears.form.semesters.description',
                'Configure how many semesters this year will have.',
              )}
            </p>
            <FieldGroup>
              <form.Field
                name="numberOfSemesters"
                validators={{
                  onChange: ({ value }) => {
                    if (value === undefined) return undefined
                    if (!Number.isInteger(value) || value < 1 || value > 4) {
                      return t('academicYears.fields.numberOfSemesters.error')
                    }
                    return undefined
                  },
                }}
                children={(field) => {
                  const isInvalid = field.state.meta.errors.length > 0
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor="numberOfSemesters">
                        {t('academicYears.fields.numberOfSemesters')}{' '}
                        <span className="text-destructive">*</span>
                      </FieldLabel>
                      <Input
                        id="numberOfSemesters"
                        type="number"
                        min={1}
                        max={4}
                        value={field.state.value ?? ''}
                        onChange={(e) => {
                          field.handleChange(Number(e.target.value))
                          setFormDirty(true)
                        }}
                        onBlur={field.handleBlur}
                      />
                      <FieldDescription>
                        {t('academicYears.fields.numberOfSemesters.hint')}
                      </FieldDescription>
                      {isInvalid && (
                        <FieldError
                          errors={field.state.meta.errors.map((message) => ({
                            message,
                          }))}
                        />
                      )}
                    </Field>
                  )
                }}
              />
            </FieldGroup>
          </FieldSet>
        )}

        <div className="flex justify-end gap-2 pt-4">
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
              {t(
                'academicYears.confirmLeave.title',
                'Discard unsaved changes?',
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'academicYears.confirmLeave.description',
                'You have unsaved changes that will be lost.',
              )}
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
              {t('academicYears.confirmLeave.discard', 'Discard')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
