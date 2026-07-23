import {
  Navigate,
  createFileRoute,
  useNavigate,
  useParams,
} from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { BookOpen } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { useAuth } from '~/lib/auth'
import { translateConvexError } from '~/lib/convex-errors'
import { PageHeader } from '~/components/page-header'
import { ExtracurricularProgramForm } from '~/components/extracurricular/program-form'
import { useManagementPermission } from '~/hooks/use-management-permission'

export const Route = createFileRoute(
  '/_authenticated/_catechist/extracurricular-programs_/$id_/edit',
)({
  component: EditExtracurricularProgramPage,
  staticData: {
    crumbs: [
      { label: 'extracurricular.title', path: '/extracurricular-programs' },
      { label: 'common.edit' },
    ],
  },
})

function EditExtracurricularProgramPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { canManage, isLoading } = useManagementPermission()
  const { id } = useParams({
    from: '/_authenticated/_catechist/extracurricular-programs_/$id_/edit',
  })
  const navigate = useNavigate()

  const requesterId = user?.userDocId as Id<'catechists'> | undefined

  const program = useQuery(
    api.extracurricularPrograms.getProgramDetail,
    requesterId
      ? {
          programId: id as Id<'extracurricularPrograms'>,
          requesterId,
        }
      : 'skip',
  )

  const branches = useQuery(
    api.branches.list,
    requesterId ? { requesterId } : 'skip',
  )
  const updateProgram = useMutation(api.extracurricularPrograms.updateProgram)

  if (isLoading) return null
  if (!canManage) return <Navigate to="/dashboard" />

  const handleSubmit = async (data: {
    title: string
    details: string
    target: 'catechist' | 'student' | 'all'
    branches: Array<Id<'branches'>>
    dateStart: string
    dateEnd: string
    enrollmentExpireDate: string
    feeRequired: boolean
    feeAmount?: number
    maxCapacity?: number
  }) => {
    if (!requesterId) return

    try {
      await updateProgram({
        programId: id as Id<'extracurricularPrograms'>,
        requesterId,
        title: data.title,
        details: data.details,
        target: data.target,
        branches: data.branches,
        dateStart: data.dateStart,
        dateEnd: data.dateEnd,
        enrollmentExpireDate: data.enrollmentExpireDate,
        feeRequired: data.feeRequired,
        feeAmount: data.feeAmount,
        maxCapacity: data.maxCapacity,
      })
      toast.success(t('common.updated'))
      navigate({
        to: '/extracurricular-programs/$id',
        params: { id: id },
      })
    } catch (error) {
      toast.error(translateConvexError(error, t))
    }
  }

  if (!program || !branches) {
    return <div>{t('common.loading')}</div>
  }

  return (
    <div className="space-y-4">
      <PageHeader icon={BookOpen} title={t('extracurricular.edit')} />

      <ExtracurricularProgramForm
        onSubmit={handleSubmit}
        branches={branches}
        initialData={{
          title: program.title,
          details: program.details,
          target: program.target,
          branches: program.branches,
          dateStart: program.dateStart,
          dateEnd: program.dateEnd,
          enrollmentExpireDate: program.enrollmentExpireDate,
          feeRequired: program.feeRequired,
          feeAmount: program.feeAmount,
          maxCapacity: program.maxCapacity,
        }}
      />
    </div>
  )
}
