import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'

const classes = [
  'Khai Tâm',
  'Sơ Cấp 1',
  'Sơ Cấp 2',
  'Chuyên Cần 1',
  'Chuyên Cần 2',
]

export function Default() {
  return (
    <Select defaultValue="Sơ Cấp 1">
      <SelectTrigger className="w-48">
        <SelectValue placeholder="Chọn lớp học" />
      </SelectTrigger>
      <SelectContent>
        {classes.map((c) => (
          <SelectItem key={c} value={c}>
            {c}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function Small() {
  return (
    <Select defaultValue="Sơ Cấp 1">
      <SelectTrigger size="sm" className="w-40">
        <SelectValue placeholder="Chọn lớp học" />
      </SelectTrigger>
      <SelectContent>
        {classes.map((c) => (
          <SelectItem key={c} value={c}>
            {c}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function Disabled() {
  return (
    <Select defaultValue="Sơ Cấp 1" disabled>
      <SelectTrigger className="w-48">
        <SelectValue placeholder="Chọn lớp học" />
      </SelectTrigger>
      <SelectContent>
        {classes.map((c) => (
          <SelectItem key={c} value={c}>
            {c}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
