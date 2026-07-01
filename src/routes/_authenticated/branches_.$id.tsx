import { createFileRoute, useParams } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { Network } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { PageHeader } from '~/components/page-header'

export const Route = createFileRoute('/_authenticated/branches_/$id')({
  component: BranchDetailPage,
  staticData: {
    crumbs: [
      { label: 'branches.title', path: '/branches' },
      { label: 'branches.detail.title' },
    ],
  },
})

function BranchDetailPage() {
  const { id } = useParams({ strict: false })
  const { t } = useTranslation()

  const branch = useQuery(api.branches.get, { id: id as Id<'branches'> })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Network}
        title={branch?.name ?? t('branches.detail.title')}
      />

      <div className="bg-card border rounded-xl p-4 sm:p-6">
        {/* TODO: Add detail content */}
      </div>
    </div>
  )
}
