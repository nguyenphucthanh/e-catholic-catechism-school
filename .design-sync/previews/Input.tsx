import { Input } from '~/components/ui/input'

export function Default() {
  return (
    <div className="flex w-64 flex-col gap-3">
      <Input placeholder="Nguyễn Văn An" />
      <Input type="email" placeholder="phuhuynh@example.com" />
    </div>
  )
}

export function Disabled() {
  return <Input disabled value="Nguyễn Văn An" className="w-64" readOnly />
}

export function Invalid() {
  return (
    <Input
      aria-invalid="true"
      defaultValue="0912"
      placeholder="+84912345678"
      className="w-64"
    />
  )
}
