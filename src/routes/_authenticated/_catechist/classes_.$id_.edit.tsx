import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { GraduationCap } from 'lucide-react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { useAuth } from '~/lib/auth'
import { useSelectedAcademicYear } from '~/lib/academic-year'
import { isAdmin } from '~/lib/permissions'
import { PageHeader } from '~/components/page-header'
import { ClassForm } from '~/components/forms/class-form'

export const Route = createFileRoute(
  '/_authenticated/_catechist/classes_/$id_/edit',
)({
  component: EditClassPage,
  staticData: {
    crumbs: [
      { label: 'classes.title', path: '/classes' },
      { label: 'classes.edit.title' },
    ],
  },
})

function EditClassPage() {
  const { id } = useParams({ strict: false })
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const canManage = isAdmin(user)
  const requesterId = user!.userDocId as Id<'catechists'>
  const { selectedYearId } = useSelectedAcademicYear()

  const branches = useQuery(
    api.branches.list,
    requesterId ? { requesterId } : 'skip',
  )
  const cls = useQuery(
    api.classes.get,
    requesterId ? { requesterId, id: id as Id<'classes'> } : 'skip',
  )
  const classesForYear = useQuery(
    api.classes.list,
    requesterId && selectedYearId
      ? { requesterId, academicYearId: selectedYearId }
      : 'skip',
  )
  const classYears = useQuery(
    api.classes.listClassYears,
    requesterId && selectedYearId
      ? { requesterId, academicYearId: selectedYearId }
      : 'skip',
  )
  const currentClassInfo = classesForYear?.find((c) => c._id === id)
  const currentClassYearId = classYears?.find(
    (cy) => cy.classId === id,
  )?.classYearId
  const createClassMutation = useMutation(api.classes.create)
  const updateClassMutation = useMutation(api.classes.update)
  const updateClassYearMutation = useMutation(api.classes.updateClassYear)

  if (!canManage || !requesterId) {
    return (
      <div className="p-4 text-destructive flex items-center justify-center h-full">
        {t('common.contactAdmin')}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={GraduationCap}
        title={t('classes.edit.title')}
        subtitle={t('classes.edit.subtitle')}
      />

      <div className="bg-card border rounded-xl p-4">
        {cls === undefined || branches === undefined ? (
          <div className="space-y-4">
            <div className="h-10 bg-muted animate-pulse rounded-lg" />
            <div className="h-10 bg-muted animate-pulse rounded-lg" />
            <div className="h-10 bg-muted animate-pulse rounded-lg" />
          </div>
        ) : cls === null ? (
          <div className="text-destructive text-center py-10">
            Class not found
          </div>
        ) : (
          <ClassForm
            classId={cls._id}
            classYearId={currentClassYearId}
            initialValues={{ ...cls, classType: currentClassInfo?.classType }}
            requesterId={requesterId}
            branches={branches}
            createMutation={createClassMutation}
            updateMutation={updateClassMutation}
            updateClassYearMutation={updateClassYearMutation}
            onSuccess={() => navigate({ to: '/classes' })}
            onCancel={() => navigate({ to: '/classes' })}
          />
        )}
      </div>
    </div>
  )
}
