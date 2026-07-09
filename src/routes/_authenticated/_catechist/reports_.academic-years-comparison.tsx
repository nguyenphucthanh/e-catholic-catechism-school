import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { CalendarRange } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from 'recharts'

import type { Id } from '~/../convex/_generated/dataModel'
import type { ChartConfig } from '~/components/ui/chart'
import { api } from '~/../convex/_generated/api'
import { useAuth } from '~/lib/auth'
import { PageHeader } from '~/components/page-header'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '~/components/ui/chart'

// ─── Route Definition ────────────────────────────────────────────────────────

export const Route = createFileRoute(
  '/_authenticated/_catechist/reports_/academic-years-comparison',
)({
  component: AcademicYearsComparisonReportPage,
  staticData: { crumb: 'reports.academicYearsComparison.title' },
})

// ─── Chart configs ───────────────────────────────────────────────────────────

const enrollmentConfig = {
  totalActive: { label: 'Total', color: 'var(--chart-1)' },
} satisfies ChartConfig

const attendanceConfig = {
  massAttendanceRate: { label: 'Mass', color: 'var(--chart-1)' },
  classAttendanceRate: { label: 'Class', color: 'var(--chart-2)' },
  extracurricularAttendanceRate: {
    label: 'Extracurricular',
    color: 'var(--chart-3)',
  },
} satisfies ChartConfig

const gradesConfig = {
  passRate: { label: 'Pass rate (%)', color: 'var(--chart-1)' },
  averageScore: { label: 'Avg score', color: 'var(--chart-2)' },
} satisfies ChartConfig

const staffingConfig = {
  catechistCount: { label: 'Catechists', color: 'var(--chart-1)' },
  classCount: { label: 'Classes', color: 'var(--chart-2)' },
  branchCount: { label: 'Branches', color: 'var(--chart-3)' },
} satisfies ChartConfig

// ─── Main Component ──────────────────────────────────────────────────────────

function AcademicYearsComparisonReportPage() {
  const { t } = useTranslation()
  const { user } = useAuth()

  const requesterId =
    user?.accountType === 'catechist'
      ? (user.userDocId as Id<'catechists'>)
      : undefined

  const data = useQuery(
    api.reports.academicYearComparison,
    requesterId ? { requesterId } : 'skip',
  )

  const yearLabel = React.useCallback(
    (academicYearId: string) =>
      data?.years.find((y) => y.academicYearId === academicYearId)?.label ??
      academicYearId,
    [data?.years],
  )

  const enrollmentData = React.useMemo(
    () =>
      data?.enrollment.map((row) => ({
        ...row,
        label: yearLabel(row.academicYearId),
      })) ?? [],
    [data?.enrollment, yearLabel],
  )

  const attendanceData = React.useMemo(
    () =>
      data?.attendance.map((row) => ({
        ...row,
        label: yearLabel(row.academicYearId),
      })) ?? [],
    [data?.attendance, yearLabel],
  )

  const gradesData = React.useMemo(
    () =>
      data?.grades.map((row) => ({
        ...row,
        label: yearLabel(row.academicYearId),
      })) ?? [],
    [data?.grades, yearLabel],
  )

  const staffingData = React.useMemo(
    () =>
      data?.staffing.map((row) => ({
        ...row,
        label: yearLabel(row.academicYearId),
      })) ?? [],
    [data?.staffing, yearLabel],
  )

  const latestByClass = React.useMemo(
    () => data?.enrollment[data.enrollment.length - 1]?.byClass ?? [],
    [data?.enrollment],
  )

  return (
    <div className="flex-1 flex flex-col gap-6">
      <PageHeader
        title={t('reports.academicYearsComparison.title')}
        subtitle={t('reports.academicYearsComparison.description')}
        icon={CalendarRange}
      />

      {data === undefined ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-64 bg-slate-850 animate-pulse rounded-xl"
            />
          ))}
        </div>
      ) : data.years.length === 0 ? (
        <div className="bg-card border rounded-xl p-8 text-center text-muted-foreground">
          {t('reports.academicYearsComparison.empty')}
        </div>
      ) : (
        <>
          {/* Enrollment */}
          <Card>
            <CardHeader>
              <CardTitle>
                {t('reports.academicYearsComparison.enrollment.title')}
              </CardTitle>
              <CardDescription>
                {t('reports.academicYearsComparison.enrollment.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-2">
              <ChartContainer config={enrollmentConfig}>
                <LineChart data={enrollmentData}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} width={32} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    dataKey="totalActive"
                    type="monotone"
                    stroke="var(--color-totalActive)"
                    strokeWidth={2}
                    dot
                  />
                </LineChart>
              </ChartContainer>
              <ChartContainer config={enrollmentConfig}>
                <BarChart
                  data={latestByClass}
                  layout="vertical"
                  margin={{ left: 12 }}
                >
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} />
                  <YAxis
                    dataKey="className"
                    type="category"
                    tickLine={false}
                    axisLine={false}
                    width={100}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey="count"
                    fill="var(--color-totalActive)"
                    radius={4}
                  />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Attendance */}
          <Card>
            <CardHeader>
              <CardTitle>
                {t('reports.academicYearsComparison.attendance.title')}
              </CardTitle>
              <CardDescription>
                {t('reports.academicYearsComparison.attendance.description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={attendanceConfig}>
                <LineChart data={attendanceData}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={40}
                    domain={[0, 100]}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    dataKey="massAttendanceRate"
                    type="monotone"
                    stroke="var(--color-massAttendanceRate)"
                    strokeWidth={2}
                    dot
                    connectNulls
                  />
                  <Line
                    dataKey="classAttendanceRate"
                    type="monotone"
                    stroke="var(--color-classAttendanceRate)"
                    strokeWidth={2}
                    dot
                    connectNulls
                  />
                  <Line
                    dataKey="extracurricularAttendanceRate"
                    type="monotone"
                    stroke="var(--color-extracurricularAttendanceRate)"
                    strokeWidth={2}
                    dot
                    connectNulls
                  />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Grades */}
          <Card>
            <CardHeader>
              <CardTitle>
                {t('reports.academicYearsComparison.grades.title')}
              </CardTitle>
              <CardDescription>
                {t('reports.academicYearsComparison.grades.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-2">
              <ChartContainer config={gradesConfig}>
                <LineChart data={gradesData}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={40}
                    domain={[0, 100]}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    dataKey="passRate"
                    type="monotone"
                    stroke="var(--color-passRate)"
                    strokeWidth={2}
                    dot
                    connectNulls
                  />
                </LineChart>
              </ChartContainer>
              <ChartContainer config={gradesConfig}>
                <BarChart data={gradesData}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} width={32} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey="averageScore"
                    fill="var(--color-averageScore)"
                    radius={4}
                  />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Staffing */}
          <Card>
            <CardHeader>
              <CardTitle>
                {t('reports.academicYearsComparison.staffing.title')}
              </CardTitle>
              <CardDescription>
                {t('reports.academicYearsComparison.staffing.description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={staffingConfig}>
                <BarChart data={staffingData}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} width={32} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey="catechistCount"
                    fill="var(--color-catechistCount)"
                    radius={4}
                  />
                  <Bar
                    dataKey="classCount"
                    fill="var(--color-classCount)"
                    radius={4}
                  />
                  <Bar
                    dataKey="branchCount"
                    fill="var(--color-branchCount)"
                    radius={4}
                  />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
