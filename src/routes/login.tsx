import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { useMutation } from 'convex/react'
import { z } from 'zod'
import { api } from '../../convex/_generated/api'
import { useAuth } from '~/lib/auth'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Button } from '~/components/ui/button'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

const loginSchema = z.object({
  loginId: z.string().min(1, 'Vui lòng nhập mã thành viên'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
})

function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const loginMutation = useMutation(api.auth.login)

  const form = useForm({
    defaultValues: { loginId: '', password: '' },
    onSubmit: async ({ value }) => {
      const result = loginSchema.safeParse(value)
      if (!result.success) return

      const user = await loginMutation({
        loginId: value.loginId,
        password: value.password,
      })
      login(user)
      await navigate({ to: '/dashboard' })
    },
  })

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-lg">
            GL
          </div>
          <CardTitle className="text-xl">Trường Giáo Lý</CardTitle>
          <CardDescription>Đăng nhập để tiếp tục</CardDescription>
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
                  const r = z
                    .string()
                    .min(1, 'Vui lòng nhập mã thành viên')
                    .safeParse(value)
                  return r.success ? undefined : r.error.issues[0].message
                },
              }}
              children={(field) => (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="loginId">Mã thành viên</Label>
                  <Input
                    id="loginId"
                    placeholder="000001"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    autoComplete="username"
                  />
                  {field.state.meta.errors.length > 0 && (
                    <p className="text-sm text-destructive">
                      {field.state.meta.errors[0]}
                    </p>
                  )}
                </div>
              )}
            />

            <form.Field
              name="password"
              validators={{
                onBlur: ({ value }) => {
                  const r = z
                    .string()
                    .min(1, 'Vui lòng nhập mật khẩu')
                    .safeParse(value)
                  return r.success ? undefined : r.error.issues[0].message
                },
              }}
              children={(field) => (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="password">Mật khẩu</Label>
                  <Input
                    id="password"
                    type="password"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    autoComplete="current-password"
                  />
                  {field.state.meta.errors.length > 0 && (
                    <p className="text-sm text-destructive">
                      {field.state.meta.errors[0]}
                    </p>
                  )}
                </div>
              )}
            />

            <form.Subscribe
              selector={(s) => ({
                isSubmitting: s.isSubmitting,
                errors: s.errors,
              })}
              children={({ isSubmitting, errors }) => (
                <>
                  {errors.length > 0 && (
                    <p className="text-sm text-destructive text-center">
                      {String(errors[0])}
                    </p>
                  )}
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
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
