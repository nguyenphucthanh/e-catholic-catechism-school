import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '~/components/ui/sheet'
import { Button } from '~/components/ui/button'

export function Default() {
  return (
    <Sheet defaultOpen modal={false}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Class details</SheetTitle>
          <SheetDescription>
            Giáo lý Vào Đời — Lớp 9A, Thứ Bảy 14:00
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-3 px-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Catechist</span>
            <span>Sr. Maria Nguyễn</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Students</span>
            <span>24</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Room</span>
            <span>Phòng 2B</span>
          </div>
        </div>
        <SheetFooter>
          <Button variant="outline">Close</Button>
          <Button>Save changes</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
