import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '~/components/ui/dialog'
import { Button } from '~/components/ui/button'

export function Default() {
  return (
    <Dialog defaultOpen modal={false}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enroll student</DialogTitle>
          <DialogDescription>
            Confirm enrollment for this student in the selected class.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
