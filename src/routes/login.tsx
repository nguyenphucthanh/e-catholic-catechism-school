import {
  Link,
  Navigate,
  createFileRoute,
  useNavigate,
} from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { useMemo, useState } from 'react'
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
import { translateConvexError } from '~/lib/convex-errors'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const { t } = useTranslation()
  const { login, user } = useAuth()
  const navigate = useNavigate()
  const loginMutation = useMutation(api.auth.login)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const appConfig = useQuery(api.appConfig.get)

  const loginSchema = useMemo(
    () =>
      z.object({
        loginId: z
          .string()
          .trim()
          .min(1, t('auth.loginId.required')),
        password: z
          .string()
          .min(1, t('auth.password.required')),
      }),
    [t],
  )

  const form = useForm({
    defaultValues: { loginId: '', password: '' },
    validators: {
      onSubmit: loginSchema,
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null)
      try {
        const loginResult = await loginMutation({
          loginId: value.loginId,
          password: value.password,
        })
        login(loginResult)
        await navigate({ to: '/dashboard' })
      } catch (error) {
        setSubmitError(translateConvexError(error, t))
      }
    },
  })

  if (user) {
    return <Navigate to="/dashboard" />
  }

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
              children={(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor="loginId">{t('auth.loginId')}</FieldLabel>
                    <Input
                      id="loginId"
                      name={field.name}
                      placeholder={t('auth.loginId.placeholder')}
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
                      {t('auth.password')}
                    </FieldLabel>
                    <Input
                      id="password"
                      name={field.name}
                      type="password"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      autoComplete="current-password"
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
                    {isSubmitting ? t('auth.logging_in') : t('auth.login')}
                  </Button>
                </>
              )}
            />
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 text-center justify-center text-foreground/50 bg-transparent border-none">
          <div className="flex gap-4 items-center text-sm font-medium">
            <Link
              to="/help"
              className="text-primary hover:underline transition-all"
            >
              {t('help.center')}
            </Link>
            <span className="text-muted-foreground/30">|</span>
            <a
              href="https://github.com/nguyenphucthanh/e-catholic-catechism-school"
              target="_blank"
              className="hover:underline hover:text-foreground transition-all"
            >
              {t('app.name')}
            </a>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
