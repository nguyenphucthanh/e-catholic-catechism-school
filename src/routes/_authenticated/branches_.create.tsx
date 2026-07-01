import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { Network } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useAuth } from '~/lib/auth'
import { PageHeader } from '~/components/page-header'
import { BranchForm } from '~/components/forms/branch-form'

export const Route = createFileRoute('/_authenticated/branches_/create')({
  component: CreateBranchPage,
  staticData: {
    crumbs: [
      { label: 'branches.title', path: '/branches' },
      { label: 'branches.create.title' },
    ],
  },
})

function CreateBranchPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const requesterId = user?.userDocId as Id<'catechists'> | undefined

  const createBranchMutation = useMutation(api.branches.create)
  const updateBranchMutation = useMutation(api.branches.update)

  if (!requesterId) {
    return null
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Network}
        title={t('branches.create.title')}
        subtitle={t('branches.create.subtitle')}
      />

      <div className="bg-card border rounded-xl p-4 sm:p-6">
        <BranchForm
          requesterId={requesterId}
          createMutation={createBranchMutation}
          updateMutation={updateBranchMutation}
          onSuccess={() => navigate({ to: '/branches' })}
          onCancel={() => navigate({ to: '/branches' })}
        />
      </div>
    </div>
  )
}
