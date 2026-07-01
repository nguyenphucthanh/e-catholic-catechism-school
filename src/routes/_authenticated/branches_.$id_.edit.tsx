import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { Network } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useAuth } from '~/lib/auth'
import { PageHeader } from '~/components/page-header'
import { BranchForm } from '~/components/forms/branch-form'

export const Route = createFileRoute('/_authenticated/branches_/$id_/edit')({
  component: EditBranchPage,
  staticData: {
    crumbs: [
      { label: 'branches.title', path: '/branches' },
      { label: 'branches.edit.title' },
    ],
  },
})

function EditBranchPage() {
  const { id } = useParams({ strict: false })
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const requesterId = user?.userDocId as Id<'catechists'> | undefined

  const branch = useQuery(api.branches.get, { id: id as Id<'branches'> })
  const createBranchMutation = useMutation(api.branches.create)
  const updateBranchMutation = useMutation(api.branches.update)

  if (!requesterId) {
    return null
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Network}
        title={t('branches.edit.title')}
        subtitle={t('branches.edit.subtitle')}
      />

      <div className="bg-card border rounded-xl p-4 sm:p-6">
        {branch === undefined ? (
          <div className="space-y-4">
            <div className="h-10 bg-muted animate-pulse rounded-lg" />
            <div className="h-10 bg-muted animate-pulse rounded-lg" />
          </div>
        ) : branch === null ? (
          <div className="text-destructive text-center py-10">
            Branch not found
          </div>
        ) : (
          <BranchForm
            branchId={branch._id}
            initialValues={branch}
            requesterId={requesterId}
            createMutation={createBranchMutation}
            updateMutation={updateBranchMutation}
            onSuccess={() => navigate({ to: '/branches' })}
            onCancel={() => navigate({ to: '/branches' })}
          />
        )}
      </div>
    </div>
  )
}
