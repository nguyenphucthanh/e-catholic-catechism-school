import { createFileRoute } from '@tanstack/react-router'
import { LayoutDashboard } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Id } from '../../../convex/_generated/dataModel'
import { PageHeader } from '~/components/page-header'
import { useAuth } from '~/lib/auth'
import { StudentDashboard } from '~/components/custom/student-dashboard'

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: DashboardPage,
  staticData: { crumb: 'nav.dashboard' },
})

function DashboardPage() {
  const { t } = useTranslation()
  const { user } = useAuth()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader icon={LayoutDashboard} title={t('nav.dashboard')} />
      {user?.accountType === 'student' ? (
        <StudentDashboard studentId={user.userDocId as Id<'students'>} />
      ) : (
        <>
          <div className="grid auto-rows-min gap-4 md:grid-cols-3">
            <div className="aspect-video rounded-xl bg-muted/50" />
            <div className="aspect-video rounded-xl bg-muted/50" />
            <div className="aspect-video rounded-xl bg-muted/50" />
          </div>
          <div className="min-h-[50vh] rounded-xl bg-muted/50" />
        </>
      )}
    </div>
  )
}
