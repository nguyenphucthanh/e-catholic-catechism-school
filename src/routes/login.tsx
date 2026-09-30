import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { useAction, useQuery } from 'convex/react'
import { Trans, useTranslation } from 'react-i18next'
import { z } from 'zod'
import { useMemo, useState } from 'react'
import { AlertTriangle, SchoolIcon } from 'lucide-react'
import { api } from '../../convex/_generated/api'
import { useAuth } from '~/lib/auth'
import { useRouteGuard } from '~/hooks/use-route-guard'
import { useRecaptcha } from '~/hooks/use-recaptcha'
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
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert'
import { translateConvexError } from '~/lib/convex-errors'
import { cn } from '~/lib/utils'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const { t } = useTranslation()
  const { login, user, isHydrated } = useAuth()
  const navigate = useNavigate()
  const loginAction = useAction(api.auth.loginWithRecaptcha)
  const { executeRecaptcha, siteKey } = useRecaptcha()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const appConfig = useQuery(api.appConfig.get)

  const loginSchema = useMemo(
    () =>
      z.object({
        loginId: z.string().trim().min(1, t('auth.loginId.required')),
        password: z.string().min(1, t('auth.password.required')),
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
        const recaptchaToken = await executeRecaptcha('login')
        const loginResult = await loginAction({
          loginId: value.loginId,
          password: value.password,
          recaptchaToken: recaptchaToken ?? undefined,
        })
        login(loginResult)
        await navigate({ to: '/dashboard' })
      } catch (error) {
        setSubmitError(translateConvexError(error, t))
      }
    },
  })

  const { ready } = useRouteGuard({
    pending: isHydrated === false,
    allowed: !user,
    redirectTo: '/dashboard',
  })

  if (!ready) {
    return null
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div
            className={cn(
              'mx-auto mb-2 flex size-36 items-center justify-center rounded-xl font-bold text-lg',
              appConfig?.logoUrl?.trim()
                ? ''
                : 'bg-primary text-primary-foreground ',
            )}
          >
            {appConfig?.logoUrl ? (
              <img
                src={appConfig.logoUrl}
                alt=""
                className="size-32 rounded object-contain"
              />
            ) : (
              <SchoolIcon className="size-32" />
            )}
          </div>
          {appConfig?.parishName && (
            <CardTitle className="text-xl">{appConfig.parishName}</CardTitle>
          )}
          {appConfig?.troopName && <CardTitle>{appConfig.troopName}</CardTitle>}
          <CardDescription>{t('auth.subtitle')}</CardDescription>
        </CardHeader>

        <CardContent>
          {!siteKey && (
            <Alert className="mb-4 border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-200">
              <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
              <AlertTitle>{t('auth.recaptchaMissingTitle')}</AlertTitle>
              <AlertDescription className="text-amber-800/90 dark:text-amber-300/90">
                {t('auth.recaptchaMissingWarning')}
              </AlertDescription>
            </Alert>
          )}

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
                    <FieldLabel htmlFor="loginId">
                      {t('auth.loginId')}
                    </FieldLabel>
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
        <CardFooter className="flex flex-col gap-3 text-center justify-center text-foreground/50 bg-transparent border-none">
          {siteKey && (
            <p className="text-xs text-muted-foreground/70 leading-relaxed px-2">
              <Trans
                i18nKey="auth.recaptchaNotice"
                components={{
                  privacyLink: (
                    <a
                      href="https://policies.google.com/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-foreground"
                    />
                  ),
                  termsLink: (
                    <a
                      href="https://policies.google.com/terms"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-foreground"
                    />
                  ),
                }}
              />
            </p>
          )}
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
