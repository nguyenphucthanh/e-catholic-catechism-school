import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/anotherPage')({
  component: () => <div>Placeholder</div>,
})
