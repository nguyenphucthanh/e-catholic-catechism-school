import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock,
  QrCode,
  UserPlus,
  Users,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
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
import { playBeep } from '~/lib/beep'
import { decodeQrPayload } from '~/lib/qr-payload'
import {
  compareByNameFormat,
  formatPersonName,
  sortByNameFormat,
} from '~/lib/name'
import { PageHeader } from '~/components/page-header'
import { DataTable } from '~/components/custom/data-table'
import { DateInput } from '~/components/custom/date-input'
import { QRScanner } from '~/components/custom/qr-scanner'
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
  // Deep link from the meeting pages: ?category=meeting&date=...&meetingId=...
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    category?: 'meeting'
    date?: string
    meetingId?: Id<'catechistMeetings'>
  } => ({
    category: search.category === 'meeting' ? ('meeting' as const) : undefined,
    date: typeof search.date === 'string' ? search.date : undefined,
    meetingId:
      typeof search.meetingId === 'string'
        ? (search.meetingId as Id<'catechistMeetings'>)
        : undefined,
  }),
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

  const search = Route.useSearch()
  const [category, setCategory] = React.useState<'class' | 'meeting'>(
    search.category === 'meeting' ? 'meeting' : 'class',
  )
  const isMeeting = category === 'meeting'
  const [date, setDate] = React.useState(() =>
    search.date ? parseISO(search.date) : new Date(),
  )
  const dateStr = format(date, 'yyyy-MM-dd')
  const [pickedSessionId, setPickedSessionId] =
    React.useState<Id<'classSessions'> | null>(null)
  const [pickedMeetingId, setPickedMeetingId] =
    React.useState<Id<'catechistMeetings'> | null>(search.meetingId ?? null)
  const [substituteOpen, setSubstituteOpen] = React.useState(false)

  const yearContext = useQuery(
    api.academicYears.getActiveYearContext,
    requesterId ? {} : 'skip',
  )
  const year = yearContext?.recentYears.find((y) => y._id === selectedYearId)

  const sessions = useQuery(
    api.catechistAttendance.listRecordableSessions,
    requesterId && selectedYearId && !isMeeting
      ? { academicYearId: selectedYearId, date: dateStr }
      : 'skip',
  )
  const meetings = useQuery(
    api.catechistMeetings.listRecordableMeetings,
    requesterId && selectedYearId && isMeeting
      ? { academicYearId: selectedYearId, date: dateStr }
      : 'skip',
  )
  // Fall back to the first session when none (or a stale one) is picked.
  const sessionId =
    sessions?.find((s) => s.sessionId === pickedSessionId)?.sessionId ??
    sessions?.[0]?.sessionId ??
    null

  const meetingId =
    meetings?.find((m) => m.meetingId === pickedMeetingId)?.meetingId ??
    meetings?.[0]?.meetingId ??
    null

  const sessionRoster = useQuery(
    api.catechistAttendance.getSessionAttendanceRoster,
    requesterId && sessionId && !isMeeting ? { sessionId } : 'skip',
  )
  const meetingRoster = useQuery(
    api.catechistAttendance.getMeetingAttendanceRoster,
    requesterId && meetingId && isMeeting ? { meetingId } : 'skip',
  )
  const roster = isMeeting ? meetingRoster : sessionRoster
  const targets = isMeeting ? meetings : sessions
  const hasTarget = isMeeting ? !!meetingId : !!sessionId

  const recordAttendance = useMutation(api.catechistAttendance.recordAttendance)
  const deleteRecord = useMutation(
    api.catechistAttendance.deleteAttendanceRecord,
  )

  const readOnly = !year?.isActive

  // ─── QR check-in ───
  // ponytail: online only; the student offline queue is keyed to studentClass rows
  const [qrMode, setQrMode] = React.useState(false)
  const [scanResult, setScanResult] = React.useState<{
    kind: 'success' | 'info' | 'error'
    text: string
  } | null>(null)
  const lastScanned = React.useRef<Record<string, number>>({})
  const scanCatechists = useQuery(
    api.catechists.listAllActive,
    requesterId && qrMode ? {} : 'skip',
  )

  const handleScan = async (raw: string) => {
    const target = isMeeting
      ? meetingId && { meetingId }
      : sessionId && { sessionId }
    if (!requesterId || !target || !scanCatechists) return
    const now = Date.now()
    if (now - (lastScanned.current[raw] ?? 0) < 1500) return
    lastScanned.current[raw] = now

    const fail = (text: string) => {
      playBeep('error')
      setScanResult({ kind: 'error', text })
    }
    const payload = decodeQrPayload(raw)
    if (payload?.type !== 'catechist') {
      fail(
        t(
          payload
            ? 'catechistAttendance.scan.notCatechistCard'
            : 'catechistAttendance.scan.invalidCode',
        ),
      )
      return
    }
    const catechist = scanCatechists.find(
      (c) => c.memberId === payload.memberId,
    )
    if (!catechist) {
      fail(t('catechistAttendance.scan.unknownCatechist'))
      return
    }
    const name = formatPersonName(catechist.saintName, catechist.fullName)
    try {
      const { action } = await recordAttendance({
        ...target,
        catechistId: catechist._id,
        status: 'present',
        checkInMethod: 'qr_scan',
        deviceQueuedAt: now,
      })
      if (action === 'conflict') {
        playBeep('duplicate')
        setScanResult({
          kind: 'info',
          text: t('catechistAttendance.scan.alreadyRecorded', { name }),
        })
        return
      }
      playBeep('success')
      const onRoster = rows.some(
        (r) =>
          r.catechistId === catechist._id && r.roleAtSession !== 'substitute',
      )
      const time = format(now, 'HH:mm')
      setScanResult({
        kind: 'success',
        text:
          t('catechistAttendance.scan.success', { name, time }) +
          (onRoster
            ? ''
            : ` (${t(`catechistAttendance.role.${isMeeting ? 'attendee' : 'substitute'}`)})`),
      })
    } catch (err) {
      playBeep('error')
      toast.error(translateConvexError(err, t))
    }
  }

  const nameFormat = useQuery(api.appConfig.get)?.nameFormat
  // Initial order follows the configured name format.
  const rows = React.useMemo<Array<RosterRow>>(
    () =>
      roster
        ? sortByNameFormat(
            [...roster.roster, ...roster.substitutes].map((r) => ({
              ...r,
              displayName: formatPersonName(r.saintName, r.fullName ?? ''),
            })),
            (r) => r.fullName ?? '',
            nameFormat,
          )
        : [],
    [roster, nameFormat],
  )

  const onToggle = async (row: RosterRow, status: Status) => {
    const target = isMeeting
      ? meetingId && { meetingId }
      : sessionId && { sessionId }
    if (!requesterId || !target) return
    try {
      if (row.status === status && row.recordId) {
        await deleteRecord({ recordId: row.recordId })
        toast.success(t('catechistAttendance.cleared'))
      } else {
        await recordAttendance({
          ...target,
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

  const categoryItems = (['class', 'meeting'] as const).map((c) => ({
    value: c,
    label: t(`catechistAttendance.category.${c}`),
  }))

  const columns: Array<TableColumnDef<RosterRow>> = [
    {
      accessorKey: 'displayName',
      header: t('catechistAttendance.col.catechist'),
      // Sort by fullName per name format, ignoring saint name.
      sortFn: (a, b) =>
        compareByNameFormat(
          a.original.fullName ?? '',
          b.original.fullName ?? '',
          nameFormat,
        ),
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
      />

      <div className="flex flex-wrap gap-4">
        {!readOnly && hasTarget && (
          <Button
            variant="secondary"
            onClick={() => {
              setQrMode(true)
              setScanResult(null)
            }}
          >
            <QrCode className="size-4" />
            {t('catechistAttendance.scan.start')}
          </Button>
        )}
        {!readOnly && !isMeeting && sessionId && (
          <Button variant="secondary" onClick={() => setSubstituteOpen(true)}>
            <UserPlus className="size-4" />
            {t('catechistAttendance.addSubstitute')}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">
            {t('catechistAttendance.date')}
          </span>
          <DateInput value={date} onChange={(d) => d && setDate(d)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">
            {t('catechistAttendance.category')}
          </span>
          <Select
            value={category}
            onValueChange={(val) => val && setCategory(val)}
            items={categoryItems}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categoryItems.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">
            {t(
              isMeeting
                ? 'catechistAttendance.meeting'
                : 'catechistAttendance.session',
            )}
          </span>
          {isMeeting ? (
            <Select
              value={meetingId ?? ''}
              onValueChange={(val) =>
                setPickedMeetingId(
                  (val || null) as Id<'catechistMeetings'> | null,
                )
              }
              items={(meetings ?? []).map((m) => ({
                value: m.meetingId,
                label: m.title,
              }))}
              disabled={!meetings?.length}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={t('catechistAttendance.meetingPlaceholder')}
                />
              </SelectTrigger>
              <SelectContent>
                {(meetings ?? []).map((m) => (
                  <SelectItem key={m.meetingId} value={m.meetingId}>
                    {m.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
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
              <SelectTrigger className="w-full">
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
          )}
        </div>
      </div>

      {year && readOnly && (
        <Alert>
          <AlertDescription>
            {t('catechistAttendance.lockedNotice')}
          </AlertDescription>
        </Alert>
      )}

      {targets && targets.length === 0 && (
        <div className="text-center p-12 text-muted-foreground border rounded-xl bg-card">
          {t(
            isMeeting
              ? 'catechistAttendance.noMeetings'
              : 'catechistAttendance.noSessions',
          )}
        </div>
      )}

      <Dialog
        open={qrMode && hasTarget && !readOnly}
        onOpenChange={(open) => {
          setQrMode(open)
          setScanResult(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('catechistAttendance.scan.start')}</DialogTitle>
          </DialogHeader>
          <div className="rounded-xl overflow-hidden bg-black">
            <QRScanner onScan={handleScan} active />
          </div>
          {scanResult && (
            <Alert
              variant={scanResult.kind === 'error' ? 'destructive' : 'default'}
            >
              <AlertDescription>{scanResult.text}</AlertDescription>
            </Alert>
          )}
        </DialogContent>
      </Dialog>

      {hasTarget && summary && (
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

      {hasTarget && (
        <DataTable
          columns={columns}
          data={rows}
          getRowId={(r) => r.catechistId}
          searchColumnKey="displayName"
          searchPlaceholder={t('catechistAttendance.search')}
          isLoading={roster === undefined}
        />
      )}

      {requesterId && !isMeeting && sessionId && roster && (
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
  const catechists = useQuery(api.catechists.listAllActive, open ? {} : 'skip')
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
