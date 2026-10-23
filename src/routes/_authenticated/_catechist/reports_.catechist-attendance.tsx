import * as React from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { format, parseISO, subMonths } from 'date-fns'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock,
  Download,
  UserCheck,
} from 'lucide-react'
import type { FunctionReturnType } from 'convex/server'
import type { LucideIcon } from 'lucide-react'
import type { Id } from '~/../convex/_generated/dataModel'
import type { CellValue } from '~/lib/export/types'
import type { TableColumnDef } from '~/components/custom/data-table'
import { api } from '~/../convex/_generated/api'
import { useAuth } from '~/lib/auth'
import { useSelectedAcademicYear } from '~/lib/academic-year'
import {
  compareByNameFormat,
  formatPersonName,
  sortByNameFormat,
} from '~/lib/name'
import { exportCsv, exportPdf } from '~/lib/export'
import { Alert, AlertDescription } from '~/components/ui/alert'
import { Button } from '~/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { DataTable } from '~/components/custom/data-table'
import { DateInput } from '~/components/custom/date-input'
import { PageHeader } from '~/components/page-header'

export const Route = createFileRoute(
  '/_authenticated/_catechist/reports_/catechist-attendance',
)({
  component: CatechistAttendanceReportPage,
  staticData: {
    crumbs: [
      { label: 'nav.reports' },
      { label: 'reports.catechistAttendance.title' },
    ],
  },
})

type Report = FunctionReturnType<
  typeof api.catechistAttendance.getYearlyMatrixReport
>
type Row = Report['rows'][number]
type Cell = Row['cells'][number]

// CLAUDE.md attendance palette + icons.
const CELL_STYLE: Record<
  NonNullable<Cell>,
  { icon: LucideIcon; color: string }
> = {
  present: { icon: CheckCircle2, color: '#10B981' },
  late: { icon: Clock, color: '#F59E0B' },
  excused_absence: { icon: AlertCircle, color: '#8B5CF6' },
  unexcused_absence: { icon: AlertTriangle, color: '#EF4444' },
  unrecorded: { icon: Circle, color: '#9CA3AF' },
}

const LEGEND: Array<NonNullable<Cell>> = [
  'present',
  'late',
  'excused_absence',
  'unexcused_absence',
  'unrecorded',
]

const ALL = 'all'
type Kind = 'class' | 'meeting'

// Worst status wins when several targets share a date for one catechist.
const SEVERITY: Record<NonNullable<Cell>, number> = {
  unexcused_absence: 5,
  excused_absence: 4,
  unrecorded: 3,
  late: 2,
  present: 1,
}

const toIso = (d: Date) => format(d, 'yyyy-MM-dd')
const shortDate = (iso: string) => `${iso.slice(8)}/${iso.slice(5, 7)}`

function worstCell(cells: Row['cells'], idx: Array<number>): Cell {
  let worst: Cell = null
  for (const i of idx) {
    const c = cells[i]
    if (c && (!worst || SEVERITY[c] > SEVERITY[worst])) worst = c
  }
  return worst
}

function pct(rate: number | null) {
  return rate === null ? '—' : `${Math.round(rate * 100)}%`
}

function CatechistAttendanceReportPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { selectedYearId } = useSelectedAcademicYear()
  const requesterId =
    user?.accountType === 'catechist'
      ? (user.userDocId as Id<'catechists'>)
      : undefined

  const perms = useQuery(
    api.catechistPermissions.getPermissions,
    requesterId && selectedYearId
      ? { requesterId, academicYearId: selectedYearId }
      : 'skip',
  )
  const branches = useQuery(
    api.branches.list,
    requesterId ? { requesterId } : 'skip',
  )
  const [branch, setBranch] = React.useState<string>(ALL)
  const [kind, setKind] = React.useState<Kind>('class')
  const [range, setRange] = React.useState<{ from?: Date; to?: Date } | null>(
    null,
  )
  React.useEffect(() => setRange(null), [selectedYearId])

  const year = useQuery(
    api.academicYears.get,
    requesterId && selectedYearId
      ? { requesterId, id: selectedYearId }
      : 'skip',
  )
  // Default: last 3 months, clamped to the selected academic year.
  const defaultRange = React.useMemo(() => {
    if (!year) return undefined
    const start = parseISO(year.startDate)
    const end = parseISO(year.endDate)
    const to = new Date() < end ? new Date() : end
    const from = subMonths(to, 3)
    return { from: from < start ? start : from, to }
  }, [year])
  const { from, to } = range ?? defaultRange ?? {}

  // Admin/board see the whole year; a branch head only their own branches.
  const wholeYear = !!perms && (perms.isAdmin || perms.isBoardMember)
  const headBranches = perms?.branchHeadOf ?? []
  const allowed = wholeYear || headBranches.length > 0
  const branchOptions = (branches ?? []).filter(
    (b) => wholeYear || headBranches.includes(b._id),
  )
  const effectiveBranch =
    branch === ALL && !wholeYear ? (headBranches[0] ?? ALL) : branch

  const report = useQuery(
    api.catechistAttendance.getYearlyMatrixReport,
    requesterId && selectedYearId && allowed && defaultRange
      ? {
          requesterId,
          academicYearId: selectedYearId,
          kind,
          fromDate: from && toIso(from),
          toDate: to && toIso(to),
          branchId:
            effectiveBranch === ALL
              ? undefined
              : (effectiveBranch as Id<'branches'>),
        }
      : 'skip',
  )

  const nameFormat = useQuery(api.appConfig.get)?.nameFormat
  // Initial order follows the configured name format (backend sorts by fullName).
  const rows = React.useMemo(
    () => sortByNameFormat(report?.rows ?? [], (r) => r.fullName, nameFormat),
    [report?.rows, nameFormat],
  )

  // One column per distinct date; idx = targets that fall on it.
  const dates = React.useMemo(() => {
    const byDate = new Map<string, Array<number>>()
    ;(report?.targets ?? []).forEach((x, i) =>
      byDate.set(x.date, [...(byDate.get(x.date) ?? []), i]),
    )
    return [...byDate].map(([date, idx]) => ({ date, idx }))
  }, [report?.targets])

  const columns = React.useMemo<Array<TableColumnDef<Row>>>(() => {
    const base: Array<TableColumnDef<Row>> = [
      {
        id: 'fullName',
        accessorFn: (r) => formatPersonName(r.saintName, r.fullName),
        header: t('reports.catechistAttendance.col.catechist'),
        // Sort by fullName per name format, ignoring saint name.
        sortFn: (a, b) =>
          compareByNameFormat(
            a.original.fullName,
            b.original.fullName,
            nameFormat,
          ),
        cell: ({ row }) => (
          <Link
            to="/catechists/$id"
            params={{ id: row.original.catechistId }}
            className="text-primary hover:underline font-medium whitespace-nowrap"
          >
            {formatPersonName(row.original.saintName, row.original.fullName)}
          </Link>
        ),
      },
      {
        id: 'rate',
        accessorFn: (r) => r.totals.rate ?? -1,
        header: t('reports.catechistAttendance.col.rate'),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {pct(row.original.totals.rate)}{' '}
            <span className="text-xs text-muted-foreground">
              ({row.original.totals.present + row.original.totals.late}/
              {row.original.totals.total})
            </span>
          </span>
        ),
      },
    ]
    const dateCols = dates.map(({ date, idx }): TableColumnDef<Row> => ({
      id: date,
      enableSorting: false,
      header: () => (
        <span
          title={idx.map((i) => report!.targets[i].label).join(', ')}
          className="whitespace-nowrap text-xs"
        >
          {shortDate(date)}
        </span>
      ),
      cell: ({ row }) => {
        const cell = worstCell(row.original.cells, idx)
        if (!cell) return null
        const { icon: Icon, color } = CELL_STYLE[cell]
        const label = t(
          cell === 'unrecorded'
            ? 'attendance.status.unset'
            : `attendance.status.${cell}`,
        )
        // Per-target breakdown for dates holding several targets.
        const detail = idx
          .filter((i) => row.original.cells[i])
          .map((i) => report!.targets[i].label)
          .join(', ')
        return (
          <span title={detail}>
            <Icon className="size-4" style={{ color }} aria-label={label} />
          </span>
        )
      },
    }))
    return [...base, ...dateCols]
  }, [dates, report, t, nameFormat])

  const csvHeaders = React.useMemo(
    () => [
      t('reports.catechistAttendance.col.catechist'),
      ...dates.map((d) => d.date),
      t('reports.catechistAttendance.col.rate'),
    ],
    [dates, t],
  )
  const csvRows = React.useMemo<Array<Record<string, CellValue>>>(
    () =>
      rows.map((r) => {
        const out: Record<string, CellValue> = {
          [csvHeaders[0]]: formatPersonName(r.saintName, r.fullName),
        }
        dates.forEach(({ idx }, i) => {
          const c = worstCell(r.cells, idx)
          out[csvHeaders[i + 1]] = c
            ? t(
                c === 'unrecorded'
                  ? 'attendance.status.unset'
                  : `attendance.status.${c}`,
              )
            : ''
        })
        out[csvHeaders[csvHeaders.length - 1]] = pct(r.totals.rate)
        return out
      }),
    [rows, dates, csvHeaders, t],
  )

  // PDF: per-target columns don't fit a page, so export totals only.
  const pdfHeaders = React.useMemo(
    () => [
      t('reports.catechistAttendance.col.catechist'),
      t('attendance.status.present'),
      t('attendance.status.late'),
      t('attendance.status.excused_absence'),
      t('attendance.status.unexcused_absence'),
      t('reports.catechistAttendance.col.rate'),
    ],
    [t],
  )
  const pdfRows = React.useMemo<Array<Record<string, CellValue>>>(
    () =>
      rows.map((r) => ({
        [pdfHeaders[0]]: formatPersonName(r.saintName, r.fullName),
        [pdfHeaders[1]]: r.totals.present,
        [pdfHeaders[2]]: r.totals.late,
        [pdfHeaders[3]]: r.totals.excused,
        [pdfHeaders[4]]: r.totals.unexcused,
        [pdfHeaders[5]]: pct(r.totals.rate),
      })),
    [rows, pdfHeaders],
  )

  const branchItems = [
    ...(wholeYear
      ? [{ value: ALL, label: t('reports.catechistAttendance.allBranches') }]
      : []),
    ...branchOptions.map((b) => ({ value: b._id, label: b.name })),
  ]

  const kindItems = (['class', 'meeting'] as const).map((k) => ({
    value: k,
    label: t(`reports.catechistAttendance.type.${k}`),
  }))

  return (
    <div className="flex-1 flex flex-col gap-6">
      <PageHeader
        title={t('reports.catechistAttendance.title')}
        subtitle={t('reports.catechistAttendance.description')}
        icon={UserCheck}
        actions={
          report && report.rows.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline">
                    <Download className="size-4" />
                    {t('classes.export.title', 'Xuất báo cáo')}
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() =>
                    exportCsv(csvRows, 'catechist-attendance.csv', csvHeaders)
                  }
                >
                  {t('classes.export.csv', 'Xuất CSV')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    exportPdf(
                      pdfRows,
                      t('reports.catechistAttendance.title'),
                      {
                        [t('reports.catechistAttendance.filters.type')]: t(
                          `reports.catechistAttendance.type.${kind}`,
                        ),
                        [t('reports.catechistAttendance.filters.dateRange')]:
                          `${from ? format(from, 'dd/MM/yyyy') : ''} – ${to ? format(to, 'dd/MM/yyyy') : ''}`,
                      },
                      'catechist-attendance.pdf',
                      pdfHeaders,
                      ['*', 'auto', 'auto', 'auto', 'auto', 'auto'],
                    )
                  }
                >
                  {t('classes.export.pdf', 'Xuất PDF')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : undefined
        }
      />

      {perms !== undefined && !allowed ? (
        <p className="text-sm text-destructive">{t('common.contactAdmin')}</p>
      ) : (
        <>
          <ul
            aria-label={t('reports.catechistAttendance.legend.title')}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground"
          >
            {LEGEND.map((cell) => {
              const { icon: Icon, color } = CELL_STYLE[cell]
              return (
                <li key={cell} className="flex items-center gap-1.5">
                  <Icon className="size-4" style={{ color }} aria-hidden />
                  {t(
                    cell === 'unrecorded'
                      ? 'reports.catechistAttendance.legend.unrecorded'
                      : `attendance.status.${cell}`,
                  )}
                </li>
              )
            })}
            <li className="flex items-center gap-1.5">
              <span
                className="size-4 rounded-sm border border-dashed"
                aria-hidden
              />
              {t('reports.catechistAttendance.legend.none')}
            </li>
          </ul>
          <div className="bg-card border rounded-xl p-4 flex flex-col gap-4">
            {report?.truncated && (
              <Alert>
                <AlertDescription>
                  {t('reports.catechistAttendance.truncated')}
                </AlertDescription>
              </Alert>
            )}
            {report === undefined ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="h-10 bg-slate-850 animate-pulse rounded-lg"
                  />
                ))}
              </div>
            ) : (
              <DataTable
                columns={columns}
                data={rows}
                getRowId={(r) => r.catechistId}
                emptyText={t('reports.catechistAttendance.empty')}
                searchColumnKey="fullName"
                searchPlaceholder={t('catechistAttendance.search')}
                filterExtra={
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                      {t('reports.catechistAttendance.filters.branch')}
                    </span>
                    <Select
                      value={effectiveBranch}
                      onValueChange={(val) => val && setBranch(val)}
                      items={branchItems}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {branchItems.map((b) => (
                          <SelectItem key={b.value} value={b.value}>
                            {b.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                      {t('reports.catechistAttendance.filters.type')}
                    </span>
                    <Select
                      value={kind}
                      onValueChange={(val) => val && setKind(val)}
                      items={kindItems}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {kindItems.map((k) => (
                          <SelectItem key={k.value} value={k.value}>
                            {k.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                      {t('reports.catechistAttendance.filters.dateRange')}
                    </span>
                    <div className="w-40">
                      <DateInput
                        value={from}
                        onChange={(d) => setRange({ from: d, to })}
                      />
                    </div>
                    <span className="text-muted-foreground">–</span>
                    <div className="w-40">
                      <DateInput
                        value={to}
                        onChange={(d) => setRange({ from, to: d })}
                      />
                    </div>
                  </div>
                }
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}
