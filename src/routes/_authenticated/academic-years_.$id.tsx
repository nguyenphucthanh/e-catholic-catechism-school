import { createFileRoute, useParams } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { CalendarDays } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useAuth } from '~/lib/auth'
import { PageHeader } from '~/components/page-header'

export const Route = createFileRoute('/_authenticated/academic-years_/$id')({
  component: AcademicYearDetailPage,
  staticData: {
    crumbs: [
      { label: 'academicYears.title', path: '/academic-years' },
      { label: 'academicYears.detail.title' },
    ],
  },
})

function AcademicYearDetailPage() {
  const { id } = useParams({ strict: false })
  const { t } = useTranslation()
  const { user } = useAuth()
  const requesterId = user?.userDocId as Id<'catechists'> | undefined

  const year = useQuery(
    api.academicYears.get,
    requesterId ? { requesterId, id: id as Id<'academicYears'> } : 'skip',
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={CalendarDays}
        title={year?.name ?? t('academicYears.detail.title')}
      />

      <div className="bg-card border rounded-xl p-4 sm:p-6">
        {/* TODO: Add detail content */}
      </div>
    </div>
  )
}
