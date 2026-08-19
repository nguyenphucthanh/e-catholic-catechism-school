import { Outlet, createFileRoute } from '@tanstack/react-router'
import { useAuth } from '~/lib/auth'
import { useRouteGuard } from '~/hooks/use-route-guard'

export const Route = createFileRoute('/_authenticated/_student')({
  component: StudentLayout,
})

function StudentLayout() {
  const { user } = useAuth()
  const { ready } = useRouteGuard({
    allowed: user?.accountType === 'student',
    redirectTo: '/dashboard',
  })

  if (!ready) {
    return null
  }

  return <Outlet />
}
