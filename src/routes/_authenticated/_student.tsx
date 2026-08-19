import { Outlet, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useAuth } from '~/lib/auth'

export const Route = createFileRoute('/_authenticated/_student')({
  component: StudentLayout,
})

function StudentLayout() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isStudent = user?.accountType === 'student'

  useEffect(() => {
    if (!isStudent) {
      void navigate({ to: '/dashboard' })
    }
  }, [isStudent, navigate])

  if (!isStudent) {
    return null
  }

  return <Outlet />
}
