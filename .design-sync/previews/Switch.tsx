import { Switch } from '~/components/ui/switch'
import { Label } from '~/components/ui/label'

export function Default() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Switch id="s1" />
        <Label htmlFor="s1">Thông báo qua email</Label>
      </div>
      <div className="flex items-center gap-2">
        <Switch id="s2" defaultChecked />
        <Label htmlFor="s2">Thông báo qua SMS</Label>
      </div>
    </div>
  )
}

export function Small() {
  return (
    <div className="flex items-center gap-2">
      <Switch id="s3" size="sm" defaultChecked />
      <Label htmlFor="s3">Chế độ nhắc nhở</Label>
    </div>
  )
}

export function Disabled() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Switch id="s4" disabled />
        <Label htmlFor="s4">Thông báo qua email</Label>
      </div>
      <div className="flex items-center gap-2">
        <Switch id="s5" disabled defaultChecked />
        <Label htmlFor="s5">Thông báo qua SMS</Label>
      </div>
    </div>
  )
}
