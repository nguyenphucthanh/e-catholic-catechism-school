import { Calendar } from '~/components/ui/calendar'

export function Default() {
  return (
    <Calendar
      mode="single"
      selected={new Date(2026, 6, 19)}
      defaultMonth={new Date(2026, 6, 1)}
      className="rounded-lg border"
    />
  )
}
