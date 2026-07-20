import { Button } from '~/components/ui/button'
import { Plus, Trash2, ChevronRight } from 'lucide-react'

export function Variants() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="default">Primary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Delete</Button>
      <Button variant="link">Link</Button>
    </div>
  )
}

export function Sizes() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="xs">Extra small</Button>
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
    </div>
  )
}

export function WithIcon() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button>
        <Plus />
        Add student
      </Button>
      <Button variant="outline">
        Continue
        <ChevronRight />
      </Button>
      <Button variant="destructive" size="icon">
        <Trash2 />
      </Button>
    </div>
  )
}

export function Disabled() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button disabled>Primary</Button>
      <Button variant="outline" disabled>
        Outline
      </Button>
    </div>
  )
}
