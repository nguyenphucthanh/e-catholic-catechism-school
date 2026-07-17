import { Checkbox } from '~/components/ui/checkbox'
import { Label } from '~/components/ui/label'

export function Default() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Checkbox id="c1" />
        <Label htmlFor="c1">Đã nộp học phí</Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="c2" defaultChecked />
        <Label htmlFor="c2">Đã điểm danh</Label>
      </div>
    </div>
  )
}

export function Disabled() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Checkbox id="c3" disabled />
        <Label htmlFor="c3">Đã nộp học phí</Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="c4" disabled defaultChecked />
        <Label htmlFor="c4">Đã điểm danh</Label>
      </div>
    </div>
  )
}
