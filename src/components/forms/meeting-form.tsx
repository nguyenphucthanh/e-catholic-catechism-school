import * as React from 'react'
import { useForm, useSelector } from '@tanstack/react-form'
import { QrCode, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { z } from 'zod'
import { format, parseISO } from 'date-fns'
import { api } from '../../../convex/_generated/api'
import type { FunctionReturnType } from 'convex/server'
import type { Id } from '../../../convex/_generated/dataModel'
import type {
  AttendanceStatus,
  TileStatus,
} from '~/components/custom/attendance-tile'
import { translateConvexError } from '~/lib/convex-errors'
import { decodeQrPayload } from '~/lib/qr-payload'
import { formatPersonName, sortByNameFormat } from '~/lib/name'
import { AttendanceTile } from '~/components/custom/attendance-tile'
import { AttendanceBottomBar } from '~/components/custom/attendance-bottom-bar'
import { ScanDialog } from '~/components/custom/scan-dialog'
import { summarizeAttendance } from '~/components/custom/attendance-summary'
import { useScanFeedback } from '~/components/custom/use-scan-feedback'
import { Badge } from '~/components/ui/badge'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '~/components/ui/combobox'
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

type ExpectedAttendee = FunctionReturnType<
  typeof api.catechistMeetings.getExpectedAttendees
>[number]

interface Mark {
  status: AttendanceStatus
  notes?: string
}

type Marks = Record<string, Mark | undefined>

const ATTENDANCE_STATUSES = [
  'present',
  'late',
  'unexcused_absence',
  'excused_absence',
] as const

interface MeetingFormProps {
  /** Required when creating. */
  academicYearId?: Id<'academicYears'>
  /** Present when editing. */
  meeting?: Meeting
  onSuccess: () => void
  onCancel: () => void
}

const SCOPES = ['all', 'board', 'branch'] as const

export function MeetingForm({
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
  const branches = useQuery(api.branches.list, {})
  const appConfig = useQuery(api.appConfig.get)
  const allActive = useQuery(api.catechists.listAllActive, {})

  // Attendance (marks + extras) lives in the form values. Create: untouched
  // roster entries are saved as present. Edit: they are 'unset' (no record).
  const isEdit = !!meeting
  // Edit: roster entries the user explicitly set back to unset.
  const unsetRef = React.useRef<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = React.useState('')
  const [expandedId, setExpandedId] = React.useState<string | null>(null)
  const [scanMode, setScanMode] = React.useState(false)
  const [scanUsed, setScanUsed] = React.useState(false)
  const snapshotRef = React.useRef<Marks>({})

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
          attendance: z.record(
            z.string(),
            z
              .object({
                status: z.enum(ATTENDANCE_STATUSES),
                notes: z.string().optional(),
              })
              .optional(),
          ),
          extraIds: z.array(z.string()),
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
      attendance: {},
      extraIds: [] as Array<string>,
    },
    validators: { onSubmit: formSchema },
    onSubmit: async ({ value }) => {
      const branchId =
        value.scope === 'branch'
          ? (value.branchId as Id<'branches'>)
          : undefined
      const rosterIds = new Set<string>(roster.map((r) => r.catechistId))
      const attendance = [
        // Edit: roster entries without a status are unset and not saved.
        ...roster
          .map((r) => r.catechistId as string)
          .filter((id) => !meeting || value.attendance[id]),
        ...value.extraIds.filter((id) => !rosterIds.has(id)),
      ].map((id) => ({
        catechistId: id as Id<'catechists'>,
        status: value.attendance[id]?.status ?? ('present' as const),
        notes: value.attendance[id]?.notes || undefined,
      }))
      // Edit: unset roster entries that had a saved record are cleared.
      const clearCatechistIds = [...unsetRef.current].filter(
        (id) => rosterIds.has(id) && savedIds.has(id) && !value.attendance[id],
      ) as Array<Id<'catechists'>>
      try {
        if (meeting) {
          // Strings (even empty) are sent so cleared optional fields are overwritten.
          await updateMeeting({
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
            clearCatechistIds: meeting.isCancelled
              ? undefined
              : clearCatechistIds,
          })
        } else {
          if (!academicYearId) return
          await createMeeting({
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
  const selectedBranchId = useSelector(form.store, (st) => st.values.branchId)
  const marks = useSelector(form.store, (st) => st.values.attendance)
  const extraIds = useSelector(form.store, (st) => st.values.extraIds)
  const isSubmitting = useSelector(form.store, (st) => st.isSubmitting)
  const yearId = academicYearId ?? meeting?.academicYearId
  const needsBranch = scope === 'branch' && !selectedBranchId

  // Live roster preview from the current scope/branch (create and edit).
  const expected = useQuery(
    api.catechistMeetings.getExpectedAttendees,
    yearId && !needsBranch
      ? {
          academicYearId: yearId,
          scope,
          branchId:
            scope === 'branch'
              ? (selectedBranchId as Id<'branches'>)
              : undefined,
        }
      : 'skip',
  )
  const saved = useQuery(
    api.catechistAttendance.getMeetingAttendanceRoster,
    meeting ? { meetingId: meeting._id } : 'skip',
  )

  const savedIds = React.useMemo(
    () =>
      new Set<string>(
        [...(saved?.roster ?? []), ...(saved?.substitutes ?? [])]
          .filter((r) => r.status)
          .map((r) => r.catechistId),
      ),
    [saved],
  )

  // Edit: show saved records once, anyone recorded outside the roster is an extra.
  const initialized = React.useRef(!meeting)
  React.useEffect(() => {
    if (initialized.current || !saved) return
    initialized.current = true
    const next: Marks = {}
    for (const r of [...saved.roster, ...saved.substitutes]) {
      if (r.status)
        next[r.catechistId] = { status: r.status, notes: r.notes ?? undefined }
    }
    form.setFieldValue('attendance', next)
    form.setFieldValue(
      'extraIds',
      saved.substitutes.map((r) => r.catechistId),
    )
  }, [saved, form])

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
    const extras = form.getFieldValue('extraIds')
    if (extras.some((id) => ids.has(id))) {
      form.setFieldValue(
        'extraIds',
        extras.filter((id) => !ids.has(id)),
      )
    }
    if (left.length) {
      const n = { ...form.getFieldValue('attendance') }
      left.forEach((id) => delete n[id])
      form.setFieldValue('attendance', n)
    }
  }, [expected, form])

  const roster = React.useMemo(
    () =>
      sortByNameFormat<ExpectedAttendee>(
        expected ?? [],
        (e) => e.fullName,
        appConfig?.nameFormat,
      ),
    [expected, appConfig?.nameFormat],
  )
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

  const statusOf = (id: string): TileStatus =>
    marks[id]?.status ?? (isEdit ? 'unset' : 'present')
  const setStatus = (id: string, status: TileStatus) => {
    const next = { ...form.getFieldValue('attendance') }
    if (status === 'unset') {
      delete next[id]
      unsetRef.current.add(id)
    } else {
      next[id] = { ...marks[id], status }
      unsetRef.current.delete(id)
    }
    form.setFieldValue('attendance', next)
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

  const rosterIds = new Set<string>(roster.map((r) => r.catechistId))
  const summaryIds = [
    ...rosterIds,
    ...extraIds.filter((i) => !rosterIds.has(i)),
  ]
  const unsetCount = isEdit
    ? summaryIds.filter((id) => statusOf(id) === 'unset' && rosterIds.has(id))
        .length
    : 0
  const summary = summarizeAttendance(
    summaryIds
      .map((id) => statusOf(id))
      .filter((s): s is AttendanceStatus => s !== 'unset'),
  )
  summary.total += unsetCount

  const {
    feedback: scanFeedback,
    clearFeedback,
    onScan,
  } = useScanFeedback((code) => {
    const payload = decodeQrPayload(code)
    const memberId =
      payload?.type === 'catechist' ? payload.memberId.toLowerCase() : null
    const onRoster = memberId
      ? roster.find((r) => r.memberId.toLowerCase() === memberId)
      : undefined
    const other =
      memberId && !onRoster
        ? allActive?.find((c) => c.memberId.toLowerCase() === memberId)
        : undefined
    const id = onRoster?.catechistId ?? other?._id
    const person = onRoster ?? other
    if (!id || !person) return { status: 'unknown', name: code }

    const currentMarks = form.getFieldValue('attendance')
    const currentExtras = form.getFieldValue('extraIds')
    const isNewExtra = !onRoster && !currentExtras.includes(id)
    const current =
      currentMarks[id]?.status ??
      (isNewExtra || (isEdit && onRoster) ? undefined : 'present')
    if (current === 'present' || current === 'late')
      return { status: 'duplicate', name: person.fullName }

    setScanUsed(true)
    setFormDirty(true)
    if (isNewExtra) form.setFieldValue('extraIds', [...currentExtras, id])
    form.setFieldValue('attendance', {
      ...currentMarks,
      [id]: { ...currentMarks[id], status: 'present' },
    })
    return { status: 'success', name: person.fullName }
  })

  // Scan mode: unset roster entries (edit: no saved status) start absent; nothing scanned on close
  // restores what was there before.
  const handleScanDialogChange = (open: boolean) => {
    if (open) {
      const current = form.getFieldValue('attendance')
      snapshotRef.current = current
      // each scan session decides on its own whether to restore on close
      setScanUsed(false)
      const n = { ...current }
      roster.forEach((r) => {
        n[r.catechistId] ??= { status: 'unexcused_absence' }
      })
      form.setFieldValue('attendance', n)
      setScanMode(true)
      return
    }
    setScanMode(false)
    clearFeedback()
    if (!scanUsed) form.setFieldValue('attendance', snapshotRef.current)
  }

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
        id="meeting-form"
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
              children={(currentScope) =>
                currentScope === 'branch' && (
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
                {unsetCount > 0 &&
                  `, ${unsetCount} ${t('attendance.summary.unset')}`}
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
                    allowUnset={isEdit}
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
                  form.setFieldValue('extraIds', [
                    ...form.getFieldValue('extraIds'),
                    val,
                  ])
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
                            form.setFieldValue(
                              'extraIds',
                              form
                                .getFieldValue('extraIds')
                                .filter((i) => i !== x.value),
                            )
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

      <ScanDialog
        open={scanMode}
        onOpenChange={handleScanDialogChange}
        active={!confirmLeaveOpen && !isSubmitting}
        onScan={onScan}
        feedback={scanFeedback}
        unknownLabelKey="meetings.attendance.scanUnknown"
      />

      <AttendanceBottomBar
        searchPlaceholder={t('meetings.attendance.searchPlaceholder')}
        search={searchQuery}
        onSearchChange={setSearchQuery}
        onCancel={handleCancel}
        saveLabel={t('common.save')}
        saveDisabled={rosterLoading}
        isSubmitting={isSubmitting}
        form="meeting-form"
      />

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
