import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock,
  UserPlus,
  Users,
} from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { api } from '../../../../convex/_generated/api'
import type { LucideIcon } from 'lucide-react'
import type { FunctionReturnType } from 'convex/server'
import type { Id } from '../../../../convex/_generated/dataModel'
import type { TableColumnDef } from '~/components/custom/data-table'
import { useAuth } from '~/lib/auth'
import { useSelectedAcademicYear } from '~/lib/academic-year'
import { translateConvexError } from '~/lib/convex-errors'
import { formatPersonName } from '~/lib/name'
import { PageHeader } from '~/components/page-header'
import { DataTable } from '~/components/custom/data-table'
import { DateInput } from '~/components/custom/date-input'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '~/components/ui/combobox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Alert, AlertDescription } from '~/components/ui/alert'
import { Card, CardContent } from '~/components/ui/card'

export const Route = createFileRoute(
  '/_authenticated/_catechist/attendance_/catechists',
)({
  component: CatechistAttendancePage,
  staticData: {
    crumbs: [{ label: 'nav.catechistAttendance' }],
  },
})

type Roster = FunctionReturnType<
  typeof api.catechistAttendance.getSessionAttendanceRoster
>
type RosterRow = (Roster['roster'][number] | Roster['substitutes'][number]) & {
  displayName: string
}
type Status = NonNullable<RosterRow['status']>

// CLAUDE.md attendance palette + icons.
const STATUS_OPTIONS: Array<{
  status: Status
  icon: LucideIcon
  color: string
}> = [
  { status: 'present', icon: CheckCircle2, color: '#10B981' },
  { status: 'late', icon: Clock, color: '#F59E0B' },
  { status: 'excused_absence', icon: AlertCircle, color: '#8B5CF6' },
  { status: 'unexcused_absence', icon: AlertTriangle, color: '#EF4444' },
]
const UNSET_COLOR = '#9CA3AF'

