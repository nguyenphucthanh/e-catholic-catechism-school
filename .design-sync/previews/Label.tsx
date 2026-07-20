import { Label } from '~/components/ui/label'
import { Input } from '~/components/ui/input'
import { Checkbox } from '~/components/ui/checkbox'

export function Default() {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="label-name">Họ và tên học sinh</Label>
      <Input id="label-name" placeholder="Nguyễn Văn An" className="w-64" />
    </div>
  )
}

export function WithCheckbox() {
  return (
    <div className="flex items-center gap-2">
      <Checkbox id="label-consent" />
      <Label htmlFor="label-consent">
        Đồng ý cho phép chụp ảnh trong lớp học
      </Label>
    </div>
  )
}

export function Disabled() {
  return (
    <div className="group flex items-center gap-2" data-disabled="true">
      <Checkbox id="label-disabled" disabled />
      <Label htmlFor="label-disabled">Không áp dụng cho lớp này</Label>
    </div>
  )
}
