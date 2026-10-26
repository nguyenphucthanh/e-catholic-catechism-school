import { useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { api } from '../../../convex/_generated/api'
import type { FunctionReturnType } from 'convex/server'
import type { Id } from '../../../convex/_generated/dataModel'
import { useAuth } from '~/lib/auth'
import { useSelectedAcademicYear } from '~/lib/academic-year'
import { DEFAULT_TIMEZONE } from '~/lib/locale'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import {
  ATTENDANCE_STYLE,
  StatBlock,
} from '~/components/custom/enrollment-summary'
import { Skeleton } from '~/components/ui/skeleton'

type Summary = FunctionReturnType<
  typeof api.catechistAttendance.getCatechistAttendanceSummary
>
type Rate = Summary['overall']

const STAT_CONFIG = [
  {
    status: 'present',
    key: 'present',
    label: 'students.enrollments.summary.attendance.present',
  },
  {
    status: 'late',
    key: 'late',
    label: 'students.enrollments.summary.attendance.late',
  },
  {
    status: 'excused_absence',
    key: 'excused',
    label: 'students.enrollments.summary.attendance.excusedAbsence',
  },
  {
    status: 'unexcused_absence',
    key: 'unexcused',
    label: 'students.enrollments.summary.attendance.unexcusedAbsence',
  },
] as const

function RateSection({ label, data }: { label: string; data: Rate }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-medium">
        {label}
        <span className="ml-2 tabular-nums text-muted-foreground">
          {data.rate === null ? '—' : `${Math.round(data.rate * 100)}%`}
        </span>
      </h3>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {STAT_CONFIG.map(({ status, key, label: statusLabel }) => (
          <StatBlock
            key={status}
            label={t(statusLabel)}
            value={data[key]}
            className={ATTENDANCE_STYLE[status].card}
            icon={ATTENDANCE_STYLE[status].icon}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * Attendance rate for one catechist in the selected year. Only fires the
 * query for viewers the backend allows (self, admin, board).
 */
export function DiligenceCard({
  catechistId,
}: {
  catechistId: Id<'catechists'>
}) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { selectedYearId } = useSelectedAcademicYear()
  const requesterId =
    user?.accountType === 'catechist'
      ? (user.userDocId as Id<'catechists'>)
      : undefined
  const isSelf = requesterId === catechistId

  const perms = useQuery(
    api.catechistPermissions.getPermissions,
    requesterId && selectedYearId && !isSelf
      ? { academicYearId: selectedYearId }
      : 'skip',
  )
  const canView = isSelf || !!perms?.isAdmin || !!perms?.isBoardMember

  // Query can't read the clock, so pass today in the app timezone.
  const asOfDate = new Date().toLocaleDateString('sv-SE', {
    timeZone: DEFAULT_TIMEZONE,
  })
  const summary = useQuery(
    api.catechistAttendance.getCatechistAttendanceSummary,
    requesterId && selectedYearId && canView
      ? { catechistId, academicYearId: selectedYearId, asOfDate }
      : 'skip',
  )

  if (!requesterId || !canView) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('diligence.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {summary === undefined ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        ) : summary.overall.total === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('diligence.empty')}
          </p>
        ) : (
          <div className="flex flex-col gap-5">
            <RateSection
              label={t('diligence.classTeaching')}
              data={summary.classTeaching}
            />
            <RateSection
              label={t('diligence.meetings')}
              data={summary.meeting}
            />
            <RateSection
              label={t('diligence.overall')}
              data={summary.overall}
            />
            {summary.unrecorded !== null && (
              <p className="text-sm text-muted-foreground">
                {t('diligence.unrecorded', { count: summary.unrecorded })}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
