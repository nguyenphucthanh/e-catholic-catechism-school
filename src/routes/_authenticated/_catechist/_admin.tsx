import { Outlet, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useAuth } from '~/lib/auth'
import { isAdmin } from '~/lib/permissions'

export const Route = createFileRoute('/_authenticated/_catechist/_admin')({
  component: AdminLayout,
})

function AdminLayout() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const allowed = isAdmin(user)

  useEffect(() => {
    if (!allowed) {
      void navigate({ to: '/dashboard' })
    }
  }, [allowed, navigate])

  if (!allowed) {
    return null
  }

  return <Outlet />
}
