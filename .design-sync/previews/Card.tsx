import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
} from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'

export function Default() {
  return (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Nguyễn Văn An</CardTitle>
        <CardDescription>Sơ Cấp 1 &middot; Enrolled</CardDescription>
        <CardAction>
          <Badge>92% attendance</Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Parent: Nguyễn Văn Bảo &middot; 0912 345 678
        </p>
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button variant="outline" size="sm">
          View profile
        </Button>
        <Button size="sm">Mark attendance</Button>
      </CardFooter>
    </Card>
  )
}
