import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { GraduationCap } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useAuth } from '~/lib/auth'
import { PageHeader } from '~/components/page-header'
import { ClassForm } from '~/components/forms/class-form'

export const Route = createFileRoute('/_authenticated/classes_/$id_/edit')({
  component: EditClassPage,
  staticData: { crumb: 'classes.edit.title' },
})

function EditClassPage() {
  const { id } = useParams({ strict: false })
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const requesterId = user?.userDocId as Id<'catechists'> | undefined

  const branches = useQuery(api.branches.list)
  const cls = useQuery(api.classes.get, { id: id as Id<'classes'> })
  const createClassMutation = useMutation(api.classes.create)
  const updateClassMutation = useMutation(api.classes.update)

  if (!requesterId) {
    return null
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={GraduationCap}
        title={t('classes.edit.title')}
        subtitle={t('classes.edit.subtitle')}
      />

      <div className="bg-card border rounded-xl p-4 sm:p-6">
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
            initialValues={cls}
            requesterId={requesterId}
            branches={branches}
            createMutation={createClassMutation}
            updateMutation={updateClassMutation}
            onSuccess={() => navigate({ to: '/classes' })}
            onCancel={() => navigate({ to: '/classes' })}
          />
        )}
      </div>
    </div>
  )
}
