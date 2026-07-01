import { createFileRoute, useParams } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { GraduationCap } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { PageHeader } from '~/components/page-header'

export const Route = createFileRoute('/_authenticated/classes_/$id')({
  component: ClassDetailPage,
  staticData: {
    crumbs: [
      { label: 'classes.title', path: '/classes' },
      { label: 'classes.detail.title' },
    ],
  },
})

function ClassDetailPage() {
  const { id } = useParams({ strict: false })
  const { t } = useTranslation()

  const cls = useQuery(api.classes.get, { id: id as Id<'classes'> })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={GraduationCap}
        title={cls?.name ?? t('classes.detail.title')}
      />

      <div className="bg-card border rounded-xl p-4 sm:p-6">
        {/* TODO: Add detail content */}
      </div>
    </div>
  )
}
