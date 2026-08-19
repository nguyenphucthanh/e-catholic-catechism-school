import { Outlet, createFileRoute } from '@tanstack/react-router'
import { useAuth } from '~/lib/auth'
import { isAdmin } from '~/lib/permissions'
import { useRouteGuard } from '~/hooks/use-route-guard'

export const Route = createFileRoute('/_authenticated/_catechist/_admin')({
  component: AdminLayout,
})

function AdminLayout() {
  const { user } = useAuth()
  const { ready } = useRouteGuard({
    allowed: isAdmin(user),
    redirectTo: '/dashboard',
  })

  if (!ready) {
    return null
  }

  return <Outlet />
}
