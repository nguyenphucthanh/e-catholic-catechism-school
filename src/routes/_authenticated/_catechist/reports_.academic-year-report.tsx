import * as React from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useConvex } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  AlertTriangle,
  ClipboardList,
  Printer,
  RefreshCw,
  School,
  UserCheck,
  Users,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts'
import type { FunctionReturnType } from 'convex/server'
import type { Id } from '~/../convex/_generated/dataModel'

import type { ChartConfig } from '~/components/ui/chart'
import { api } from '~/../convex/_generated/api'
import { useSelectedAcademicYear } from '~/lib/academic-year'
import { PageHeader } from '~/components/page-header'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '~/components/ui/chart'

// ─── Route Definition ────────────────────────────────────────────────────────

export const Route = createFileRoute(
  '/_authenticated/_catechist/reports_/academic-year-report',
)({
  component: AcademicYearReportPage,
  staticData: {
    crumbs: [
      { label: 'nav.reports' },
      { label: 'reports.academicYearReport.title' },
    ],
  },
})

// ─── Chart Configs ──────────────────────────────────────────────────────────

const comparisonConfig = {
  studentCount: { label: 'Sĩ số', color: 'var(--chart-1)' },
} satisfies ChartConfig

const sparklineConfig = {
  rate: { label: 'Chuyên cần', color: 'var(--chart-1)' },
} satisfies ChartConfig

// ─── Main Component ──────────────────────────────────────────────────────────

