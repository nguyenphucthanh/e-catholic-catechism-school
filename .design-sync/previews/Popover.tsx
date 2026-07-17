import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
} from '~/components/ui/popover'
import { Button } from '~/components/ui/button'

export function Default() {
  return (
    <Popover defaultOpen modal={false}>
      <PopoverTrigger render={<Button variant="outline">Contact</Button>} />
      <PopoverContent>
        <PopoverHeader>
          <PopoverTitle>Catechist contact</PopoverTitle>
          <PopoverDescription>
            Sr. Maria Nguyễn — +84 90 123 4567
          </PopoverDescription>
        </PopoverHeader>
        <Button size="sm">Call now</Button>
      </PopoverContent>
    </Popover>
  )
}
