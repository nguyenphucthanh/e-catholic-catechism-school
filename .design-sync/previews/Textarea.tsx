import { Textarea } from '~/components/ui/textarea'

export function Default() {
  return (
    <Textarea
      className="w-72"
      placeholder="Ghi chú về tình hình học tập của học sinh..."
    />
  )
}

export function Disabled() {
  return (
    <Textarea
      className="w-72"
      disabled
      value="Học sinh nghỉ học do ốm, đã báo với giáo lý viên."
      readOnly
    />
  )
}

export function Invalid() {
  return (
    <Textarea
      className="w-72"
      aria-invalid="true"
      placeholder="Bắt buộc nhập lý do nghỉ học"
    />
  )
}
