import * as React from 'react'
import { useForm } from '@tanstack/react-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { CLASS_TYPES, DEFAULT_CLASS_TYPE } from '../../../convex/lib/classTypes'
import type { ClassType } from '../../../convex/lib/classTypes'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import { translateConvexError } from '~/lib/convex-errors'
import { useSelectedAcademicYear } from '~/lib/academic-year'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Textarea } from '~/components/ui/textarea'
import {
  Field,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'

interface ClassFormProps {
  classId?: Id<'classes'>
  classYearId?: Id<'classYears'>
  initialValues?: {
    name: string
    branchId: string
    description?: string
    classType?: ClassType
  }
  requesterId: Id<'catechists'>
  createMutation: (args: {
    requesterId: Id<'catechists'>
    branchId: Id<'branches'>
    name: string
    description?: string
    academicYearId: Id<'academicYears'>
    classType?: ClassType
  }) => Promise<unknown>
  updateMutation: (args: {
    requesterId: Id<'catechists'>
    classId: Id<'classes'>
    name?: string
    description?: string
  }) => Promise<unknown>
  updateClassYearMutation?: (args: {
    requesterId: Id<'catechists'>
    classYearId: Id<'classYears'>
    classType: ClassType
  }) => Promise<unknown>
  branches: Array<Doc<'branches'>>
  onSuccess: () => void
  onCancel: () => void
}

export function ClassForm({
  classId,
  classYearId,
  initialValues,
  requesterId,
  createMutation,
  updateMutation,
  updateClassYearMutation,
  branches,
  onSuccess,
  onCancel,
}: ClassFormProps) {
  const { t } = useTranslation()
  const { selectedYearId } = useSelectedAcademicYear()
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
      branchId: initialValues?.branchId ?? '',
      description: initialValues?.description ?? '',
      classType: initialValues?.classType ?? DEFAULT_CLASS_TYPE,
    },
    onSubmit: async ({ value }) => {
      if (!value.name || !value.branchId) return

      try {
        if (classId) {
          await updateMutation({
            requesterId,
            classId,
            name: value.name,
            description: value.description || undefined,
          })
          if (classYearId && updateClassYearMutation) {
            await updateClassYearMutation({
              requesterId,
              classYearId,
              classType: value.classType,
            })
          }
        } else {
          if (!selectedYearId) {
            toast.error(t('classes.noActiveYear', 'Chưa chọn năm học'))
            return
          }
          await createMutation({
            requesterId,
            branchId: value.branchId as Id<'branches'>,
            name: value.name,
            description: value.description || undefined,
            academicYearId: selectedYearId,
            classType: value.classType,
          })
        }
        toast.success(t('common.saved'))
        onSuccess()
      } catch (err) {
        toast.error(translateConvexError(err, t, 'classes.saveError'))
      }
    },
  })

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
            {t('classes.form.basicInfo', 'Basic Information')}
          </FieldLegend>
          <p className="text-sm text-muted-foreground mb-4">
            {t(
              'classes.form.basicInfo.description',
              'Enter the class name, branch, and description.',
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
                      {t('classes.fields.name')}{' '}
                      <span className="text-destructive">*</span>
                    </FieldLabel>
                    <Input
                      id="name"
                      placeholder={t('classes.fields.name.placeholder')}
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

            <form.Field
              name="branchId"
              children={(field) => {
                const isInvalid =
                  field.state.meta.errors.length > 0 ||
                  (!field.state.value && field.state.meta.isTouched)
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor="branchId">
                      {t('classes.fields.branch')}{' '}
                      <span className="text-destructive">*</span>
                    </FieldLabel>
                    <Select
                      value={field.state.value}
                      onValueChange={(val) => {
                        field.handleChange(val as string)
                        setFormDirty(true)
                      }}
                      disabled={!!classId}
                      items={branches.map((b) => ({
                        label: b.name,
                        value: b._id,
                      }))}
                    >
                      <SelectTrigger id="branchId" onBlur={field.handleBlur}>
                        <SelectValue
                          placeholder={t('classes.fields.branch.placeholder')}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.map((b) => (
                          <SelectItem key={b._id} value={b._id}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!field.state.value && field.state.meta.isTouched && (
                      <FieldError>
                        {t('classes.fields.branch.required')}
                      </FieldError>
                    )}
                    {field.state.value &&
                      field.state.meta.errors.length > 0 && (
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
              name="classType"
              children={(field) => (
                <Field>
                  <FieldLabel htmlFor="classType">
                    {t('classes.fields.classType')}
                  </FieldLabel>
                  <Select
                    value={field.state.value}
                    onValueChange={(val) => {
                      field.handleChange(val as ClassType)
                      setFormDirty(true)
                    }}
                    disabled={!!classId && !classYearId}
                    items={CLASS_TYPES.map((ct) => ({
                      label: t(`classes.classType.${ct}`),
                      value: ct,
                    }))}
                  >
                    <SelectTrigger id="classType" onBlur={field.handleBlur}>
                      <SelectValue
                        placeholder={t('classes.fields.classType.placeholder')}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {CLASS_TYPES.map((ct) => (
                        <SelectItem key={ct} value={ct}>
                          {t(`classes.classType.${ct}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />

            <form.Field
              name="description"
              children={(field) => {
                const isInvalid = field.state.meta.errors.length > 0
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor="description">
                      {t('classes.fields.description')}
                    </FieldLabel>
                    <Textarea
                      id="description"
                      placeholder={t('classes.fields.description.placeholder')}
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

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={handleCancel}>
            {t('common.cancel')}
          </Button>
          <form.Subscribe
            selector={(s) => ({
              isSubmitting: s.isSubmitting,
              canSubmit: s.canSubmit && !!form.state.values.branchId,
            })}
            children={({ isSubmitting, canSubmit }) => (
              <Button type="submit" disabled={isSubmitting || !canSubmit}>
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
              {t('classes.confirmLeave.title', 'Discard unsaved changes?')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'classes.confirmLeave.description',
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
              {t('classes.confirmLeave.discard', 'Discard')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
