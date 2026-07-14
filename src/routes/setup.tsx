import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { useMutation } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { useState } from 'react'
import { SchoolIcon } from 'lucide-react'
import { api } from '../../convex/_generated/api'
import { useAuth } from '~/lib/auth'
import { translateConvexError } from '~/lib/convex-errors'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Button } from '~/components/ui/button'
import { Field, FieldError, FieldLabel } from '~/components/ui/field'
import { Alert, AlertDescription } from '~/components/ui/alert'

export const Route = createFileRoute('/setup')({
  component: SetupPage,
})

const setupSchema = z
  .object({
    fullName: z.string().min(1),
    saintName: z.string().optional(),
    loginId: z.string().min(1),
    password: z.string().min(8),
    confirmPassword: z.string().min(1),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
  })

function SetupPage() {
  const { t } = useTranslation()
  const { login } = useAuth()
  const navigate = useNavigate()
  const runSetup = useMutation(api.setup.runSetup)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: {
      fullName: '',
      saintName: '',
      loginId: '',
      password: '',
      confirmPassword: '',
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null)
      const result = setupSchema.safeParse(value)
      if (!result.success) return

      try {
        const user = await runSetup({
          fullName: value.fullName,
          saintName: value.saintName || undefined,
          loginId: value.loginId,
          password: value.password,
        })
        login(user)
        await navigate({ to: '/app-config' })
      } catch (error) {
        setSubmitError(translateConvexError(error, t, 'setup.error'))
      }
    },
  })

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-lg">
            <SchoolIcon />
          </div>
          <CardTitle className="text-xl">{t('setup.title')}</CardTitle>
          <CardDescription>{t('setup.subtitle')}</CardDescription>
        </CardHeader>

        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              form.handleSubmit()
            }}
            className="flex flex-col gap-4"
          >
            <form.Field
              name="fullName"
              validators={{
                onBlur: ({ value }) => {
                  const r = z.string().min(1).safeParse(value)
                  return r.success ? undefined : t('setup.fullName.required')
                },
              }}
              children={(field) => (
                <Field data-invalid={field.state.meta.errors.length > 0}>
                  <FieldLabel htmlFor="fullName">
                    {t('setup.fullName')}
                  </FieldLabel>
                  <Input
                    id="fullName"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    autoComplete="name"
                  />
                  {field.state.meta.errors.length > 0 && (
                    <FieldError
                      errors={field.state.meta.errors.map((message) => ({
                        message,
                      }))}
                    />
                  )}
                </Field>
              )}
            />

            <form.Field
              name="saintName"
              children={(field) => (
                <Field>
                  <FieldLabel htmlFor="saintName">
                    {t('setup.saintName')}
                  </FieldLabel>
                  <Input
                    id="saintName"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                </Field>
              )}
            />

            <form.Field
              name="loginId"
              validators={{
                onBlur: ({ value }) => {
                  const r = z.string().min(1).safeParse(value)
                  return r.success ? undefined : t('setup.loginId.required')
                },
              }}
              children={(field) => (
                <Field data-invalid={field.state.meta.errors.length > 0}>
                  <FieldLabel htmlFor="loginId">
                    {t('setup.loginId')}
                  </FieldLabel>
                  <Input
                    id="loginId"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    autoComplete="username"
                  />
                  {field.state.meta.errors.length > 0 && (
                    <FieldError
                      errors={field.state.meta.errors.map((message) => ({
                        message,
                      }))}
                    />
                  )}
                </Field>
              )}
            />

            <form.Field
              name="password"
              validators={{
                onBlur: ({ value }) => {
                  const r = z.string().min(8).safeParse(value)
                  return r.success ? undefined : t('setup.password.min')
                },
              }}
              children={(field) => (
                <Field data-invalid={field.state.meta.errors.length > 0}>
                  <FieldLabel htmlFor="password">
                    {t('setup.password')}
                  </FieldLabel>
                  <Input
                    id="password"
                    type="password"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    autoComplete="new-password"
                  />
                  {field.state.meta.errors.length > 0 && (
                    <FieldError
                      errors={field.state.meta.errors.map((message) => ({
                        message,
                      }))}
                    />
                  )}
                </Field>
              )}
            />

            <form.Field
              name="confirmPassword"
              validators={{
                onBlurListenTo: ['password'],
                onBlur: ({ value, fieldApi }) => {
                  const password = fieldApi.form.getFieldValue('password')
                  return value === password
                    ? undefined
                    : t('setup.confirmPassword.mismatch')
                },
              }}
              children={(field) => (
                <Field data-invalid={field.state.meta.errors.length > 0}>
                  <FieldLabel htmlFor="confirmPassword">
                    {t('setup.confirmPassword')}
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
                    <FieldError
                      errors={field.state.meta.errors.map((message) => ({
                        message,
                      }))}
                    />
                  )}
                </Field>
              )}
            />

            <form.Subscribe
              selector={(s) => ({
                isSubmitting: s.isSubmitting,
              })}
              children={({ isSubmitting }) => (
                <>
                  {submitError && (
                    <Alert variant="destructive">
                      <AlertDescription>{submitError}</AlertDescription>
                    </Alert>
                  )}
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? t('setup.submitting') : t('setup.submit')}
                  </Button>
                </>
              )}
            />
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
