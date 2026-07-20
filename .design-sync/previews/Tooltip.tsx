import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '~/components/ui/tooltip'
import { Button } from '~/components/ui/button'

export function Default() {
  return (
    <TooltipProvider>
      <Tooltip open modal={false}>
        <TooltipTrigger
          render={<Button variant="outline">Attendance</Button>}
        />
        <TooltipContent>View attendance history</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
