import * as React from 'react'
import { useForm, useSelector } from '@tanstack/react-form'
import { QrCode, Search, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { z } from 'zod'
import { format, parseISO } from 'date-fns'
import { api } from '../../../convex/_generated/api'
import type { FunctionReturnType } from 'convex/server'
import type { Id } from '../../../convex/_generated/dataModel'
import type { AttendanceStatus } from '~/components/custom/attendance-tile'
import { translateConvexError } from '~/lib/convex-errors'
import { decodeQrPayload } from '~/lib/qr-payload'
import { playBeep } from '~/lib/beep'
import { formatPersonName, sortByNameFormat } from '~/lib/name'
import { AttendanceTile } from '~/components/custom/attendance-tile'
import { QRScanner } from '~/components/custom/qr-scanner'
import { Badge } from '~/components/ui/badge'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '~/components/ui/combobox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '~/components/ui/input-group'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Textarea } from '~/components/ui/textarea'
import { DateInput } from '~/components/custom/date-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '~/components/ui/field'
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

type Meeting = NonNullable<
  FunctionReturnType<typeof api.catechistMeetings.getMeeting>
>

type Expected = FunctionReturnType<
  typeof api.catechistMeetings.getExpectedAttendees
>[number]

interface Mark {
  status: AttendanceStatus
  notes?: string
}

type ScanFeedback = {
  status: 'success' | 'duplicate' | 'unknown'
  name: string
}

const SCAN_DEBOUNCE_MS = 500

interface MeetingFormProps {
  requesterId: Id<'catechists'>
  /** Required when creating. */
  academicYearId?: Id<'academicYears'>
  /** Present when editing. */
  meeting?: Meeting
  onSuccess: () => void
  onCancel: () => void
}

const SCOPES = ['all', 'board', 'branch'] as const

export function MeetingForm({
  requesterId,
  academicYearId,
  meeting,
  onSuccess,
  onCancel,
}: MeetingFormProps) {
  const { t } = useTranslation()
  const [formDirty, setFormDirty] = React.useState(false)
  const [confirmLeaveOpen, setConfirmLeaveOpen] = React.useState(false)
  const createMeeting = useMutation(api.catechistMeetings.createMeeting)
  const updateMeeting = useMutation(api.catechistMeetings.updateMeeting)
  const branches = useQuery(api.branches.list, { requesterId })
  const appConfig = useQuery(api.appConfig.get)
  const allActive = useQuery(api.catechists.listAllActive, { requesterId })

  // Attendance state lives outside the TanStack form (not part of its zod
  // schema); untouched roster entries are saved as present.
  const [marks, setMarks] = React.useState<Record<string, Mark | undefined>>({})
  const [extraIds, setExtraIds] = React.useState<Array<string>>([])
  const [searchQuery, setSearchQuery] = React.useState('')
  const [expandedId, setExpandedId] = React.useState<string | null>(null)
  const [scanMode, setScanMode] = React.useState(false)
  const [scanUsed, setScanUsed] = React.useState(false)
  const [scanFeedback, setScanFeedback] = React.useState<ScanFeedback | null>(
    null,
  )
  const lastScanned = React.useRef<Record<string, number>>({})
  const snapshotRef = React.useRef<Record<string, Mark | undefined>>({})
  const marksRef = React.useRef(marks)
  marksRef.current = marks
  const extraIdsRef = React.useRef(extraIds)
  extraIdsRef.current = extraIds
  const rosterRef = React.useRef<Array<Expected>>([])
  const allActiveRef = React.useRef(allActive)
  allActiveRef.current = allActive

  const formSchema = React.useMemo(
    () =>
      z
        .object({
          title: z.string().trim().min(1, t('common.required')),
          meetingDate: z.string().min(1, t('common.required')),
          scope: z.enum(SCOPES),
          branchId: z.string(),
          startTime: z.string(),
          endTime: z.string(),
          location: z.string(),
          notes: z.string(),
        })
        .superRefine((v, ctx) => {
          if (v.scope === 'branch' && !v.branchId) {
            ctx.addIssue({
              code: 'custom',
              path: ['branchId'],
              message: t('common.required'),
            })
          }
          if (v.startTime && v.endTime && v.endTime <= v.startTime) {
            ctx.addIssue({
              code: 'custom',
              path: ['endTime'],
              message: t('meetings.form.endBeforeStart'),
            })
          }
        }),
    [t],
  )

  const scopeItems = SCOPES.map((s) => ({
    value: s,
    label: t(`meetings.scope.${s}`),
  }))
  const branchItems = (branches ?? []).map((b) => ({
    value: b._id,
    label: b.name,
  }))

  const form = useForm({
    defaultValues: {
      title: meeting?.title ?? '',
      meetingDate: meeting?.meetingDate ?? format(new Date(), 'yyyy-MM-dd'),
      scope: meeting?.scope ?? 'all',
      branchId: meeting?.branchId ?? '',
      startTime: meeting?.startTime ?? '',
      endTime: meeting?.endTime ?? '',
      location: meeting?.location ?? '',
      notes: meeting?.notes ?? '',
    },
    validators: { onSubmit: formSchema },
    onSubmit: async ({ value }) => {
      const branchId =
        value.scope === 'branch'
          ? (value.branchId as Id<'branches'>)
          : undefined
      const rosterIds = new Set<string>(
        rosterRef.current.map((r) => r.catechistId),
      )
      const attendance = [
        ...rosterRef.current.map((r) => r.catechistId as string),
        ...extraIdsRef.current.filter((id) => !rosterIds.has(id)),
      ].map((id) => ({
        catechistId: id as Id<'catechists'>,
        status: marksRef.current[id]?.status ?? ('present' as const),
        notes: marksRef.current[id]?.notes || undefined,
      }))
      try {
        if (meeting) {
          // Strings (even empty) are sent so cleared optional fields are overwritten.
          await updateMeeting({
            requesterId,
            meetingId: meeting._id,
            title: value.title.trim(),
            meetingDate: value.meetingDate,
            scope: value.scope,
            branchId,
            startTime: value.startTime,
            endTime: value.endTime,
            location: value.location,
            notes: value.notes,
            // Upserts these records; existing ones not listed are kept.
            // A cancelled meeting takes no attendance, but its fields stay editable.
            attendance: meeting.isCancelled ? undefined : attendance,
          })
        } else {
          if (!academicYearId) return
          await createMeeting({
            requesterId,
            academicYearId,
            title: value.title.trim(),
            meetingDate: value.meetingDate,
            scope: value.scope,
            branchId,
            startTime: value.startTime || undefined,
            endTime: value.endTime || undefined,
            location: value.location || undefined,
            notes: value.notes || undefined,
            attendance,
          })
        }
        toast.success(t('common.saved'))
        onSuccess()
      } catch (err) {
        toast.error(translateConvexError(err, t))
      }
    },
  })

  const scope = useSelector(form.store, (st) => st.values.scope)
  const branchSel = useSelector(form.store, (st) => st.values.branchId)
  const isSubmitting = useSelector(form.store, (st) => st.isSubmitting)
  const yearId = academicYearId ?? meeting?.academicYearId
  const needsBranch = scope === 'branch' && !branchSel

  // Live roster preview from the current scope/branch (create and edit).
  const expected = useQuery(
    api.catechistMeetings.getExpectedAttendees,
    yearId && !needsBranch
      ? {
          requesterId,
          academicYearId: yearId,
          scope,
          branchId:
            scope === 'branch' ? (branchSel as Id<'branches'>) : undefined,
        }
      : 'skip',
  )
  const saved = useQuery(
    api.catechistAttendance.getMeetingAttendanceRoster,
    meeting ? { requesterId, meetingId: meeting._id } : 'skip',
  )

  // Edit: show saved records once, anyone recorded outside the roster is an extra.
  const initialized = React.useRef(!meeting)
  React.useEffect(() => {
    if (initialized.current || !saved) return
    initialized.current = true
    const next: Record<string, Mark | undefined> = {}
    for (const r of [...saved.roster, ...saved.substitutes]) {
      if (r.status)
        next[r.catechistId] = { status: r.status, notes: r.notes ?? undefined }
    }
    setMarks(next)
    setExtraIds(saved.substitutes.map((r) => r.catechistId))
  }, [saved])

  // Roster changed: marks of catechists who left are dropped; extras who
  // joined the roster stop being extras.
  const prevIds = React.useRef<Set<string> | null>(null)
  React.useEffect(() => {
    if (!expected) return
    const ids = new Set<string>(expected.map((e) => e.catechistId))
    const left = prevIds.current
      ? [...prevIds.current].filter((id) => !ids.has(id))
      : []
    prevIds.current = ids
    setExtraIds((p) =>
      p.some((id) => ids.has(id)) ? p.filter((id) => !ids.has(id)) : p,
    )
    if (left.length) {
      setMarks((p) => {
        const n = { ...p }
        left.forEach((id) => delete n[id])
        return n
      })
    }
  }, [expected])

  const roster = React.useMemo(
    () =>
      sortByNameFormat<Expected>(
        expected ?? [],
        (e) => e.fullName,
        appConfig?.nameFormat,
      ),
    [expected, appConfig?.nameFormat],
  )
  rosterRef.current = roster
  const rosterLoading =
    !!yearId &&
    !needsBranch &&
    (expected === undefined || (!!meeting && !saved))

  const filteredRoster = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return roster
    return roster.filter((r) =>
      [r.fullName, r.saintName ?? '', r.memberId].some((f) =>
        f.toLowerCase().includes(q),
      ),
    )
  }, [roster, searchQuery])

  const statusOf = (id: string): AttendanceStatus =>
    marks[id]?.status ?? 'present'
  const setStatus = (id: string, status: AttendanceStatus) => {
    setMarks((p) => ({ ...p, [id]: { ...p[id], status } }))
    setFormDirty(true)
  }

  const extraItems = React.useMemo(() => {
    const rosterIds = new Set<string>(roster.map((r) => r.catechistId))
    return (allActive ?? [])
      .filter((c) => !rosterIds.has(c._id) && !extraIds.includes(c._id))
      .map((c) => ({
        value: c._id,
        label: formatPersonName(c.saintName, c.fullName),
      }))
  }, [allActive, roster, extraIds])
  const pickedExtras = extraIds.map((id) => {
    const c = allActive?.find((a) => a._id === id)
    const s = saved?.substitutes.find((r) => r.catechistId === id)
    return {
      value: id,
      label: c
        ? formatPersonName(c.saintName, c.fullName)
        : s?.fullName
          ? formatPersonName(s.saintName ?? undefined, s.fullName)
          : id,
    }
  })

  const summary = React.useMemo(() => {
    const counts = { present: 0, late: 0, absent: 0, excused: 0 }
    const rosterIds = new Set<string>(roster.map((r) => r.catechistId))
    for (const id of [
      ...rosterIds,
      ...extraIds.filter((i) => !rosterIds.has(i)),
    ]) {
      const st = marks[id]?.status ?? 'present'
      if (st === 'present') counts.present++
      else if (st === 'late') counts.late++
      else if (st === 'unexcused_absence') counts.absent++
      else counts.excused++
    }
    return { total: roster.length + extraIds.length, ...counts }
  }, [roster, extraIds, marks])

  // Scan mode: unset roster entries start absent; nothing scanned on close
  // restores what was there before.
  const handleScanDialogChange = (open: boolean) => {
    if (open) {
      snapshotRef.current = marksRef.current
      // each scan session decides on its own whether to restore on close
      setScanUsed(false)
      setMarks((p) => {
        const n = { ...p }
        rosterRef.current.forEach((r) => {
          n[r.catechistId] ??= { status: 'unexcused_absence' }
        })
        return n
      })
      setScanMode(true)
      return
    }
    setScanMode(false)
    setScanFeedback(null)
    if (!scanUsed) setMarks(snapshotRef.current)
  }

  // Stable identity: QRScanner restarts the camera when onScan changes
  const handleScan = React.useCallback((code: string) => {
    const now = Date.now()
    if (now - (lastScanned.current[code] ?? 0) < SCAN_DEBOUNCE_MS) return
    lastScanned.current[code] = now

    const payload = decodeQrPayload(code)
    const memberId =
      payload?.type === 'catechist' ? payload.memberId.toLowerCase() : null
    const onRoster = memberId
      ? rosterRef.current.find((r) => r.memberId.toLowerCase() === memberId)
      : undefined
    const other =
      memberId && !onRoster
        ? allActiveRef.current?.find(
            (c) => c.memberId.toLowerCase() === memberId,
          )
        : undefined
    const id = onRoster?.catechistId ?? other?._id
    const person = onRoster ?? other
    if (!id || !person) {
      setScanFeedback({ status: 'unknown', name: code })
      return
    }
    const isNewExtra = !onRoster && !extraIdsRef.current.includes(id)
    const current =
      marksRef.current[id]?.status ?? (isNewExtra ? undefined : 'present')
    const dup = current === 'present' || current === 'late'
    setScanFeedback({
      status: dup ? 'duplicate' : 'success',
      name: person.fullName,
    })
    if (dup) return

    setScanUsed(true)
    setFormDirty(true)
    playBeep('success')
    // Not available on iOS Safari
    if ('vibrate' in navigator) navigator.vibrate(100)
    if (isNewExtra) setExtraIds((p) => [...p, id])
    setMarks((p) => ({ ...p, [id]: { ...p[id], status: 'present' } }))
  }, [])

  React.useEffect(() => {
    if (!scanFeedback) return
    const timer = setTimeout(() => setScanFeedback(null), 2000)
    return () => clearTimeout(timer)
  }, [scanFeedback])

  const handleCancel = () =>
    formDirty ? setConfirmLeaveOpen(true) : onCancel()

  const textField = (
    name: 'title' | 'location' | 'startTime' | 'endTime',
    opts: { required?: boolean; type?: string } = {},
  ) => (
    <form.Field
      name={name}
      children={(field) => {
        const isInvalid =
          field.state.meta.isTouched && !field.state.meta.isValid
        return (
          <Field data-invalid={isInvalid}>
            <FieldLabel htmlFor={name}>
              {t(`meetings.fields.${name}`)}
              {opts.required && <span className="text-destructive"> *</span>}
            </FieldLabel>
            <Input
              id={name}
              name={name}
              type={opts.type}
              value={field.state.value}
              onChange={(e) => {
                field.handleChange(e.target.value)
                setFormDirty(true)
              }}
              onBlur={field.handleBlur}
              aria-invalid={isInvalid}
            />
            {isInvalid && <FieldError errors={field.state.meta.errors} />}
          </Field>
        )
      }}
    />
  )

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}
        className="flex flex-col gap-8 pb-24"
      >
        <FieldSet>
          <FieldLegend>{t('meetings.form.basic')}</FieldLegend>
          <FieldDescription>
            {t('meetings.form.basicDescription')}
          </FieldDescription>
          <FieldGroup>
            {textField('title', { required: true })}
            <form.Field
              name="meetingDate"
              children={(field) => (
                <Field>
                  <FieldLabel>
                    {t('meetings.fields.meetingDate')}
                    <span className="text-destructive"> *</span>
                  </FieldLabel>
                  <DateInput
                    value={
                      field.state.value
                        ? parseISO(field.state.value)
                        : undefined
                    }
                    onChange={(d) => {
                      if (!d) return
                      field.handleChange(format(d, 'yyyy-MM-dd'))
                      setFormDirty(true)
                    }}
                  />
                </Field>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              {textField('startTime', { type: 'time' })}
              {textField('endTime', { type: 'time' })}
            </div>
            {textField('location')}
          </FieldGroup>
        </FieldSet>

        <FieldSet>
          <FieldLegend>{t('meetings.form.attendees')}</FieldLegend>
          <FieldDescription>
            {t('meetings.form.attendeesDescription')}
          </FieldDescription>
          <FieldGroup>
            <form.Field
              name="scope"
              children={(field) => (
                <Field>
                  <FieldLabel>
                    {t('meetings.fields.scope')}
                    <span className="text-destructive"> *</span>
                  </FieldLabel>
                  <Select
                    value={field.state.value}
                    items={scopeItems}
                    onValueChange={(val) => {
                      if (!val) return
                      field.handleChange(val)
                      setFormDirty(true)
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {scopeItems.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />
            <form.Subscribe
              selector={(s) => s.values.scope}
              children={(sc) =>
                sc === 'branch' && (
                  <form.Field
                    name="branchId"
                    children={(field) => {
                      const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid
                      return (
                        <Field data-invalid={isInvalid}>
                          <FieldLabel>
                            {t('meetings.fields.branch')}
                            <span className="text-destructive"> *</span>
                          </FieldLabel>
                          <Select
                            value={field.state.value || null}
                            items={branchItems}
                            onValueChange={(val) => {
                              field.handleChange(val ?? '')
                              setFormDirty(true)
                            }}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue
                                placeholder={t(
                                  'meetings.fields.branchPlaceholder',
                                )}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {branchItems.map((b) => (
                                <SelectItem key={b.value} value={b.value}>
                                  {b.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {isInvalid && (
                            <FieldError errors={field.state.meta.errors} />
                          )}
                        </Field>
                      )
                    }}
                  />
                )
              }
            />
          </FieldGroup>
        </FieldSet>

        <FieldSet>
          <FieldLegend>{t('meetings.form.extra')}</FieldLegend>
          <FieldDescription>
            {t('meetings.form.extraDescription')}
          </FieldDescription>
          <FieldGroup>
            <form.Field
              name="notes"
              children={(field) => (
                <Field>
                  <FieldLabel htmlFor="notes">
                    {t('meetings.fields.notes')}
                  </FieldLabel>
                  <Textarea
                    id="notes"
                    value={field.state.value}
                    onChange={(e) => {
                      field.handleChange(e.target.value)
                      setFormDirty(true)
                    }}
                    onBlur={field.handleBlur}
                  />
                </Field>
              )}
            />
          </FieldGroup>
        </FieldSet>

        <FieldSet>
          <FieldLegend>{t('meetings.attendance.title')}</FieldLegend>
          <FieldDescription>
            {t('meetings.attendance.description')}
          </FieldDescription>
          <FieldGroup>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                size="lg"
                disabled={rosterLoading || roster.length === 0}
                onClick={() => handleScanDialogChange(true)}
              >
                <QrCode />
                {t('attendance.createSession.scanStart')}
              </Button>
              <div className="rounded-full bg-muted px-3 py-1.5 text-sm font-medium text-muted-foreground shadow-inner">
                {t('attendance.createSession.summary', summary)}
              </div>
            </div>
            {needsBranch ? (
              <div className="rounded-xl border border-dashed py-10 text-center text-muted-foreground">
                {t('meetings.attendance.selectBranch')}
              </div>
            ) : filteredRoster.length === 0 ? (
              <div className="rounded-xl border border-dashed py-10 text-center text-muted-foreground">
                {rosterLoading
                  ? t('common.loading')
                  : roster.length === 0
                    ? t('meetings.attendance.empty')
                    : t('common.noResultsFound')}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredRoster.map((r) => (
                  <AttendanceTile
                    key={r.catechistId}
                    id={`catechist-${r.catechistId}`}
                    saintName={r.saintName}
                    fullName={r.fullName}
                    subtitle={r.memberId}
                    status={statusOf(r.catechistId)}
                    expanded={expandedId === r.catechistId}
                    onExpand={() => setExpandedId(r.catechistId)}
                    onCollapse={() => setExpandedId(null)}
                    onSelect={(st) => {
                      setStatus(r.catechistId, st)
                      setExpandedId(null)
                    }}
                  />
                ))}
              </div>
            )}
            <Field>
              <FieldLabel>{t('meetings.attendance.extraLabel')}</FieldLabel>
              <Combobox
                value={null as string | null}
                onValueChange={(val) => {
                  if (!val) return
                  setExtraIds((p) => [...p, val])
                  setFormDirty(true)
                }}
                items={extraItems}
              >
                <ComboboxInput
                  placeholder={t('meetings.attendance.extraPlaceholder')}
                />
                <ComboboxContent>
                  <ComboboxList>
                    {extraItems.map((item) => (
                      <ComboboxItem key={item.value} value={item.value}>
                        {item.label}
                      </ComboboxItem>
                    ))}
                  </ComboboxList>
                  <ComboboxEmpty>
                    {t('meetings.attendance.extraEmpty')}
                  </ComboboxEmpty>
                </ComboboxContent>
              </Combobox>
              {pickedExtras.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {pickedExtras.map((x) => (
                    <li key={x.value}>
                      <Badge variant="secondary" className="gap-1 pr-1">
                        {x.label}
                        <button
                          type="button"
                          aria-label={t('meetings.attendance.extraRemove')}
                          className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                          onClick={() => {
                            setExtraIds((p) => p.filter((i) => i !== x.value))
                            setFormDirty(true)
                          }}
                        >
                          <X className="size-3" />
                        </button>
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Field>
          </FieldGroup>
        </FieldSet>
      </form>

      <Dialog open={scanMode} onOpenChange={handleScanDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('attendance.createSession.scanStart')}</DialogTitle>
            <DialogDescription className="sr-only">
              {t('attendance.createSession.scanStart')}
            </DialogDescription>
          </DialogHeader>
          <div className="relative mx-auto aspect-square w-full overflow-hidden rounded-xl border">
            <QRScanner
              active={!confirmLeaveOpen && !isSubmitting}
              onScan={handleScan}
            />
            {scanFeedback && (
              <div
                role="status"
                className={`absolute inset-x-4 top-4 rounded-full px-4 py-2 text-center text-sm font-semibold text-white shadow-md ${
                  scanFeedback.status === 'success'
                    ? 'bg-emerald-600'
                    : scanFeedback.status === 'duplicate'
                      ? 'bg-amber-500'
                      : 'bg-red-600'
                }`}
              >
                {scanFeedback.status === 'unknown'
                  ? t('meetings.attendance.scanUnknown')
                  : `${scanFeedback.name} — ${t(
                      scanFeedback.status === 'success'
                        ? 'attendance.scanning.overlay.success'
                        : 'attendance.scanning.overlay.duplicate',
                    )}`}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div className="fixed bottom-0 left-0 right-0 sm:left-[var(--sidebar-width)] z-50 p-4 border-t bg-background/80 backdrop-blur-md shadow-lg flex items-center gap-4 transition-[left] ease-linear duration-200">
        <InputGroup className="flex-1">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            type="text"
            placeholder={t('meetings.attendance.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </InputGroup>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            onClick={() => void form.handleSubmit()}
            disabled={isSubmitting || rosterLoading}
          >
            {isSubmitting ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      </div>

      <AlertDialog open={confirmLeaveOpen} onOpenChange={setConfirmLeaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('meetings.confirmLeave.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('meetings.confirmLeave.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmLeaveOpen(false)
                onCancel()
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('meetings.confirmLeave.discard')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
