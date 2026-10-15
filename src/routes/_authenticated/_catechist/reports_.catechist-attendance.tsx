import * as React from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
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
import { formatPersonName } from '~/lib/name'
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

const ALL = 'all'

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
    requesterId && selectedYearId && allowed
      ? {
          requesterId,
          academicYearId: selectedYearId,
          branchId:
            effectiveBranch === ALL
              ? undefined
              : (effectiveBranch as Id<'branches'>),
        }
      : 'skip',
  )

  const columns = React.useMemo<Array<TableColumnDef<Row>>>(() => {
    const base: Array<TableColumnDef<Row>> = [
      {
        id: 'fullName',
        accessorFn: (r) => formatPersonName(r.saintName, r.fullName),
        header: t('reports.catechistAttendance.col.catechist'),
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
    const targetCols = (report?.targets ?? []).map(
      (target, i): TableColumnDef<Row> => ({
        id: target.id,
        enableSorting: false,
        header: () => (
          <span title={target.label} className="whitespace-nowrap text-xs">
            {target.date.slice(5)}
            <br />
            {target.kind === 'meeting'
              ? t('reports.catechistAttendance.meetingShort')
              : target.label}
          </span>
        ),
        cell: ({ row }) => {
          const cell = row.original.cells[i]
          if (!cell) return null
          const { icon: Icon, color } = CELL_STYLE[cell]
          return (
            <Icon
              className="size-4"
              style={{ color }}
              aria-label={t(
                cell === 'unrecorded'
                  ? 'attendance.status.unset'
                  : `attendance.status.${cell}`,
              )}
            />
          )
        },
      }),
    )
    return [...base, ...targetCols]
  }, [report?.targets, t])

  const csvHeaders = React.useMemo(
    () => [
      t('reports.catechistAttendance.col.catechist'),
      ...(report?.targets ?? []).map((x) => `${x.date} ${x.label}`),
      t('reports.catechistAttendance.col.rate'),
    ],
    [report?.targets, t],
  )
  const csvRows = React.useMemo<Array<Record<string, CellValue>>>(
    () =>
      (report?.rows ?? []).map((r) => {
        const out: Record<string, CellValue> = {
          [csvHeaders[0]]: formatPersonName(r.saintName, r.fullName),
        }
        r.cells.forEach((c, i) => {
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
    [report?.rows, csvHeaders, t],
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
      (report?.rows ?? []).map((r) => ({
        [pdfHeaders[0]]: formatPersonName(r.saintName, r.fullName),
        [pdfHeaders[1]]: r.totals.present,
        [pdfHeaders[2]]: r.totals.late,
        [pdfHeaders[3]]: r.totals.excused,
        [pdfHeaders[4]]: r.totals.unexcused,
        [pdfHeaders[5]]: pct(r.totals.rate),
      })),
    [report?.rows, pdfHeaders],
  )

  const branchItems = [
    ...(wholeYear
      ? [{ value: ALL, label: t('reports.catechistAttendance.allBranches') }]
      : []),
    ...branchOptions.map((b) => ({ value: b._id, label: b.name })),
  ]

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
                      {},
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
              data={report.rows}
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
                </div>
              }
            />
          )}
        </div>
      )}
    </div>
  )
}
