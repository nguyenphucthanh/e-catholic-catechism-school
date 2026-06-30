import * as React from 'react'
import { CalendarIcon } from 'lucide-react'
import { format, isValid, parse } from 'date-fns'
import { Calendar } from '~/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
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

const SUPPORTED_FORMATS = [
  'dd/MM/yyyy',
  'd/M/yyyy',
  'dd-MM-yyyy',
  'd-M-yyyy',
  'MM/dd/yyyy',
  'M/d/yyyy',
  'yyyy-MM-dd',
  'yyyy/MM/dd',
]

export function DateInput({
  value,
  onChange,
  placeholder = 'dd/MM/yyyy',
  buttonClassName,
  disabled,
  className,
  ...calendarProps
}: DateInputProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState('')

  // Sync input value when external value changes
  React.useEffect(() => {
    if (value && isValid(value)) {
      setInputValue(format(value, 'dd/MM/yyyy'))
    } else {
      setInputValue('')
    }
  }, [value])

  const handleSelect = (date: Date | undefined) => {
    onChange?.(date)
    setOpen(false)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
  }

  const parseAndValidate = () => {
    if (!inputValue.trim()) {
      onChange?.(undefined)
      return
    }

    let parsedDate: Date | null = null
    const referenceDate = new Date()

    for (const fmt of SUPPORTED_FORMATS) {
      const parsed = parse(inputValue, fmt, referenceDate)
      if (isValid(parsed)) {
        // Basic sanity check for year to avoid weird dates
        if (parsed.getFullYear() > 1900 && parsed.getFullYear() < 2100) {
          parsedDate = parsed
          break
        }
      }
    }

    if (parsedDate) {
      onChange?.(parsedDate)
      setInputValue(format(parsedDate, 'dd/MM/yyyy'))
    } else {
      // Clear input on invalid as requested
      setInputValue('')
      onChange?.(undefined)
    }
  }

  const handleBlur = () => {
    parseAndValidate()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      parseAndValidate()
    }
  }

  return (
    <div className={cn('relative flex items-center w-full', className)}>
      <Input
        type="text"
        placeholder={placeholder}
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className="pr-10 h-9"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled}
              aria-label="Open calendar"
              className={cn(
                'absolute right-0 h-9 w-9 text-muted-foreground hover:bg-transparent',
                buttonClassName,
              )}
            >
              <CalendarIcon className="size-4" />
            </Button>
          }
        />
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={value}
            onSelect={handleSelect}
            className="p-3"
            {...calendarProps}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
