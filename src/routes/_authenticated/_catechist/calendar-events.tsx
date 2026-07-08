import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { CalendarDays, SignalHigh, SignalLow, SignalMedium } from 'lucide-react'
import * as React from 'react'
import { api } from '../../../../convex/_generated/api'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import type { Id } from '../../../../convex/_generated/dataModel'
import type { FunctionReturnType } from 'convex/server'
import type { DateRange } from 'react-day-picker'
import { useAuth } from '~/lib/auth'
import { useSelectedAcademicYear } from '~/lib/academic-year'
import { formatDate } from '~/lib/locale'
import { PageHeader } from '~/components/page-header'
import { DataTable } from '~/components/custom/data-table'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Calendar } from '~/components/ui/calendar'
import { Skeleton } from '~/components/ui/skeleton'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'

export const Route = createFileRoute(
  '/_authenticated/_catechist/calendar-events',
)({
  component: CalendarEventsPage,
  staticData: { crumb: 'calendarEvents.title' },
})

type CalendarEventScope = 'board' | 'branch' | 'class'
type CalendarEventSeverity = 'high' | 'medium' | 'low'

type CalendarEventRow = FunctionReturnType<
  typeof api.calendarEvents.list
>[number]

function SeverityBadge({ severity }: { severity: CalendarEventSeverity }) {
  const { t } = useTranslation()
  switch (severity) {
    case 'high':
      return (
        <span
          className="text-destructive inline-flex"
          title={t('calendarEvents.severity.high')}
        >
          <SignalHigh className="size-5" />
          <span className="sr-only">{t('calendarEvents.severity.high')}</span>
        </span>
      )
    case 'medium':
      return (
        <span
          className="text-yellow-600 dark:text-yellow-400 inline-flex"
          title={t('calendarEvents.severity.medium')}
        >
          <SignalMedium className="size-5" />
          <span className="sr-only">{t('calendarEvents.severity.medium')}</span>
        </span>
      )
    case 'low':
    default:
      return (
        <span
          className="text-muted-foreground inline-flex"
          title={t('calendarEvents.severity.low')}
        >
          <SignalLow className="size-5" />
          <span className="sr-only">{t('calendarEvents.severity.low')}</span>
        </span>
      )
  }
}

