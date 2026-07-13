import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/help/')({
  beforeLoad: () => {
    throw redirect({
      to: '/help/$role',
      params: { role: 'student' },
    })
  },
})
