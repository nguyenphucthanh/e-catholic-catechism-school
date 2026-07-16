import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Pencil,
  SignalHigh,
  SignalLow,
  SignalMedium,
  Trash2,
} from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import moment from 'moment'
import { momentLocalizer } from 'react-big-calendar'
import { api } from '../../../../convex/_generated/api'
import type { View } from 'react-big-calendar'
import type { Id } from '../../../../convex/_generated/dataModel'
import type { FunctionReturnType } from 'convex/server'
import type { LiturgicalDayMap } from '~/lib/romcal'
import { useAuth } from '~/lib/auth'
import { translateConvexError } from '~/lib/convex-errors'
import { useSelectedAcademicYear } from '~/lib/academic-year'
import { formatDate } from '~/lib/locale'
import { cn } from '~/lib/utils'
import { PageHeader } from '~/components/page-header'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Calendar } from '~/components/ui/calendar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog'
import { CalendarEventDialog } from '~/components/forms/calendar-event-dialog'
import { getLiturgicalDateLabel, getLiturgicalDayMap } from '~/lib/romcal'
import ShadcnBigCalendar from '~/components/shadcn-big-calendar/shadcn-big-calendar'

export const Route = createFileRoute('/_authenticated/_catechist/calendar')({
  component: ManageCalendarPage,
  staticData: {
    crumbs: [
      {
        label: 'nav.calendarEvents',
        path: '/calendar-events',
      },
      { label: 'calendarEvents.manage.title', path: '/calendar' },
    ],
  },
})

type CalendarEventScope = 'board' | 'branch' | 'class'
type CalendarEventRow = FunctionReturnType<
  typeof api.calendarEvents.list
>[number]
type CalendarTab = 'agenda' | 'month' | 'week' | 'day'

const rbcLocalizer = momentLocalizer(moment)

const LITURGICAL_COLOR_DOT: Record<string, string> = {
  green: 'bg-green-600 dark:bg-green-500',
  red: 'bg-red-600 dark:bg-red-500',
  purple: 'bg-purple-600 dark:bg-purple-500',
  white: 'bg-neutral-100 border border-neutral-300 dark:bg-neutral-200',
  rose: 'bg-rose-400 dark:bg-rose-400',
  gold: 'bg-amber-500 dark:bg-amber-400',
  black: 'bg-neutral-900 dark:bg-neutral-700',
}

function toISODate(date: Date): string {
  return date.toLocaleDateString('sv-SE')
}

function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function monthRange(month: Date): { from: string; to: string } {
  const from = new Date(month.getFullYear(), month.getMonth(), 1)
  const to = new Date(month.getFullYear(), month.getMonth() + 1, 0)
  return { from: toISODate(from), to: toISODate(to) }
}

