import * as React from 'react'
import { useForm } from '@tanstack/react-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { Id } from '../../../convex/_generated/dataModel'
import { BRANCH_ERRORS } from '../../../convex/lib/errors'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Textarea } from '~/components/ui/textarea'
import {
  Field,
  FieldError,
  FieldLabel,
  FieldGroup,
  FieldSet,
  FieldLegend,
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

interface BranchFormProps {
  branchId?: Id<'branches'>
  initialValues?: {
    name: string
    description?: string
  }
  requesterId: Id<'catechists'>
  createMutation: (args: {
    requesterId: Id<'catechists'>
    name: string
    description?: string
  }) => Promise<unknown>
  updateMutation: (args: {
    requesterId: Id<'catechists'>
    branchId: Id<'branches'>
    name?: string
    description?: string
  }) => Promise<unknown>
  onSuccess: () => void
  onCancel: () => void
}

export function BranchForm({
  branchId,
  initialValues,
  requesterId,
  createMutation,
  updateMutation,
  onSuccess,
  onCancel,
}: BranchFormProps) {
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
      description: initialValues?.description ?? '',
    },
    onSubmit: async ({ value }) => {
      if (!value.name) return

      try {
        if (branchId) {
          await updateMutation({
            requesterId,
            branchId,
            name: value.name,
            description: value.description || undefined,
          })
        } else {
          await createMutation({
            requesterId,
            name: value.name,
            description: value.description || undefined,
          })
        }
        toast.success(t('common.saved'))
        onSuccess()
      } catch (err: any) {
        const msg = err.message || ''
        if (msg.includes(BRANCH_ERRORS.DUPLICATE_NAME)) {
          toast.error(t('branches.fields.name.duplicate'))
        } else {
          toast.error(t('branches.saveError'))
        }
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
          <FieldLegend>{t('branches.form.basicInfo', 'Basic Information')}</FieldLegend>
          <p className="text-sm text-muted-foreground mb-4">
            {t('branches.form.basicInfo.description', 'Enter the name and description for this branch.')}
          </p>
          <FieldGroup>
            <form.Field
              name="name"
              children={(field) => {
                const isInvalid = field.state.meta.errors.length > 0
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor="name">
                      {t('branches.fields.name')}{' '}
                      <span className="text-destructive">*</span>
                    </FieldLabel>
                    <Input
                      id="name"
                      placeholder={t('branches.fields.name.placeholder')}
                      value={field.state.value}
                      onChange={(e) => {
                        field.handleChange(e.target.value)
                        setFormDirty(true)
                      }}
                      onBlur={field.handleBlur}
                    />
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                )
              }}
            />

            <form.Field
              name="description"
              children={(field) => {
                const isInvalid = field.state.meta.errors.length > 0
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor="description">
                      {t('branches.fields.description')}
                    </FieldLabel>
                    <Textarea
                      id="description"
                      placeholder={t('branches.fields.description.placeholder')}
                      value={field.state.value}
                      onChange={(e) => {
                        field.handleChange(e.target.value)
                        setFormDirty(true)
                      }}
                      onBlur={field.handleBlur}
                    />
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
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
              {t('branches.confirmLeave.title', 'Discard unsaved changes?')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'branches.confirmLeave.description',
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
              {t('branches.confirmLeave.discard', 'Discard')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
