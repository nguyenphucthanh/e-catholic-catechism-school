import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { Network } from 'lucide-react'
import { api } from '../../../../convex/_generated/api'
import { useAuth } from '~/lib/auth'
import { isAdmin } from '~/lib/permissions'
import { PageHeader } from '~/components/page-header'
import { BranchForm } from '~/components/forms/branch-form'

export const Route = createFileRoute(
  '/_authenticated/_catechist/branches_/create',
)({
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
  const canManage = isAdmin(user)

  const createBranchMutation = useMutation(api.branches.create)
  const updateBranchMutation = useMutation(api.branches.update)

  if (!canManage) {
    return (
      <div className="p-4 text-destructive flex items-center justify-center h-full">
        {t('common.contactAdmin')}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Network}
        title={t('branches.create.title')}
        subtitle={t('branches.create.subtitle')}
      />

      <div className="bg-card border rounded-xl p-4">
        <BranchForm
          createMutation={createBranchMutation}
          updateMutation={updateBranchMutation}
          onSuccess={() => navigate({ to: '/branches' })}
          onCancel={() => navigate({ to: '/branches' })}
        />
      </div>
    </div>
  )
}
