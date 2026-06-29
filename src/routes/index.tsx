import { Navigate, createFileRoute } from '@tanstack/react-router'
import { useAuth } from '~/lib/auth'

export const Route = createFileRoute('/')({
  component: IndexPage,
})

function IndexPage() {
  const { user } = useAuth()
  return <Navigate to={user ? '/dashboard' : '/login'} />
}