function CatechistAttendancePage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { selectedYearId } = useSelectedAcademicYear()
  const requesterId =
    user?.accountType === 'catechist'
      ? (user.userDocId as Id<'catechists'>)
      : undefined

  const [date, setDate] = React.useState(() => new Date())
  const dateStr = format(date, 'yyyy-MM-dd')
  const [pickedSessionId, setPickedSessionId] =
    React.useState<Id<'classSessions'> | null>(null)
  const [substituteOpen, setSubstituteOpen] = React.useState(false)

  const yearContext = useQuery(
    api.academicYears.getActiveYearContext,
    requesterId ? { requesterId } : 'skip',
  )
  const year = yearContext?.recentYears.find((y) => y._id === selectedYearId)

  const sessions = useQuery(
    api.catechistAttendance.listRecordableSessions,
    requesterId && selectedYearId
      ? { requesterId, academicYearId: selectedYearId, date: dateStr }
      : 'skip',
  )
  // Fall back to the first session when none (or a stale one) is picked.
  const sessionId =
    sessions?.find((s) => s.sessionId === pickedSessionId)?.sessionId ??
    sessions?.[0]?.sessionId ??
    null

  const roster = useQuery(
    api.catechistAttendance.getSessionAttendanceRoster,
    requesterId && sessionId ? { requesterId, sessionId } : 'skip',
  )

  const recordAttendance = useMutation(api.catechistAttendance.recordAttendance)
  const deleteRecord = useMutation(
    api.catechistAttendance.deleteAttendanceRecord,
  )

  const readOnly = !year?.isActive

  const rows = React.useMemo<Array<RosterRow>>(
    () =>
      roster
        ? [...roster.roster, ...roster.substitutes].map((r) => ({
            ...r,
            displayName: formatPersonName(r.saintName, r.fullName ?? ''),
          }))
        : [],
    [roster],
  )

  const onToggle = async (row: RosterRow, status: Status) => {
    if (!requesterId || !sessionId) return
    try {
      if (row.status === status && row.recordId) {
        await deleteRecord({ requesterId, recordId: row.recordId })
        toast.success(t('catechistAttendance.cleared'))
      } else {
        await recordAttendance({
          requesterId,
          sessionId,
          catechistId: row.catechistId,
          status,
          checkInMethod: 'manual',
          // keep substitutes as substitutes; others get the derived role
          roleAtSession:
            row.roleAtSession === 'substitute' ? 'substitute' : undefined,
        })
      }
    } catch (err) {
      toast.error(translateConvexError(err, t))
    }
  }

  const columns: Array<TableColumnDef<RosterRow>> = [
    {
      accessorKey: 'displayName',
      header: t('catechistAttendance.col.catechist'),
    },
    {
      accessorKey: 'roleAtSession',
      header: t('catechistAttendance.col.role'),
      cell: ({ row }) =>
        row.original.roleAtSession ? (
          <Badge
            variant={
              row.original.roleAtSession === 'substitute'
                ? 'secondary'
                : 'outline'
            }
          >
            {t(`catechistAttendance.role.${row.original.roleAtSession}`)}
          </Badge>
        ) : null,
    },
    {
      accessorKey: 'status',
      header: t('catechistAttendance.col.status'),
      cell: ({ row }) => {
        const opt = STATUS_OPTIONS.find((o) => o.status === row.original.status)
        const Icon = opt?.icon ?? Circle
        return (
          <Badge
            variant="outline"
            style={{ color: opt?.color ?? UNSET_COLOR }}
            className="gap-1"
          >
            <Icon className="size-3" />
            {t(`attendance.status.${opt?.status ?? 'unset'}`)}
          </Badge>
        )
      },
    },
    {
      id: 'actions',
      header: t('catechistAttendance.col.attendance'),
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex gap-1">
          {STATUS_OPTIONS.map(({ status, icon: Icon, color }) => {
            const active = row.original.status === status
            return (
              <Button
                key={status}
                type="button"
                size="icon"
                variant="outline"
                className="size-8"
                disabled={readOnly}
                aria-pressed={active}
                title={t(`attendance.status.${status}`)}
                style={
                  active
                    ? { backgroundColor: color, borderColor: color }
                    : undefined
                }
                onClick={() => onToggle(row.original, status)}
              >
                <Icon
                  className="size-4"
                  style={{ color: active ? '#fff' : color }}
                />
                <span className="sr-only">
                  {t(`attendance.status.${status}`)}
                </span>
              </Button>
            )
          })}
        </div>
      ),
    },
  ]

  const summary = roster?.summary
  const counts: Record<Status, number> = summary
    ? {
        present: summary.present,
        late: summary.late,
        excused_absence: summary.excused,
        unexcused_absence: summary.unexcused,
      }
    : { present: 0, late: 0, excused_absence: 0, unexcused_absence: 0 }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Users}
        title={t('catechistAttendance.title')}
        subtitle={t('catechistAttendance.description')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {year && (
              <Badge variant={year.isActive ? 'default' : 'secondary'}>
                {year.name} ·{' '}
                {t(
                  year.isActive
                    ? 'catechistAttendance.yearActive'
                    : 'catechistAttendance.yearLocked',
                )}
              </Badge>
            )}
          </div>
        }
      />

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">
            {t('catechistAttendance.date')}
          </span>
          <DateInput value={date} onChange={(d) => d && setDate(d)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">
            {t('catechistAttendance.session')}
          </span>
          <Select
            value={sessionId ?? ''}
            onValueChange={(val) =>
              setPickedSessionId((val || null) as Id<'classSessions'> | null)
            }
            items={(sessions ?? []).map((s) => ({
              value: s.sessionId,
              label: s.className,
            }))}
            disabled={!sessions?.length}
          >
            <SelectTrigger className="w-64">
              <SelectValue
                placeholder={t('catechistAttendance.sessionPlaceholder')}
              />
            </SelectTrigger>
            <SelectContent>
              {(sessions ?? []).map((s) => (
                <SelectItem key={s.sessionId} value={s.sessionId}>
                  {s.className}
                  {s.sessionType === 'supplemental' ? ' (+)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {!readOnly && sessionId && (
          <Button variant="outline" onClick={() => setSubstituteOpen(true)}>
            <UserPlus className="size-4" />
            {t('catechistAttendance.addSubstitute')}
          </Button>
        )}
      </div>

      {year && readOnly && (
        <Alert>
          <AlertDescription>
            {t('catechistAttendance.lockedNotice')}
          </AlertDescription>
        </Alert>
      )}

      {sessions && sessions.length === 0 && (
        <div className="text-center p-12 text-muted-foreground border rounded-xl bg-card">
          {t('catechistAttendance.noSessions')}
        </div>
      )}

      {sessionId && summary && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {STATUS_OPTIONS.map(({ status, color, icon: Icon }) => (
            <Card key={status} size="sm">
              <CardContent className="flex items-center gap-2">
                <Icon className="size-4" style={{ color }} />
                <span className="text-sm text-muted-foreground">
                  {t(`attendance.status.${status}`)}
                </span>
                <span className="ml-auto font-semibold">{counts[status]}</span>
              </CardContent>
            </Card>
          ))}
          {summary.unrecorded !== null && (
            <Card size="sm">
              <CardContent className="flex items-center gap-2">
                <Circle className="size-4" style={{ color: UNSET_COLOR }} />
                <span className="text-sm text-muted-foreground">
                  {t('catechistAttendance.summary.unrecorded')}
                </span>
                <span className="ml-auto font-semibold">
                  {summary.unrecorded}
                </span>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {sessionId && (
        <DataTable
          columns={columns}
          data={rows}
          getRowId={(r) => r.catechistId}
          searchColumnKey="displayName"
          searchPlaceholder={t('catechistAttendance.search')}
          isLoading={roster === undefined}
        />
      )}

      {requesterId && sessionId && roster && (
        <SubstituteDialog
          open={substituteOpen}
          onOpenChange={setSubstituteOpen}
          requesterId={requesterId}
          sessionId={sessionId}
          excludeIds={new Set(rows.map((r) => r.catechistId))}
        />
      )}
    </div>
  )
}

function SubstituteDialog({
  open,
  onOpenChange,
  requesterId,
  sessionId,
  excludeIds,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  requesterId: Id<'catechists'>
  sessionId: Id<'classSessions'>
  excludeIds: Set<Id<'catechists'>>
}) {
  const { t } = useTranslation()
  const catechists = useQuery(
    api.catechists.listAllActive,
    open ? { requesterId } : 'skip',
  )
  const recordAttendance = useMutation(api.catechistAttendance.recordAttendance)
  const [saving, setSaving] = React.useState(false)

  const items = (catechists ?? [])
    .filter((c) => !excludeIds.has(c._id))
    .map((c) => ({
      value: c._id,
      label: formatPersonName(c.saintName, c.fullName),
    }))

  const submit = async (catechistId: Id<'catechists'>) => {
    setSaving(true)
    try {
      await recordAttendance({
        requesterId,
        sessionId,
        catechistId,
        status: 'present',
        roleAtSession: 'substitute',
        checkInMethod: 'manual',
      })
      toast.success(t('catechistAttendance.recorded'))
      onOpenChange(false)
    } catch (err) {
      toast.error(translateConvexError(err, t))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('catechistAttendance.addSubstitute')}</DialogTitle>
          <DialogDescription>
            {t('catechistAttendance.substituteDescription')}
          </DialogDescription>
        </DialogHeader>
        <Combobox
          value={null as Id<'catechists'> | null}
          onValueChange={(val) => val && !saving && submit(val)}
          items={items}
        >
          <ComboboxInput
            placeholder={t('catechistAttendance.substitutePlaceholder')}
          />
          <ComboboxContent>
            <ComboboxList>
              {items.map((item) => (
                <ComboboxItem key={item.value} value={item.value}>
                  {item.label}
                </ComboboxItem>
              ))}
            </ComboboxList>
            <ComboboxEmpty>
              {t('catechistAttendance.substituteEmpty')}
            </ComboboxEmpty>
          </ComboboxContent>
        </Combobox>
      </DialogContent>
    </Dialog>
  )
}
