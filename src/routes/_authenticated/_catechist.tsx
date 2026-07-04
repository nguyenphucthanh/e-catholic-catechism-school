import { Navigate, Outlet, createFileRoute } from '@tanstack/react-router'
import { useAuth } from '~/lib/auth'
import { isCatechist } from '~/lib/permissions'

export const Route = createFileRoute('/_authenticated/_catechist')({
  component: CatechistLayout,
})

function CatechistLayout() {
  const { user } = useAuth()

  if (!isCatechist(user)) {
    return <Navigate to="/dashboard" />
  }

  return <Outlet />
}
