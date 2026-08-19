import { Outlet, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useAuth } from '~/lib/auth'
import { isCatechist } from '~/lib/permissions'

export const Route = createFileRoute('/_authenticated/_catechist')({
  component: CatechistLayout,
})

function CatechistLayout() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const allowed = isCatechist(user)

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
