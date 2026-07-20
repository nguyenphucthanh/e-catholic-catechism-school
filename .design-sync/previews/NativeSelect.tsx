import { NativeSelect, NativeSelectOption } from '~/components/ui/native-select'

const classes = [
  'Khai Tâm',
  'Sơ Cấp 1',
  'Sơ Cấp 2',
  'Chuyên Cần 1',
  'Chuyên Cần 2',
]

export function Default() {
  return (
    <NativeSelect defaultValue="Sơ Cấp 1" className="w-48">
      {classes.map((c) => (
        <NativeSelectOption key={c} value={c}>
          {c}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  )
}

export function Small() {
  return (
    <NativeSelect size="sm" defaultValue="Sơ Cấp 1" className="w-40">
      {classes.map((c) => (
        <NativeSelectOption key={c} value={c}>
          {c}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  )
}

export function Disabled() {
  return (
    <NativeSelect disabled defaultValue="Sơ Cấp 1" className="w-48">
      {classes.map((c) => (
        <NativeSelectOption key={c} value={c}>
          {c}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  )
}
