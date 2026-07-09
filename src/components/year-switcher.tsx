import React from 'react'
import { useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { useAuth } from '~/lib/auth'
import { useSelectedAcademicYear } from '~/lib/academic-year'
import { Button } from '~/components/ui/button'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from '~/components/ui/combobox'
import { Skeleton } from '~/components/ui/skeleton'

export function YearSwitcher() {
  const { t } = useTranslation()
  const { selectedYearId, setSelectedYearId } = useSelectedAcademicYear()
  const { user } = useAuth()
  const [searchQuery, setSearchQuery] = React.useState('')
  const requesterId =
    user?.accountType === 'catechist'
      ? (user.userDocId as Id<'catechists'>)
      : undefined
  const recentYears = useQuery(
    api.academicYears.listRecent,
    requesterId ? { requesterId, limit: 5 } : 'skip',
  )

  if (recentYears === undefined) {
    return <Skeleton className="h-8 w-full rounded-md" />
  }

  const items = recentYears.map((year) => ({
    label: year.name,
    value: year._id,
    isActive: year.isActive,
  }))

  return (
    <Combobox
      value={selectedYearId ?? ''}
      onValueChange={(val) => {
        if (val) setSelectedYearId(val as Id<'academicYears'>)
      }}
      inputValue={searchQuery}
      onInputValueChange={setSearchQuery}
      items={items}
    >
      <ComboboxTrigger
        render={
          <Button
            variant="outline"
            className="w-full justify-between text-xs font-normal py-1 pr-2 h-8"
          >
            <ComboboxValue
              placeholder={t('academicYears.select_year', 'Select Year...')}
            />
            <ChevronDown />
          </Button>
        }
      />
      <ComboboxContent>
        <ComboboxInput
          showTrigger={false}
          placeholder={t('common.search', 'Search...')}
        />
        <ComboboxEmpty>
          {t('common.noResultsFound', 'No items found.')}
        </ComboboxEmpty>
        <ComboboxList>
          {(item) => (
            <ComboboxItem key={item.value} value={item.value}>
              <span className="truncate text-xs">
                {item.label}
                {item.isActive && (
                  <span className="ml-1 text-muted-foreground text-[10px]">
                    ({t('common.active', 'active')})
                  </span>
                )}
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