function extractPlainText(serialized: string): string {
  try {
    const doc = JSON.parse(serialized)
    const parts: Array<string> = []
    const walk = (node: unknown) => {
      if (!node || typeof node !== 'object') return
      const { text, content } = node as { text?: unknown; content?: unknown }
      if (typeof text === 'string') parts.push(text)
      if (Array.isArray(content)) content.forEach(walk)
    }
    walk(doc)
    return parts.join(' ').trim()
  } catch {
    return serialized
  }
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function CalendarEventsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { selectedYearId } = useSelectedAcademicYear()
  const requesterId = user?.userDocId as Id<'catechists'> | undefined

  const [scopeFilter, setScopeFilter] = React.useState<'' | CalendarEventScope>(
    '',
  )
  const [sorting, setSorting] = React.useState<SortingState>([])

  const today = React.useMemo(() => new Date(), [])
  const defaultRange = React.useMemo<DateRange>(() => {
    const from = new Date(today)
    from.setDate(from.getDate() - 30)
    const to = new Date(today)
    to.setDate(to.getDate() + 90)
    return { from, to }
  }, [today])
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(
    defaultRange,
  )

  const events = useQuery(
    api.calendarEvents.list,
    requesterId && selectedYearId && dateRange?.from && dateRange.to
      ? {
          requesterId,
          academicYearId: selectedYearId,
          dateFrom: toISODate(dateRange.from),
          dateTo: toISODate(dateRange.to),
        }
      : 'skip',
  )

  const filteredEvents = React.useMemo(() => {
    if (!events) return []
    if (!scopeFilter) return events
    return events.filter((e) => e.scope === scopeFilter)
  }, [events, scopeFilter])

  const columns: Array<ColumnDef<CalendarEventRow>> = [
    {
      accessorKey: 'date',
      header: t('calendarEvents.col.date'),
      enableSorting: true,
      cell: ({ row }) => formatDate(row.original.date),
    },
    {
      id: 'event',
      header: t('calendarEvents.col.event'),
      enableSorting: false,
      cell: ({ row }) => {
        const e = row.original
        return (
          <div className="flex flex-col gap-1 max-w-md">
            <div className="flex items-center gap-2">
              <SeverityBadge severity={e.severity} />
              {e.liturgicalDate && (
                <span className="text-sm font-medium text-muted-foreground">
                  {e.liturgicalDate}
                </span>
              )}
            </div>
            <span className="text-sm text-foreground line-clamp-2">
              {extractPlainText(e.description)}
            </span>
          </div>
        )
      },
    },
    {
      id: 'scope',
      header: t('calendarEvents.col.scope'),
      enableSorting: false,
      cell: ({ row }) => {
        const e = row.original
        if (e.scope === 'board') {
          return (
            <Badge variant="outline">{t('calendarEvents.scope.board')}</Badge>
          )
        }
        if (e.scope === 'branch') {
          return (
            <div className="flex flex-col gap-1">
              <Badge variant="outline">
                {t('calendarEvents.scope.branch')}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {e.branchName ?? '—'}
              </span>
            </div>
          )
        }
        return (
          <div className="flex flex-col gap-1">
            <Badge variant="outline">{t('calendarEvents.scope.class')}</Badge>
            <span className="text-sm text-muted-foreground">
              {e.className ?? '—'}
            </span>
          </div>
        )
      },
    },
    {
      id: 'createdBy',
      header: t('calendarEvents.col.createdBy'),
      enableSorting: false,
      cell: ({ row }) => {
        const e = row.original
        return (
          <div className="flex flex-col gap-1">
            <span>{e.createdByName}</span>
            <span className="text-sm text-muted-foreground">
              {formatDate(new Date(e.createdAt))}
            </span>
          </div>
        )
      },
    },
    {
      id: 'updatedBy',
      header: t('calendarEvents.col.updatedBy'),
      enableSorting: false,
      cell: ({ row }) => {
        const e = row.original
        if (!e.updatedByName || !e.updatedAt) return '—'
        return (
          <div className="flex flex-col gap-1">
            <span>{e.updatedByName}</span>
            <span className="text-sm text-muted-foreground">
              {formatDate(new Date(e.updatedAt))}
            </span>
          </div>
        )
      },
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={CalendarDays}
        title={t('calendarEvents.title')}
        actions={
          <Button render={<Link to="/calendar" />}>
            {t('nav.manageCalendar')}
          </Button>
        }
      />
      <div className="bg-card border rounded-xl p-4 flex flex-col gap-4">
        <DataTable
          columns={columns}
          data={filteredEvents}
          disableSearch
          isLoading={events === undefined}
          sorting={sorting}
          onSortingChange={setSorting}
          getRowId={(row) => row._id}
          filterExtra={
            events === undefined ? (
              <>
                <Skeleton className="h-9 w-44" />
                <Skeleton className="h-9 w-64" />
              </>
            ) : (
              <>
                <Select
                  value={scopeFilter}
                  onValueChange={(val: any) => setScopeFilter(val)}
                  items={[
                    { value: '', label: t('calendarEvents.filter.scope.all') },
                    {
                      value: 'board',
                      label: t('calendarEvents.scope.board'),
                    },
                    {
                      value: 'branch',
                      label: t('calendarEvents.scope.branch'),
                    },
                    {
                      value: 'class',
                      label: t('calendarEvents.scope.class'),
                    },
                  ]}
                >
                  <SelectTrigger className="w-44">
                    <SelectValue
                      placeholder={t('calendarEvents.filter.scope.all')}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">
                      {t('calendarEvents.filter.scope.all')}
                    </SelectItem>
                    <SelectItem value="board">
                      {t('calendarEvents.scope.board')}
                    </SelectItem>
                    <SelectItem value="branch">
                      {t('calendarEvents.scope.branch')}
                    </SelectItem>
                    <SelectItem value="class">
                      {t('calendarEvents.scope.class')}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Popover>
                  <PopoverTrigger
                    render={
                      <Button variant="outline" className="w-64 justify-start">
                        <CalendarDays className="size-4" />
                        {dateRange?.from && dateRange.to
                          ? `${formatDate(dateRange.from)} - ${formatDate(dateRange.to)}`
                          : t('calendarEvents.filter.dateRange.placeholder')}
                      </Button>
                    }
                  />
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
              </>
            )
          }
        />
      </div>
    </div>
  )
}
