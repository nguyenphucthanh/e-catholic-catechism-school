import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import {
  CalendarPlus,
  Pencil,
  SignalHigh,
  SignalLow,
  SignalMedium,
  Trash2,
} from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import type { FunctionReturnType } from 'convex/server'
import { useAuth } from '~/lib/auth'
import { useSelectedAcademicYear } from '~/lib/academic-year'
import { formatDate } from '~/lib/locale'
import { PageHeader } from '~/components/page-header'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Calendar } from '~/components/ui/calendar'
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

function ManageCalendarPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { selectedYearId } = useSelectedAcademicYear()
  const requesterId = user?.userDocId as Id<'catechists'> | undefined

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

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="bg-card border rounded-xl p-4 flex flex-col gap-4 w-fit">
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
            <SelectTrigger className="w-full">
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

          <Calendar
            mode="single"
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
        </div>

        <div className="bg-card border rounded-xl p-4 flex-1 flex flex-col gap-4">
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
                              <Badge variant="outline">
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
                              onClick={() => {
                                setEditingEvent(e)
                                setDialogOpen(true)
                              }}
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
                  const message =
                    error instanceof Error ? error.message : 'Unknown error'
                  toast.error(message)
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
