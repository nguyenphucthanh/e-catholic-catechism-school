import { Navigate, Outlet, createFileRoute } from '@tanstack/react-router'
import { useAuth } from '~/lib/auth'
import { isAdmin } from '~/lib/permissions'

export const Route = createFileRoute('/_authenticated/_catechist/_admin')({
  component: AdminLayout,
})

function AdminLayout() {
  const { user } = useAuth()

  if (!isAdmin(user)) {
    return <Navigate to="/dashboard" />
  }

  return <Outlet />
}
