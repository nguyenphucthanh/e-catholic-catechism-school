import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { GraduationCap } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useAuth } from '~/lib/auth'
import { PageHeader } from '~/components/page-header'
import { ClassForm } from '~/components/forms/class-form'

export const Route = createFileRoute('/_authenticated/classes_/create')({
  component: CreateClassPage,
  staticData: { crumb: 'classes.create.title' },
})

function CreateClassPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const requesterId = user?.userDocId as Id<'catechists'> | undefined

  const branches = useQuery(api.branches.list)
  const createClassMutation = useMutation(api.classes.create)
  const updateClassMutation = useMutation(api.classes.update)

  if (!requesterId) {
    return null
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader icon={GraduationCap} title={t('classes.create.title')}
        subtitle={t('classes.create.subtitle')}
      />

      <div className="bg-card border rounded-xl p-4 sm:p-6 max-w-3xl">
        {branches === undefined ? (
          <div className="space-y-4">
            <div className="h-10 bg-muted animate-pulse rounded-lg" />
            <div className="h-10 bg-muted animate-pulse rounded-lg" />
          </div>
        ) : (
          <ClassForm
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
