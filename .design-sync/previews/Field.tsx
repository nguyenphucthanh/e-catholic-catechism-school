import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldGroup,
} from '~/components/ui/field'
import { Input } from '~/components/ui/input'
import { Switch } from '~/components/ui/switch'

export function TextField() {
  return (
    <FieldGroup className="w-72">
      <Field>
        <FieldLabel htmlFor="field-name">Họ và tên</FieldLabel>
        <Input id="field-name" placeholder="Nguyễn Văn An" />
        <FieldDescription>Theo giấy khai sinh hoặc rửa tội.</FieldDescription>
      </Field>
    </FieldGroup>
  )
}

export function ErrorState() {
  return (
    <FieldGroup className="w-72">
      <Field data-invalid="true">
        <FieldLabel htmlFor="field-phone">Số điện thoại phụ huynh</FieldLabel>
        <Input id="field-phone" aria-invalid="true" defaultValue="0912" />
        <FieldError>Số điện thoại phải theo định dạng +84912345678.</FieldError>
      </Field>
    </FieldGroup>
  )
}

export function HorizontalControl() {
  return (
    <FieldGroup className="w-80">
      <Field orientation="horizontal">
        <FieldLabel htmlFor="field-notify" className="flex-1">
          Nhắc lịch học qua email
        </FieldLabel>
        <Switch id="field-notify" defaultChecked />
      </Field>
    </FieldGroup>
  )
}
