import { createFileRoute } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { useMutation } from 'convex/react'
import { Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'
import { api } from '../../../convex/_generated/api'
import { useAuth } from '~/lib/auth'
import { PageHeader } from '~/components/page-header'
import { Card, CardContent } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Button } from '~/components/ui/button'
import { Field, FieldError, FieldLabel } from '~/components/ui/field'

export const Route = createFileRoute('/_authenticated/change-password')({
  component: ChangePasswordPage,
  staticData: { crumb: 'password.title' },
})

function ChangePasswordPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const changePasswordMutation = useMutation(api.auth.changePassword)

  const form = useForm({
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    onSubmit: async ({ value }) => {
      try {
        await changePasswordMutation({
          loginId: user!.memberId,
          oldPassword: value.currentPassword,
          newPassword: value.newPassword,
        })
        toast.success(t('password.success'))
        form.reset()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e))
      }
    },
  })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Lock}
        title={t('password.title')}
        subtitle={t('password.subtitle')}
      />

      <Card>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              form.handleSubmit()
            }}
            className="flex flex-col gap-4"
          >
            <form.Field
              name="currentPassword"
              validators={{
                onBlur: ({ value }) => {
                  const r = z.string().min(1).safeParse(value)
                  return r.success ? undefined : t('password.current.required')
                },
                onSubmit: ({ value }) => {
                  const r = z.string().min(1).safeParse(value)
                  return r.success ? undefined : t('password.current.required')
                },
              }}
              children={(field) => (
                <Field data-invalid={field.state.meta.errors.length > 0}>
                  <FieldLabel htmlFor="currentPassword">
                    {t('password.current')}
                  </FieldLabel>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    autoComplete="current-password"
                  />
                  {field.state.meta.errors.length > 0 && (
                    <FieldError errors={field.state.meta.errors} />
                  )}
                </Field>
              )}
            />

            <form.Field
              name="newPassword"
              validators={{
                onBlur: ({ value }) => {
                  const r = z.string().min(8).safeParse(value)
                  return r.success ? undefined : t('password.new.min')
                },
                onSubmit: ({ value }) => {
                  const r = z.string().min(8).safeParse(value)
                  return r.success ? undefined : t('password.new.min')
                },
              }}
              children={(field) => (
                <Field data-invalid={field.state.meta.errors.length > 0}>
                  <FieldLabel htmlFor="newPassword">
                    {t('password.new')}
                  </FieldLabel>
                  <Input
                    id="newPassword"
                    type="password"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    autoComplete="new-password"
                  />
                  {field.state.meta.errors.length > 0 && (
                    <FieldError errors={field.state.meta.errors} />
                  )}
                </Field>
              )}
            />

            <form.Field
              name="confirmPassword"
              validators={{
                onBlur: ({ value, fieldApi }) => {
                  const newPw = fieldApi.form.getFieldValue('newPassword')
                  return value !== newPw
                    ? t('password.confirm.mismatch')
                    : undefined
                },
                onSubmit: ({ value, fieldApi }) => {
                  const newPw = fieldApi.form.getFieldValue('newPassword')
                  return value !== newPw
                    ? t('password.confirm.mismatch')
                    : undefined
                },
              }}
              children={(field) => (
                <Field data-invalid={field.state.meta.errors.length > 0}>
                  <FieldLabel htmlFor="confirmPassword">
                    {t('password.confirm')}
                  </FieldLabel>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    autoComplete="new-password"
                  />
                  {field.state.meta.errors.length > 0 && (
                    <FieldError errors={field.state.meta.errors} />
                  )}
                </Field>
              )}
            />

            <form.Subscribe
              selector={(s) => ({ isSubmitting: s.isSubmitting })}
              children={({ isSubmitting }) => (
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? t('password.submitting')
                    : t('password.submit')}
                </Button>
              )}
            />
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
