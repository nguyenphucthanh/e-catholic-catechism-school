import { format, subDays } from 'date-fns'
import type { Id } from '../../../convex/_generated/dataModel'
import { useSelectedAcademicYear } from '~/lib/academic-year'
import { MyClassesWidget } from '~/components/custom/my-classes-widget'
import { TodayThisWeekWidget } from '~/components/custom/today-this-week-widget'
import { AttendanceHealthWidget } from '~/components/custom/attendance-health-widget'
import { GradingProgressWidget } from '~/components/custom/grading-progress-widget'

const DATE_FORMAT = 'yyyy-MM-dd'

export function CatechistDashboard({
  catechistId,
}: {
  catechistId: Id<'catechists'>
}) {
  const { selectedYearId } = useSelectedAcademicYear()
  const dateTo = format(new Date(), DATE_FORMAT)
  const dateFrom = format(subDays(new Date(), 27), DATE_FORMAT)

  return (
    <div className="grid gap-4">
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
    </div>
  )
}
