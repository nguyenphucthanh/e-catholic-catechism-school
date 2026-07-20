import { Badge } from '~/components/ui/badge'

export function Variants() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Badge variant="default">Enrolled</Badge>
      <Badge variant="secondary">Pending</Badge>
      <Badge variant="destructive">Withdrawn</Badge>
      <Badge variant="outline">Alumnus</Badge>
      <Badge variant="ghost">Draft</Badge>
    </div>
  )
}

export function AsLink() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Badge variant="default" render={<a href="#" />}>
        Sơ Cấp 1
      </Badge>
      <Badge variant="outline" render={<a href="#" />}>
        Chuyên Cần 2
      </Badge>
    </div>
  )
}
