import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group'
import { Label } from '~/components/ui/label'

export function Default() {
  return (
    <RadioGroup defaultValue="sc1" className="gap-3">
      <div className="flex items-center gap-2">
        <RadioGroupItem value="kt" id="r-kt" />
        <Label htmlFor="r-kt">Khai Tâm</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="sc1" id="r-sc1" />
        <Label htmlFor="r-sc1">Sơ Cấp 1</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="sc2" id="r-sc2" />
        <Label htmlFor="r-sc2">Sơ Cấp 2</Label>
      </div>
    </RadioGroup>
  )
}

export function Disabled() {
  return (
    <RadioGroup defaultValue="sc1" className="gap-3">
      <div className="flex items-center gap-2">
        <RadioGroupItem value="kt" id="rd-kt" disabled />
        <Label htmlFor="rd-kt">Khai Tâm</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="sc1" id="rd-sc1" disabled />
        <Label htmlFor="rd-sc1">Sơ Cấp 1</Label>
      </div>
    </RadioGroup>
  )
}
