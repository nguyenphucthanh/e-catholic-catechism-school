import { useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { useAuth } from '~/lib/auth'
import { useSelectedAcademicYear } from '~/lib/academic-year'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Skeleton } from '~/components/ui/skeleton'

export function YearSwitcher() {
  const { t } = useTranslation()
  const { selectedYearId, setSelectedYearId } = useSelectedAcademicYear()
  const { user } = useAuth()
  const requesterId = user?.userDocId as Id<'catechists'> | undefined
  const recentYears = useQuery(
    api.academicYears.listRecent,
    requesterId ? { requesterId, limit: 5 } : 'skip',
  )

  if (recentYears === undefined) {
    return <Skeleton className="h-8 w-full rounded-md" />
  }

  return (
    <Select
      value={selectedYearId ?? ''}
      onValueChange={(val) => {
        if (val) setSelectedYearId(val as Id<'academicYears'>)
      }}
      items={recentYears.map((year) => ({
        label: year.name,
        value: year._id,
      }))}
    >
      <SelectTrigger className="w-full text-xs font-normal py-1 pr-2 h-8">
        <SelectValue
          placeholder={t('academicYears.select_year', 'Select Year...')}
        />
      </SelectTrigger>
      <SelectContent>
        {recentYears.map((year) => (
          <SelectItem key={year._id} value={year._id}>
            <span className="truncate text-xs">
              {year.name}
              {year.isActive && (
                <span className="ml-1 text-muted-foreground text-[10px]">
                  ({t('common.active', 'active')})
                </span>
              )}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
