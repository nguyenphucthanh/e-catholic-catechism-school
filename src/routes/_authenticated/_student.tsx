import { Navigate, Outlet, createFileRoute } from '@tanstack/react-router'
import { useAuth } from '~/lib/auth'

export const Route = createFileRoute('/_authenticated/_student')({
  component: StudentLayout,
})

function StudentLayout() {
  const { user } = useAuth()

  if (user?.accountType !== 'student') {
    return <Navigate to="/dashboard" />
  }

  return <Outlet />
}
