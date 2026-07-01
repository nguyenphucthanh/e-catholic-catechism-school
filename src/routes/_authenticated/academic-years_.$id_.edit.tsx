import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { CalendarDays } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import { useAuth } from '~/lib/auth'
import { PageHeader } from '~/components/page-header'
import { AcademicYearForm } from '~/components/forms/academic-year-form'
import type { Id } from '../../../convex/_generated/dataModel'

export const Route = createFileRoute(
  '/_authenticated/academic-years_/$id_/edit',
)({
  component: EditAcademicYearPage,
  staticData: { crumb: 'academicYears.edit.title' },
})

function EditAcademicYearPage() {
  const { id } = useParams({ strict: false })
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const requesterId = user?.userDocId as Id<'catechists'> | undefined

  const year = useQuery(api.academicYears.get, { id: id as Id<'academicYears'> })
  const createYearMutation = useMutation(api.academicYears.create)
  const updateYearMutation = useMutation(api.academicYears.update)

  if (!requesterId) {
    return null
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader icon={CalendarDays} title={t('academicYears.edit.title')}
        subtitle={t('academicYears.edit.subtitle')}
      />

      <div className="bg-card border rounded-xl p-4 sm:p-6 max-w-3xl">
        {year === undefined ? (
          <div className="space-y-4">
            <div className="h-10 bg-muted animate-pulse rounded-lg" />
            <div className="h-10 bg-muted animate-pulse rounded-lg" />
            <div className="h-10 bg-muted animate-pulse rounded-lg" />
          </div>
        ) : year === null ? (
          <div className="text-destructive text-center py-10">
            Year not found
          </div>
        ) : (
          <AcademicYearForm
            yearId={year._id}
            initialValues={year}
            requesterId={requesterId}
            createMutation={createYearMutation}
            updateMutation={updateYearMutation}
            onSuccess={() => navigate({ to: '/academic-years' })}
            onCancel={() => navigate({ to: '/academic-years' })}
          />
        )}
      </div>
    </div>
  )
}
