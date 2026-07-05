import type { Id } from '../../../convex/_generated/dataModel'
import { useSelectedAcademicYear } from '~/lib/academic-year'
import { MyClassesWidget } from '~/components/custom/my-classes-widget'

export function CatechistDashboard({
  catechistId,
}: {
  catechistId: Id<'catechists'>
}) {
  const { selectedYearId } = useSelectedAcademicYear()

  return (
    <div className="grid gap-4">
      <MyClassesWidget
        requesterId={catechistId}
        academicYearId={selectedYearId}
      />
    </div>
  )
}
