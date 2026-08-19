import { Outlet, createFileRoute } from '@tanstack/react-router'
import { useAuth } from '~/lib/auth'
import { isCatechist } from '~/lib/permissions'
import { useRouteGuard } from '~/hooks/use-route-guard'

export const Route = createFileRoute('/_authenticated/_catechist')({
  component: CatechistLayout,
})

function CatechistLayout() {
  const { user } = useAuth()
  const { ready } = useRouteGuard({
    allowed: isCatechist(user),
    redirectTo: '/dashboard',
  })

  if (!ready) {
    return null
  }

  return <Outlet />
}
