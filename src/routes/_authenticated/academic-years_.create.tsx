import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { CalendarDays } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useAuth } from '~/lib/auth'
import { PageHeader } from '~/components/page-header'
import { AcademicYearForm } from '~/components/forms/academic-year-form'

export const Route = createFileRoute('/_authenticated/academic-years_/create')({
  component: CreateAcademicYearPage,
  staticData: { crumb: 'academicYears.create.title' },
})

function CreateAcademicYearPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const requesterId = user?.userDocId as Id<'catechists'> | undefined

  const createYearMutation = useMutation(api.academicYears.create)
  // Dummy update mutation for type safety, create mode doesn't use it
  const updateYearMutation = useMutation(api.academicYears.update)

  if (!requesterId) {
    return null
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={CalendarDays}
        title={t('academicYears.create.title')}
        subtitle={t('academicYears.create.subtitle')}
      />

      <div className="bg-card border rounded-xl p-4 sm:p-6">
        <AcademicYearForm
          requesterId={requesterId}
          createMutation={createYearMutation}
          updateMutation={updateYearMutation}
          onSuccess={() => navigate({ to: '/academic-years' })}
          onCancel={() => navigate({ to: '/academic-years' })}
        />
      </div>
    </div>
  )
}
