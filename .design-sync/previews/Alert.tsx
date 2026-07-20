import { CircleCheckIcon, TriangleAlertIcon } from 'lucide-react'
import { Alert, AlertTitle, AlertDescription } from '~/components/ui/alert'

export function Default() {
  return (
    <Alert className="w-96">
      <CircleCheckIcon />
      <AlertTitle>Attendance submitted</AlertTitle>
      <AlertDescription>
        Attendance for Sơ Cấp 1 was recorded for today's class.
      </AlertDescription>
    </Alert>
  )
}

export function Destructive() {
  return (
    <Alert variant="destructive" className="w-96">
      <TriangleAlertIcon />
      <AlertTitle>Low attendance warning</AlertTitle>
      <AlertDescription>
        Nguyễn Văn An has missed 4 classes in a row. Contact the parent before
        Sunday.
      </AlertDescription>
    </Alert>
  )
}
