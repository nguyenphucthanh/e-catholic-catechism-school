import * as React from 'react'
import { CalendarIcon } from 'lucide-react'
import { Calendar } from '~/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover'
import { Button } from '~/components/ui/button'
import { cn } from '~/lib/utils'

export interface DateInputProps extends Omit<
  React.ComponentProps<typeof Calendar>,
  'mode' | 'selected' | 'onSelect'
> {
  value?: Date
  onChange?: (date: Date | undefined) => void
  placeholder?: string
  buttonClassName?: string
  disabled?: boolean
}

export function DateInput({
  value,
  onChange,
  placeholder = 'Select date...',
  buttonClassName,
  disabled,
  className,
  ...calendarProps
}: DateInputProps) {
  const [open, setOpen] = React.useState(false)

  const handleSelect = (date: Date | undefined) => {
    onChange?.(date)
    setOpen(false)
  }

  // Format the date using standard browser locale
  const formattedDate = React.useMemo(() => {
    if (!value) return null
    try {
      return value.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    } catch {
      return null
    }
  }, [value])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            disabled={disabled}
            className={cn(
              'w-full justify-start text-left font-normal h-9 px-3',
              !value && 'text-muted-foreground',
              buttonClassName,
            )}
          >
            <CalendarIcon className="mr-2 size-4 shrink-0" />
            {formattedDate || placeholder}
          </Button>
        }
      />
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={handleSelect}
          className={cn('p-3', className)}
          {...calendarProps}
        />
      </PopoverContent>
    </Popover>
  )
}