function AcademicYearReportPage() {
  const { t } = useTranslation()
  const { selectedYearId } = useSelectedAcademicYear()

  const [selectedClassType, setSelectedClassType] = React.useState<
    'all' | 'primary' | 'supplemental'
  >('all')

  // One-shot fetch (not useQuery): a live subscription would re-scan the whole
  // year's attendance on every attendance save. User refreshes manually.
  const convex = useConvex()
  const [data, setData] = React.useState<
    FunctionReturnType<typeof api.reports.academicYearReport> | undefined
  >(undefined)
  type BranchReport = NonNullable<
    FunctionReturnType<typeof api.reports.academicYearBranchReport>
  >
  // 'none' = nothing loaded (default), 'all' = every branch, else a branch id
  const [selectedBranch, setSelectedBranch] = React.useState<string>('none')
  const [branchData, setBranchData] = React.useState<Array<BranchReport>>([])
  const [isBranchLoading, setIsBranchLoading] = React.useState(false)
  const [updatedAt, setUpdatedAt] = React.useState<Date | null>(null)
  const [refreshTick, setRefreshTick] = React.useState(0)
  const [isRefreshing, setIsRefreshing] = React.useState(false)

  React.useEffect(() => {
    if (!selectedYearId) return
    let cancelled = false
    setIsRefreshing(true)
    convex
      .query(api.reports.academicYearReport, { academicYearId: selectedYearId })
      .then((result) => {
        if (cancelled) return
        setData(result)
        setUpdatedAt(new Date())
      })
      .catch((err: unknown) => {
        if (!cancelled) toast.error(String(err))
      })
      .finally(() => {
        if (!cancelled) setIsRefreshing(false)
      })
    return () => {
      cancelled = true
    }
  }, [convex, selectedYearId, refreshTick])

  // Attendance is heavy: fetched per branch on demand. 'all' fans out one call
  // per branch so each stays under Convex's per-function read limit.
  React.useEffect(() => {
    if (!data || !selectedYearId || selectedBranch === 'none') {
      setBranchData([])
      return
    }
    const branchIds =
      selectedBranch === 'all'
        ? data.branches.map((b) => b.branchId)
        : [selectedBranch as Id<'branches'>]
    let cancelled = false
    setIsBranchLoading(true)
    Promise.all(
      branchIds.map((branchId) =>
        convex.query(api.reports.academicYearBranchReport, {
          academicYearId: selectedYearId,
          branchId,
        }),
      ),
    )
      .then((results) => {
        if (cancelled) return
        setBranchData(results.filter((r): r is BranchReport => r !== null))
      })
      .catch((err: unknown) => {
        if (!cancelled) toast.error(String(err))
      })
      .finally(() => {
        if (!cancelled) setIsBranchLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [convex, data, selectedYearId, selectedBranch])

  // Filter comparison chart classes based on dropdown selection
  const filteredComparisonData = React.useMemo(() => {
    if (!data) return []
    return data.classesComparison.filter((c) => {
      if (selectedClassType === 'all') return true
      return c.classType === selectedClassType
    })
  }, [data, selectedClassType])

  // Filter branches and their classes based on dropdown selection
  const filteredBranches = React.useMemo(
    () =>
      branchData
        .map((branch) => ({
          ...branch,
          classes: branch.classes.filter(
            (c) =>
              selectedClassType === 'all' || c.classType === selectedClassType,
          ),
        }))
        .filter((branch) => branch.classes.length > 0),
    [branchData, selectedClassType],
  )

  const handlePrint = React.useCallback(() => {
    window.print()
  }, [])

  if (data === undefined) {
    return (
      <div className="flex-1 flex flex-col gap-6">
        <PageHeader
          title={t('reports.academicYearReport.title')}
          subtitle={t('reports.academicYearReport.description')}
          icon={ClipboardList}
        />
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 w-24 bg-slate-800 animate-pulse rounded" />
                <div className="h-4 w-4 bg-slate-800 animate-pulse rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-16 bg-slate-800 animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="h-64 bg-slate-850 animate-pulse rounded-xl" />
        <div className="h-64 bg-slate-850 animate-pulse rounded-xl" />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col gap-6 print-full-width">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          aside, header, nav, button, [data-slot="select-trigger"], .no-print {
            display: none !important;
          }
          main, .print-full-width {
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            background: transparent !important;
          }
          .print-card-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
          .print-card {
            border: 1px solid #e2e8f0 !important;
            box-shadow: none !important;
          }
        }
      `,
        }}
      />

      <PageHeader
        title={t('reports.academicYearReport.title')}
        subtitle={`${t('reports.academicYearReport.description')} — Niên khóa ${data.academicYearName}`}
        icon={ClipboardList}
        actions={
          <div className="flex items-center gap-2 no-print">
            {updatedAt && (
              <span className="text-xs text-muted-foreground">
                {t('reports.academicYearReport.lastUpdated', {
                  time: updatedAt.toLocaleTimeString(),
                })}
              </span>
            )}
            <Button
              onClick={() => setRefreshTick((n) => n + 1)}
              variant="outline"
              disabled={isRefreshing}
            >
              <RefreshCw
                className={isRefreshing ? 'size-4 animate-spin' : 'size-4'}
              />
              {t('reports.academicYearReport.refresh')}
            </Button>
            <Button onClick={handlePrint} variant="outline">
              <Printer className="size-4" />
              {t('reports.academicYearReport.print')}
            </Button>
          </div>
        }
      />

      {/* ─── KPI Cards ─── */}
      <div className="grid gap-4 sm:grid-cols-3 no-print">
        <Card className="print-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('reports.academicYearReport.kpi.totalClasses')}
            </CardTitle>
            <School className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.kpis.totalClasses}</div>
          </CardContent>
        </Card>

        <Card className="print-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('reports.academicYearReport.kpi.totalStudents')}
            </CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.kpis.totalStudents}</div>
          </CardContent>
        </Card>

        <Card className="print-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('reports.academicYearReport.kpi.activeCatechists')}
            </CardTitle>
            <UserCheck className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.kpis.activeCatechists}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Controls & Filters Row ─── */}
      <div className="flex items-center gap-4 no-print bg-card border rounded-xl p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
            {t('reports.academicYearReport.filters.classType')}
          </span>
          <Select
            value={selectedClassType}
            onValueChange={(val) => setSelectedClassType(val as any)}
            items={[
              {
                value: 'all',
                label: t('reports.academicYearReport.filters.all'),
              },
              {
                value: 'primary',
                label: t('reports.academicYearReport.filters.primary'),
              },
              {
                value: 'supplemental',
                label: t('reports.academicYearReport.filters.supplemental'),
              },
            ]}
          >
            <SelectTrigger className="w-45">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t('reports.academicYearReport.filters.all')}
              </SelectItem>
              <SelectItem value="primary">
                {t('reports.academicYearReport.filters.primary')}
              </SelectItem>
              <SelectItem value="supplemental">
                {t('reports.academicYearReport.filters.supplemental')}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredComparisonData.length === 0 ? (
        <div className="bg-card border rounded-xl p-8 text-center text-muted-foreground">
          {t('reports.academicYearReport.empty')}
        </div>
      ) : (
        <>
          {/* ─── Sĩ Số Chart Card ─── */}
          <Card className="print-card">
            <CardHeader>
              <CardTitle>
                {t('reports.academicYearReport.charts.studentCount')}
              </CardTitle>
              <CardDescription>
                {t('reports.academicYearReport.charts.studentCountDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={comparisonConfig} className="h-72 w-full">
                <BarChart data={filteredComparisonData} margin={{ bottom: 24 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="className"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <YAxis tickLine={false} axisLine={false} width={32} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey="studentCount"
                    fill="var(--color-studentCount)"
                    radius={4}
                  />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </>
      )}

      {/* ─── Branch selector (loads attendance on demand) ─── */}
      <div className="flex items-center gap-2 no-print bg-card border rounded-xl p-4">
        <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
          {t('reports.academicYearReport.filters.branch')}
        </span>
        <Select
          value={selectedBranch}
          onValueChange={(val) => setSelectedBranch(val as string)}
          items={[
            {
              value: 'none',
              label: t('reports.academicYearReport.filters.branchNone'),
            },
            {
              value: 'all',
              label: t('reports.academicYearReport.filters.branchAll'),
            },
            ...data.branches.map((b) => ({
              value: b.branchId,
              label: b.branchName,
            })),
          ]}
        >
          <SelectTrigger className="w-60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">
              {t('reports.academicYearReport.filters.branchNone')}
            </SelectItem>
            {data.branches.map((b) => (
              <SelectItem key={b.branchId} value={b.branchId}>
                {b.branchName}
              </SelectItem>
            ))}
            <SelectItem value="all">
              {t('reports.academicYearReport.filters.branchAll')}
            </SelectItem>
          </SelectContent>
        </Select>
        {isBranchLoading && (
          <RefreshCw className="size-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {selectedBranch === 'none' && (
        <div className="bg-card border rounded-xl p-8 text-center text-muted-foreground no-print">
          {t('reports.academicYearReport.selectBranchPrompt')}
        </div>
      )}

      {/* ─── Branch Groups & Class Mini Sparklines ─── */}
      <div className="flex flex-col gap-6">
        {filteredBranches.map((branch) => (
          <div key={branch.branchId} className="flex flex-col gap-4">
            <h3 className="text-lg font-bold border-b pb-2">
              {branch.branchName}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 print-card-grid">
              {branch.classes.map((cls) => {
                const isLowAttendance =
                  cls.overallAttendanceRate !== null &&
                  cls.overallAttendanceRate < 80

                return (
                  <Card
                    key={cls.classYearId}
                    className="print-card flex flex-col justify-between"
                  >
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-base font-semibold">
                          <Link
                            to="/classes/$id"
                            params={{ id: cls.classId }}
                            className="text-primary hover:underline"
                          >
                            {cls.className}
                          </Link>
                        </CardTitle>
                        {isLowAttendance && (
                          <Badge variant="destructive">
                            <AlertTriangle className="size-3 mr-1" />
                            {t(
                              'reports.academicYearReport.classes.lowAttendance',
                            )}
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="flex items-center gap-1.5 flex-wrap">
                        <span>
                          {t('reports.academicYearReport.classes.students', {
                            count: cls.studentCount,
                          })}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {t(
                            'reports.academicYearReport.classes.sessionsCounted',
                            {
                              count: cls.sessionCount,
                            },
                          )}
                        </span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex justify-between items-baseline mb-2">
                        <span className="text-xs text-muted-foreground">
                          {t(
                            'reports.academicYearReport.kpi.averageAttendanceRate',
                          )}
                        </span>
                        <span className="text-lg font-bold">
                          {cls.overallAttendanceRate !== null
                            ? `${cls.overallAttendanceRate}%`
                            : '—'}
                        </span>
                      </div>

                      {cls.attendanceHistory.length > 0 && (
                        <ChartContainer
                          config={sparklineConfig}
                          className="h-10 w-full"
                        >
                          <AreaChart
                            data={cls.attendanceHistory}
                            margin={{
                              top: 0,
                              bottom: 0,
                              left: 0,
                              right: 0,
                            }}
                          >
                            <defs>
                              <linearGradient
                                id={`grad-${cls.classYearId}`}
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                              >
                                <stop
                                  offset="5%"
                                  stopColor="var(--color-rate)"
                                  stopOpacity={0.2}
                                />
                                <stop
                                  offset="95%"
                                  stopColor="var(--color-rate)"
                                  stopOpacity={0}
                                />
                              </linearGradient>
                            </defs>
                            <Area
                              type="monotone"
                              dataKey="rate"
                              stroke="var(--color-rate)"
                              fill={`url(#grad-${cls.classYearId})`}
                              strokeWidth={1.5}
                              dot={false}
                              connectNulls
                            />
                            <ChartTooltip
                              content={<ChartTooltipContent hideLabel />}
                            />
                          </AreaChart>
                        </ChartContainer>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
