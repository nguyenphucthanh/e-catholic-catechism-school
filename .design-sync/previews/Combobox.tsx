import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from '~/components/ui/combobox'
import { Label } from '~/components/ui/label'

const classes = [
  'Khai Tâm',
  'Sơ Cấp 1',
  'Sơ Cấp 2',
  'Chuyên Cần 1',
  'Chuyên Cần 2',
  'Vào Đời',
]

export function Default() {
  return (
    <div className="flex w-56 flex-col gap-1.5">
      <Label htmlFor="combo-class">Lớp giáo lý</Label>
      <Combobox items={classes} defaultValue="Sơ Cấp 1">
        <ComboboxInput id="combo-class" placeholder="Tìm lớp học..." />
        <ComboboxContent>
          <ComboboxEmpty>Không tìm thấy lớp học.</ComboboxEmpty>
          <ComboboxList>
            {(item: string) => (
              <ComboboxItem key={item} value={item}>
                {item}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  )
}

export function Empty() {
  return (
    <div className="flex w-56 flex-col gap-1.5">
      <Label htmlFor="combo-teacher">Giáo lý viên phụ trách</Label>
      <Combobox items={classes}>
        <ComboboxInput id="combo-teacher" placeholder="Tìm giáo lý viên..." />
        <ComboboxContent>
          <ComboboxEmpty>Không tìm thấy lớp học.</ComboboxEmpty>
          <ComboboxList>
            {(item: string) => (
              <ComboboxItem key={item} value={item}>
                {item}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  )
}
