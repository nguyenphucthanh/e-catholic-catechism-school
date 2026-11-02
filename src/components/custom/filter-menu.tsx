import { Filter, ListFilter, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'

export interface FilterMenuOption {
  value: string
  label: string
}

export interface FilterMenuFilter {
  key: string
  label: string
  options: Array<FilterMenuOption>
  value: string
  onChange: (value: string) => void
  /** Value meaning "no filter". Selecting it removes the badge. */
  defaultValue?: string
  disabled?: boolean
}

interface FilterMenuProps {
  filters: Array<FilterMenuFilter>
}

/**
 * Controlled "Filter" dropdown: one submenu per filter, with a removable badge
 * for every filter that differs from its default value.
 */
export function FilterMenu({ filters }: FilterMenuProps) {
  const { t } = useTranslation()

  const active = filters.filter((f) => f.value !== (f.defaultValue ?? ''))

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant={active.length > 0 ? 'default' : 'outline'}>
              {active.length > 0 ? (
                <ListFilter className="size-4" />
              ) : (
                <Filter className="size-4" />
              )}
              {t('common.filter')}
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="min-w-44">
          {filters.map((f) => (
            <DropdownMenuSub key={f.key}>
              <DropdownMenuSubTrigger disabled={f.disabled}>
                {f.label}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup
                  value={f.value}
                  onValueChange={(v) => f.onChange(v as string)}
                >
                  {f.options.map((o) => (
                    <DropdownMenuRadioItem key={o.value} value={o.value}>
                      {o.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {active.map((f) => {
        const label = f.options.find((o) => o.value === f.value)?.label
        return (
          <Badge key={f.key} variant="secondary" className="h-7 gap-1 pl-2.5">
            <span className="text-muted-foreground">{f.label}:</span>
            {label}
            <button
              type="button"
              className="rounded-full p-0.5 hover:bg-foreground/10"
              aria-label={t('common.removeFilter', { name: f.label })}
              onClick={() => f.onChange(f.defaultValue ?? '')}
            >
              <X className="size-3" />
            </button>
          </Badge>
        )
      })}
    </div>
  )
}
