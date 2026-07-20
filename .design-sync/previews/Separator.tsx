import { Separator } from '~/components/ui/separator'

export function Horizontal() {
  return (
    <div className="w-[320px] space-y-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">Trường Giáo Lý</p>
        <p className="text-sm text-muted-foreground">
          Catechism school management
        </p>
      </div>
      <Separator />
      <div className="space-y-1">
        <p className="text-sm font-medium">Class roster</p>
        <p className="text-sm text-muted-foreground">32 students enrolled</p>
      </div>
    </div>
  )
}

export function Vertical() {
  return (
    <div className="flex h-8 items-center gap-4 text-sm">
      <span>Overview</span>
      <Separator orientation="vertical" />
      <span>Attendance</span>
      <Separator orientation="vertical" />
      <span>Grades</span>
    </div>
  )
}
