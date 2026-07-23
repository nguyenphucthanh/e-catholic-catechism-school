import { Navigate, createFileRoute, useNavigate } from '@tanstack/react-router'
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
  '/_authenticated/_catechist/extracurricular-programs_/create',
)({
  component: CreateExtracurricularProgramPage,
  staticData: {
    crumbs: [
      { label: 'extracurricular.title', path: '/extracurricular-programs' },
      { label: 'common.create' },
    ],
  },
})

function CreateExtracurricularProgramPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { canManage, isLoading } = useManagementPermission()

  const requesterId = user?.userDocId as Id<'catechists'> | undefined
  const branches = useQuery(
    api.branches.list,
    requesterId ? { requesterId } : 'skip',
  )
  const createProgram = useMutation(api.extracurricularPrograms.createProgram)

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
      const programId = await createProgram({
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
      toast.success(t('common.created'))
      navigate({
        to: '/extracurricular-programs/$id',
        params: { id: programId },
      })
    } catch (error) {
      toast.error(translateConvexError(error, t))
    }
  }

  if (!branches) {
    return <div>{t('common.loading')}</div>
  }

  return (
    <div className="space-y-4">
      <PageHeader icon={BookOpen} title={t('extracurricular.create')} />

      <ExtracurricularProgramForm onSubmit={handleSubmit} branches={branches} />
    </div>
  )
}