function getSundaysOfMonth(year: number, monthIndex: number): Array<Date> {
  const sundays: Array<Date> = []
  const date = new Date(year, monthIndex, 1)
  while (date.getDay() !== 0) {
    date.setDate(date.getDate() + 1)
  }
  while (date.getMonth() === monthIndex) {
    sundays.push(new Date(date))
    date.setDate(date.getDate() + 7)
  }
  return sundays
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

function LiturgicalDot({ colorName }: { colorName: string | null }) {
  if (!colorName) return null
  return (
    <span
      className={cn(
        'inline-block size-2 shrink-0 rounded-full',
        LITURGICAL_COLOR_DOT[colorName] ?? 'bg-muted-foreground',
      )}
    />
  )
}

function SeverityBadge({ severity }: { severity: 'high' | 'medium' | 'low' }) {
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

function LiturgicalLabel({
  info,
}: {
  info: { name: string; colorName: string | null } | undefined
}) {
  if (!info) return null
  return (
    <div
      className="max-w-full overflow-hidden whitespace-pre-wrap"
      title={info.name}
    >
      <LiturgicalDot colorName={info.colorName} />{' '}
      <span className="text-[0.625rem] text-muted-foreground">{info.name}</span>
    </div>
  )
}

function MonthDateHeader({
  date,
  label,
  isOffRange,
  onDrillDown,
  liturgicalMap,
}: {
  date: Date
  label: string
  isOffRange: boolean
  onDrillDown: () => void
  liturgicalMap: LiturgicalDayMap
}) {
  return (
    <div className="flex flex-col gap-0.5 px-1 pt-1">
      <button
        type="button"
        onClick={onDrillDown}
        className={cn(
          'self-end text-xs font-medium',
          isOffRange && 'text-muted-foreground/50',
        )}
      >
        {label}
      </button>
      <LiturgicalLabel info={liturgicalMap[toISODate(date)]} />
    </div>
  )
}

function ColumnHeader({
  date,
  liturgicalMap,
  view,
}: {
  date: Date
  liturgicalMap: LiturgicalDayMap
  view: View
}) {
  return (
    <div
      data-column-header
      className="flex flex-col items-center gap-0.5 py-1 max-w-full min-w-0"
    >
      <span className="text-sm font-medium">
        {formatDate(date, { weekday: 'short' })}
      </span>
      {view !== 'month' && (
        <LiturgicalLabel info={liturgicalMap[toISODate(date)]} />
      )}
    </div>
  )
}

function ManageCalendarPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { selectedYearId } = useSelectedAcademicYear()
  const requesterId = user?.userDocId as Id<'catechists'> | undefined

  const [activeTab, setActiveTab] = React.useState<CalendarTab>('agenda')
  const [month, setMonth] = React.useState(() => new Date())
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(
    () => new Date(),
  )
  const [scopeFilter, setScopeFilter] = React.useState<'' | CalendarEventScope>(
    '',
  )
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingEvent, setEditingEvent] = React.useState<
    CalendarEventRow | undefined
  >(undefined)
  const [deletingEvent, setDeletingEvent] = React.useState<
    CalendarEventRow | undefined
  >(undefined)

  const removeMutation = useMutation(api.calendarEvents.remove)

  const appConfig = useQuery(api.appConfig.get)
  const romcalOptions = React.useMemo(
    () => ({
      epiphanyOnSunday: appConfig?.epiphanyOnSunday ?? true,
      corpusChristiOnSunday: appConfig?.corpusChristiOnSunday ?? true,
      ascensionOnSunday: appConfig?.ascensionOnSunday ?? true,
    }),
    [appConfig],
  )

  const [sundaysList, setSundaysList] = React.useState<
    Array<{ date: Date; label: string | null }>
  >([])

  React.useEffect(() => {
    const year = month.getFullYear()
    const m = month.getMonth()
    const sundays = getSundaysOfMonth(year, m)

    let active = true
    const fetchLabels = async () => {
      const results = await Promise.all(
        sundays.map(async (d) => {
          const iso = toISODate(d)
          const label = await getLiturgicalDateLabel(iso, romcalOptions)
          return { date: d, label }
        }),
      )
      if (active) {
        setSundaysList(results)
      }
    }
    fetchLabels()
    return () => {
      active = false
    }
  }, [month, romcalOptions])

  const [liturgicalMap, setLiturgicalMap] = React.useState<LiturgicalDayMap>({})

  React.useEffect(() => {
    let active = true
    getLiturgicalDayMap(month.getFullYear(), romcalOptions).then((map) => {
      if (active) {
        setLiturgicalMap(map)
      }
    })
    return () => {
      active = false
    }
  }, [month, romcalOptions])

  const { from, to } = React.useMemo(() => monthRange(month), [month])

  const events = useQuery(
    api.calendarEvents.list,
    requesterId && selectedYearId
      ? {
          requesterId,
          academicYearId: selectedYearId,
          dateFrom: from,
          dateTo: to,
        }
      : 'skip',
  )

  const scopedEvents = React.useMemo(() => {
    if (!events) return []
    if (!scopeFilter) return events
    return events.filter((e) => e.scope === scopeFilter)
  }, [events, scopeFilter])

  const countsByDate = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const e of scopedEvents) {
      map.set(e.date, (map.get(e.date) ?? 0) + 1)
    }
    return map
  }, [scopedEvents])

  const selectedIso = selectedDate ? toISODate(selectedDate) : undefined

  const eventsByDate = React.useMemo(() => {
    const map = new Map<string, Array<CalendarEventRow>>()
    for (const e of scopedEvents) {
      const arr = map.get(e.date) ?? []
      arr.push(e)
      map.set(e.date, arr)
    }
    return [...map.entries()].sort(([a], [b]) => (a < b ? -1 : 1))
  }, [scopedEvents])

  const rbcEvents = React.useMemo(
    () =>
      scopedEvents.map((e) => {
        const allDay = !e.startTime
        const endDate = e.endDate ?? e.date
        const start = e.startTime
          ? new Date(`${e.date}T${e.startTime}`)
          : fromISODate(e.date)
        const end = e.endTime
          ? new Date(`${endDate}T${e.endTime}`)
          : allDay && endDate !== e.date
            ? new Date(fromISODate(endDate).getTime() + 86400000)
            : fromISODate(endDate)
        return {
          title: extractPlainText(e.description) || t('calendarEvents.title'),
          start,
          end,
          allDay,
          resource: e,
        }
      }),
    [scopedEvents, t],
  )

  const openEditDialog = React.useCallback((event: CalendarEventRow) => {
    setEditingEvent(event)
    setDialogOpen(true)
  }, [])

  if (!requesterId || !selectedYearId) return null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={CalendarPlus}
        title={t('calendarEvents.manage.title')}
        actions={
          <Button
            onClick={() => {
              setEditingEvent(undefined)
              setDialogOpen(true)
            }}
          >
            <CalendarPlus className="size-4" />
            {t('calendarEvents.manage.addEvent')}
          </Button>
        }
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as CalendarTab)}
        >
          <TabsList>
            <TabsTrigger value="agenda">
              {t('calendarEvents.view.agenda')}
            </TabsTrigger>
            <TabsTrigger value="month">
              {t('calendarEvents.view.month')}
            </TabsTrigger>
            <TabsTrigger value="week">
              {t('calendarEvents.view.week')}
            </TabsTrigger>
            <TabsTrigger value="day">
              {t('calendarEvents.view.day')}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Select
          value={scopeFilter}
          onValueChange={(val: any) => setScopeFilter(val)}
          items={[
            { value: '', label: t('calendarEvents.filter.scope.all') },
            { value: 'board', label: t('calendarEvents.scope.board') },
            { value: 'branch', label: t('calendarEvents.scope.branch') },
            { value: 'class', label: t('calendarEvents.scope.class') },
          ]}
        >
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder={t('calendarEvents.filter.scope.all')} />
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
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as CalendarTab)}
      >
        <TabsContent value="agenda" className="mt-6">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-card border rounded-xl p-4 flex flex-col gap-4 min-w-0">
              <Calendar
                mode="single"
                className="w-full"
                selected={selectedDate}
                onSelect={setSelectedDate}
                month={month}
                onMonthChange={setMonth}
                components={{
                  DayButton: ({ children, day, modifiers, ...props }) => {
                    const iso = toISODate(day.date)
                    const count = countsByDate.get(iso) ?? 0
                    return (
                      <button
                        type="button"
                        data-day={iso}
                        {...props}
                        className="relative isolate z-10 flex aspect-square size-auto w-full min-w-(--cell-size) flex-col items-center justify-center gap-0.5 rounded-(--cell-radius) border-0 text-sm leading-none font-normal hover:bg-muted data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground"
                        data-selected={modifiers.selected}
                      >
                        <span>{children}</span>
                        {count > 0 && (
                          <span className="size-1.5 rounded-full bg-primary group-data-[selected=true]/day:bg-primary-foreground" />
                        )}
                      </button>
                    )
                  },
                }}
              />

              <div className="border-t pt-4 mt-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  {t('calendarEvents.manage.sundays')}
                </h4>
                <ul className="flex flex-col gap-2">
                  {sundaysList.map(({ date, label }, idx) => (
                    <li
                      key={idx}
                      className="text-xs text-foreground/80 pl-4 relative min-w-0 w-full"
                    >
                      <span className="block w-1.5 h-1.5 rounded-full bg-primary absolute left-0 mt-1.5" />
                      <div className="text-wrap wrap-break-word">
                        <span className="font-semibold text-foreground">
                          {formatDate(date)}
                        </span>
                        {' - '}
                        <span className="text-muted-foreground">
                          {label || t('calendarEvents.manage.sunday')}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="md:col-span-2 bg-card border rounded-xl p-4 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium capitalize">
                  {formatDate(month, { month: 'long', year: 'numeric' })}
                </h3>
                {scopedEvents.length > 0 && (
                  <Badge variant="secondary">{scopedEvents.length}</Badge>
                )}
              </div>

              {eventsByDate.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  {t('calendarEvents.manage.monthEmpty')}
                </p>
              ) : (
                <div className="relative flex flex-col gap-6">
                  <div className="absolute left-5.5 top-3 bottom-3 w-px bg-border" />
                  {eventsByDate.map(([iso, dayEvents]) => {
                    const date = fromISODate(iso)
                    const isSelected = iso === selectedIso
                    return (
                      <div key={iso} className="relative flex gap-4">
                        <button
                          type="button"
                          onClick={() => setSelectedDate(date)}
                          className={`z-10 flex size-11 shrink-0 flex-col items-center justify-center rounded-full border bg-background transition-colors ${
                            isSelected
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'hover:bg-muted'
                          }`}
                        >
                          <span className="text-base font-semibold leading-none">
                            {date.getDate()}
                          </span>
                          <span className="text-[0.625rem] uppercase leading-none opacity-70">
                            {formatDate(date, { weekday: 'short' })}
                          </span>
                        </button>

                        <div className="flex flex-1 flex-col gap-2 pb-1">
                          {dayEvents.map((e) => (
                            <div
                              key={e._id}
                              className="border rounded-lg p-3 flex items-start justify-between gap-3"
                            >
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <SeverityBadge severity={e.severity} />
                                  <Badge
                                    variant={
                                      e.scope === 'board'
                                        ? 'default'
                                        : e.scope === 'branch'
                                          ? 'secondary'
                                          : 'outline'
                                    }
                                  >
                                    {t(`calendarEvents.scope.${e.scope}`)}
                                  </Badge>
                                  {e.liturgicalDate && (
                                    <span className="text-sm font-medium text-muted-foreground">
                                      {e.liturgicalDate}
                                    </span>
                                  )}
                                </div>
                                <span className="text-sm text-foreground">
                                  {extractPlainText(e.description)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  aria-label={t('common.edit')}
                                  onClick={() => openEditDialog(e)}
                                >
                                  <Pencil className="size-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  className="text-destructive hover:bg-destructive/10"
                                  aria-label={t('common.delete')}
                                  onClick={() => setDeletingEvent(e)}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {(['month', 'week', 'day'] as const).map((view) => (
          <TabsContent key={view} value={view} className="mt-6">
            <div className="bg-card border rounded-xl p-4 min-h-[700px] h-[70vh]">
              <ShadcnBigCalendar
                className="bg-card!"
                style={{ height: '100%' }}
                localizer={rbcLocalizer}
                events={rbcEvents}
                date={month}
                view={view as View}
                onNavigate={setMonth}
                toolbar
                components={{
                  toolbar: (toolbarProps) => (
                    <div className="flex items-center justify-between gap-2 pb-2">
                      <h3 className="text-sm font-medium capitalize">
                        {toolbarProps.label}
                      </h3>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toolbarProps.onNavigate('TODAY')}
                        >
                          {t('calendarEvents.view.today')}
                        </Button>
                        <Button
                          variant="outline"
                          size="icon-sm"
                          onClick={() => toolbarProps.onNavigate('PREV')}
                          data-test-id="calendar-previous"
                        >
                          <ChevronLeft className="size-4" />
                          <span className="sr-only">{'<'}</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="icon-sm"
                          onClick={() => toolbarProps.onNavigate('NEXT')}
                          data-test-id="calendar-next"
                        >
                          <ChevronRight className="size-4" />
                          <span className="sr-only">{'>'}</span>
                        </Button>
                      </div>
                    </div>
                  ),
                  month: {
                    dateHeader: (headerProps) => (
                      <MonthDateHeader
                        {...headerProps}
                        liturgicalMap={liturgicalMap}
                      />
                    ),
                  },
                  header: ({ date }) => (
                    <ColumnHeader
                      view={view}
                      date={date}
                      liturgicalMap={liturgicalMap}
                    />
                  ),
                }}
                selectable
                onSelectSlot={(slotInfo) => setSelectedDate(slotInfo.start)}
                onDrillDown={(date) => setSelectedDate(date)}
                onSelectEvent={(event) => openEditDialog(event.resource)}
                popup
              />
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <CalendarEventDialog
        isOpen={dialogOpen}
        onOpenChange={setDialogOpen}
        requesterId={requesterId}
        academicYearId={selectedYearId}
        event={editingEvent}
        defaultDate={selectedIso}
      />

      <AlertDialog
        open={!!deletingEvent}
        onOpenChange={(open) => !open && setDeletingEvent(undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('calendarEvents.manage.deleteTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('calendarEvents.manage.deleteConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deletingEvent) return
                try {
                  await removeMutation({
                    requesterId,
                    id: deletingEvent._id,
                  })
                  toast.success(t('calendarEvents.manage.deleteSuccess'))
                } catch (error) {
                  toast.error(translateConvexError(error, t))
                } finally {
                  setDeletingEvent(undefined)
                }
              }}
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
