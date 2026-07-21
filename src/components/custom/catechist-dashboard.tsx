import { format, subDays } from 'date-fns'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useSelectedAcademicYear } from '~/lib/academic-year'
import { MyClassesWidget } from '~/components/custom/my-classes-widget'
import { TodayThisWeekWidget } from '~/components/custom/today-this-week-widget'
import { UpcomingEventsWidget } from '~/components/custom/upcoming-events-widget'
import { AttendanceHealthWidget } from '~/components/custom/attendance-health-widget'
import { GradingProgressWidget } from '~/components/custom/grading-progress-widget'
import { StudentsNeedingFollowupWidget } from '~/components/custom/students-needing-followup-widget'
import { OrgStatsWidget } from '~/components/custom/org-stats-widget'
import { BranchStatsWidget } from '~/components/custom/branch-stats-widget'

const DATE_FORMAT = 'yyyy-MM-dd'

export function CatechistDashboard({
  catechistId,
}: {
  catechistId: Id<'catechists'>
}) {
  const { selectedYearId } = useSelectedAcademicYear()
  const dateTo = format(new Date(), DATE_FORMAT)
  const dateFrom = format(subDays(new Date(), 27), DATE_FORMAT)

  const permissions = useQuery(
    api.catechistPermissions.getPermissions,
    selectedYearId
      ? { requesterId: catechistId, academicYearId: selectedYearId }
      : 'skip',
  )

  const showOrgStats =
    selectedYearId &&
    permissions &&
    (permissions.isAdmin || permissions.isBoardMember)
  const showBranchStats =
    selectedYearId &&
    permissions &&
    (permissions.isAdmin ||
      permissions.isBoardMember ||
      permissions.branchHeadOf.length > 0)

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-1 md:grid-cols-3 md:grid-rows-2 gap-4">
        <div className="md:row-span-3">
          <UpcomingEventsWidget
            requesterId={catechistId}
            academicYearId={selectedYearId}
          />
        </div>
        <MyClassesWidget
          requesterId={catechistId}
          academicYearId={selectedYearId}
        />
        <TodayThisWeekWidget
          requesterId={catechistId}
          academicYearId={selectedYearId}
        />
        <AttendanceHealthWidget
          requesterId={catechistId}
          academicYearId={selectedYearId}
          dateFrom={dateFrom}
          dateTo={dateTo}
        />
        <GradingProgressWidget
          requesterId={catechistId}
          academicYearId={selectedYearId}
        />
        <div className="md:col-span-2 md:col-start-2">
          <StudentsNeedingFollowupWidget
            requesterId={catechistId}
            academicYearId={selectedYearId}
          />
        </div>
        {showOrgStats && selectedYearId && (
          <div className="md:col-span-3">
            <OrgStatsWidget
              requesterId={catechistId}
              academicYearId={selectedYearId}
            />
          </div>
        )}
        {showBranchStats && selectedYearId && (
          <div className="md:col-span-3">
            <BranchStatsWidget
              requesterId={catechistId}
              academicYearId={selectedYearId}
            />
          </div>
        )}
      </div>
    </div>
  )
}
