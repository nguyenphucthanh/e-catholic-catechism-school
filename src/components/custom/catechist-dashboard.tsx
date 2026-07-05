import type { Id } from '../../../convex/_generated/dataModel'
import { useSelectedAcademicYear } from '~/lib/academic-year'
import { MyClassesWidget } from '~/components/custom/my-classes-widget'
import { TodayThisWeekWidget } from '~/components/custom/today-this-week-widget'

export function CatechistDashboard({
  catechistId,
}: {
  catechistId: Id<'catechists'>
}) {
  const { selectedYearId } = useSelectedAcademicYear()

  return (
    <div className="grid gap-4">
      <TodayThisWeekWidget
        requesterId={catechistId}
        academicYearId={selectedYearId}
      />
      <MyClassesWidget
        requesterId={catechistId}
        academicYearId={selectedYearId}
      />
    </div>
  )
}
