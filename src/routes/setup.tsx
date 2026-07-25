import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { useMutation } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { useMemo, useState } from 'react'
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

function SetupPage() {
  const { t } = useTranslation()
  const { login } = useAuth()
  const navigate = useNavigate()
  const runSetup = useMutation(api.setup.runSetup)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const setupSchema = useMemo(
    () =>
      z
        .object({
          fullName: z
            .string()
            .trim()
            .min(1, t('setup.fullName.required')),
          saintName: z.string().optional(),
          loginId: z
            .string()
            .trim()
            .min(1, t('setup.loginId.required')),
          password: z
            .string()
            .min(8, t('setup.password.min')),
          confirmPassword: z
            .string()
            .min(1, t('setup.confirmPassword.mismatch')),
        })
        .refine((v) => v.password === v.confirmPassword, {
          message: t('setup.confirmPassword.mismatch'),
          path: ['confirmPassword'],
        }),
    [t],
  )

  const form = useForm({
    defaultValues: {
      fullName: '',
      saintName: '',
      loginId: '',
      password: '',
      confirmPassword: '',
    },
    validators: {
      onSubmit: setupSchema,
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null)
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
              children={(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor="fullName">
                      {t('setup.fullName')}
                    </FieldLabel>
                    <Input
                      id="fullName"
                      name={field.name}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      autoComplete="name"
                      aria-invalid={isInvalid}
                    />
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            />

            <form.Field
              name="saintName"
              children={(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor="saintName">
                      {t('setup.saintName')}
                    </FieldLabel>
                    <Input
                      id="saintName"
                      name={field.name}
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

            <form.Field
              name="loginId"
              children={(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor="loginId">
                      {t('setup.loginId')}
                    </FieldLabel>
                    <Input
                      id="loginId"
                      name={field.name}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      autoComplete="username"
                      aria-invalid={isInvalid}
                    />
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            />

            <form.Field
              name="password"
              children={(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor="password">
                      {t('setup.password')}
                    </FieldLabel>
                    <Input
                      id="password"
                      name={field.name}
                      type="password"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      autoComplete="new-password"
                      aria-invalid={isInvalid}
                    />
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            />

            <form.Field
              name="confirmPassword"
              children={(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor="confirmPassword">
                      {t('setup.confirmPassword')}
                    </FieldLabel>
                    <Input
                      id="confirmPassword"
                      name={field.name}
                      type="password"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      autoComplete="new-password"
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
