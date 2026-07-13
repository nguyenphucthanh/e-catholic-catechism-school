import * as React from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import {
  ClipboardList,
  Users,
  School,
  Award,
  UserCheck,
  Printer,
  AlertTriangle,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Area,
  AreaChart,
} from 'recharts'

import type { Id } from '~/../convex/_generated/dataModel'
import { api } from '~/../convex/_generated/api'
import { useAuth } from '~/lib/auth'
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
  type ChartConfig,
} from '~/components/ui/chart'

// ─── Route Definition ────────────────────────────────────────────────────────

export const Route = createFileRoute(
  '/_authenticated/_catechist/reports_/academic-year-report',
)({
  component: AcademicYearReportPage,
  staticData: { crumb: 'reports.academicYearReport.title' },
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
  const { user } = useAuth()
  const { selectedYearId } = useSelectedAcademicYear()

  const [selectedClassType, setSelectedClassType] = React.useState<
    'all' | 'primary' | 'supplemental'
  >('all')

  const requesterId =
    user?.accountType === 'catechist'
      ? (user.userDocId as Id<'catechists'>)
      : undefined

  const data = useQuery(
    api.reports.academicYearReport,
    requesterId && selectedYearId
      ? { requesterId, academicYearId: selectedYearId }
      : 'skip',
  )

  // Filter comparison chart classes based on dropdown selection
  const filteredComparisonData = React.useMemo(() => {
    if (!data) return []
    return data.classesComparison.filter((c) => {
      if (selectedClassType === 'all') return true
      return c.classType === selectedClassType
    })
  }, [data, selectedClassType])

  // Filter branches and their classes based on dropdown selection
  const filteredBranches = React.useMemo(() => {
    if (!data) return []
    return data.branches
      .map((branch) => {
        const classes = branch.classes.filter((c) => {
          if (selectedClassType === 'all') return true
          return c.classType === selectedClassType
        })
        return { ...branch, classes }
      })
      .filter((branch) => branch.classes.length > 0)
  }, [data, selectedClassType])

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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
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
          <Button onClick={handlePrint} variant="outline" className="no-print">
            <Printer className="size-4" />
            {t('reports.academicYearReport.print')}
          </Button>
        }
      />

      {/* ─── KPI Cards ─── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 no-print">
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
              {t('reports.academicYearReport.kpi.averageAttendanceRate')}
            </CardTitle>
            <Award className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.kpis.averageAttendanceRate !== null
                ? `${data.kpis.averageAttendanceRate}%`
                : '—'}
            </div>
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
            items={
              [
                {
                  value: 'all',
                  label: t('reports.academicYearReport.filters.all')
                },
                {
                  value: 'primary',
                  label: t('reports.academicYearReport.filters.primary')
                },
                {
                  value: 'supplemental',
                  label: t('reports.academicYearReport.filters.supplemental')
                }
              ]
            }
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
                {t('reports.academicYearsComparison.enrollment.description')}
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
                          <CardDescription>
                            {t('reports.academicYearReport.classes.students', {
                              count: cls.studentCount,
                            })}
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

          {/* ─── At-Risk Students ─── */}
          <Card className="print-card">
            <CardHeader>
              <CardTitle>
                {t('reports.academicYearReport.atRisk.title')}
              </CardTitle>
              <CardDescription>
                {t('reports.academicYearReport.atRisk.description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.atRiskStudents.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  {t('common.noRecords', 'Không có học viên vắng dài hạn.')}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="py-2 font-medium text-muted-foreground">
                          {t('reports.academicYearReport.atRisk.studentCode')}
                        </th>
                        <th className="py-2 font-medium text-muted-foreground">
                          {t('reports.academicYearReport.atRisk.fullName')}
                        </th>
                        <th className="py-2 font-medium text-muted-foreground">
                          {t('reports.academicYearReport.atRisk.className')}
                        </th>
                        <th className="py-2 font-medium text-muted-foreground text-center">
                          {t('reports.academicYearReport.atRisk.streak')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.atRiskStudents.map((student) => (
                        <tr
                          key={student.studentId}
                          className="border-b hover:bg-slate-900/50"
                        >
                          <td className="py-2 font-mono">
                            {student.studentCode}
                          </td>
                          <td className="py-2 font-medium text-primary hover:underline">
                            <Link
                              to="/students/$id"
                              params={{ id: student.studentId }}
                            >
                              {student.fullName}
                            </Link>
                          </td>
                          <td className="py-2">{student.className}</td>
                          <td className="py-2 text-center text-destructive font-bold">
                            {student.consecutiveAbsences}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
