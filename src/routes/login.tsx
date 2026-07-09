import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { useState } from 'react'
import { SchoolIcon } from 'lucide-react'
import { api } from '../../convex/_generated/api'
import { useAuth } from '~/lib/auth'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Button } from '~/components/ui/button'
import { Field, FieldError, FieldLabel } from '~/components/ui/field'
import { Alert, AlertDescription } from '~/components/ui/alert'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const { t } = useTranslation()
  const { login } = useAuth()
  const navigate = useNavigate()
  const loginMutation = useMutation(api.auth.login)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const appConfig = useQuery(api.appConfig.get)

  const form = useForm({
    defaultValues: { loginId: '', password: '' },
    onSubmit: async ({ value }) => {
      setSubmitError(null)
      const result = z
        .object({ loginId: z.string().min(1), password: z.string().min(1) })
        .safeParse(value)
      if (!result.success) return

      try {
        const user = await loginMutation({
          loginId: value.loginId,
          password: value.password,
        })
        login(user)
        await navigate({ to: '/dashboard' })
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : 'Login failed')
      }
    },
  })

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-lg">
            {appConfig?.logoUrl ? (
              <img
                src={appConfig.logoUrl}
                alt=""
                className="size-12 rounded object-contain"
              />
            ) : (
              <SchoolIcon />
            )}
          </div>
          {appConfig?.parishName && (
            <CardTitle className="text-xl">{appConfig.parishName}</CardTitle>
          )}
          {appConfig?.troopName && <CardTitle>{appConfig.troopName}</CardTitle>}
          <CardDescription>{t('auth.subtitle')}</CardDescription>
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
              name="loginId"
              validators={{
                onBlur: ({ value }) => {
                  const r = z.string().min(1).safeParse(value)
                  return r.success ? undefined : t('auth.loginId.required')
                },
              }}
              children={(field) => (
                <Field data-invalid={field.state.meta.errors.length > 0}>
                  <FieldLabel htmlFor="loginId">{t('auth.loginId')}</FieldLabel>
                  <Input
                    id="loginId"
                    placeholder={t('auth.loginId.placeholder')}
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
                  const r = z.string().min(1).safeParse(value)
                  return r.success ? undefined : t('auth.password.required')
                },
              }}
              children={(field) => (
                <Field data-invalid={field.state.meta.errors.length > 0}>
                  <FieldLabel htmlFor="password">
                    {t('auth.password')}
                  </FieldLabel>
                  <Input
                    id="password"
                    type="password"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    autoComplete="current-password"
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
                    {isSubmitting ? t('auth.logging_in') : t('auth.login')}
                  </Button>
                </>
              )}
            />
          </form>
        </CardContent>
        <CardFooter className="text-center justify-center text-foreground/50 bg-transparent border-none">
          <a
            href="https://github.com/nguyenphucthanh/e-catholic-catechism-school"
            target="_blank"
          >
            {t('app.name')}
          </a>
        </CardFooter>
      </Card>
    </div>
  )
}
