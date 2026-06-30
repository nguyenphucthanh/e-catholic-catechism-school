import React from 'react'
import PhoneInput2 from 'react-phone-input-2'
import type { PhoneInputProps } from 'react-phone-input-2'
import 'react-phone-input-2/lib/style.css'
import { cn } from '~/lib/utils'

export interface PhoneInputCustomProps extends PhoneInputProps {
  className?: string
}

let PhoneInputComponent: any = PhoneInput2
while (
  PhoneInputComponent &&
  typeof PhoneInputComponent !== 'function' &&
  PhoneInputComponent.default
) {
  PhoneInputComponent = PhoneInputComponent.default
}

export const PhoneInput = React.forwardRef<any, PhoneInputCustomProps>(
  (
    {
      className,
      containerClass,
      inputClass,
      buttonClass,
      dropdownClass,
      inputProps,
      ...props
    },
    ref,
  ) => {
    return (
      <PhoneInputComponent
        containerClass={cn('w-full relative', containerClass)}
        inputClass={cn(
          'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent pl-12 pr-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40',
          inputClass,
          className,
        )}
        buttonClass={cn(
          'bg-transparent border-0 hover:bg-accent/50 rounded-l-lg',
          buttonClass,
        )}
        dropdownClass={cn(
          'bg-background text-foreground border border-input rounded-md shadow-md',
          dropdownClass,
        )}
        inputProps={{
          ...(ref ? { ref } : {}),
          ...inputProps,
        }}
        {...props}
      />
    )
  },
)

PhoneInput.displayName = 'PhoneInput'
