import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from '~/components/ui/drawer'
import { Button } from '~/components/ui/button'

export function Default() {
  return (
    <Drawer defaultOpen modal={false} swipeDirection="down">
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Mark attendance</DrawerTitle>
          <DrawerDescription>
            Confirm attendance for Nguyễn Văn An — Lớp Thêm Sức.
          </DrawerDescription>
        </DrawerHeader>
        <DrawerFooter>
          <Button variant="outline">Absent</Button>
          <Button>Present</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
