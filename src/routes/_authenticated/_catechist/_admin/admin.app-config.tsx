import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { Settings } from 'lucide-react'
import { api } from '../../../../../convex/_generated/api'
import type { Id } from '../../../../../convex/_generated/dataModel'
import { useAuth } from '~/lib/auth'
import { isAdmin } from '~/lib/permissions'
import { PageHeader } from '~/components/page-header'
import { AppConfigForm } from '~/components/forms/app-config-form'

export const Route = createFileRoute(
  '/_authenticated/_catechist/_admin/admin/app-config',
)({
  component: AppConfigPage,
  staticData: {
    crumb: 'appConfig.title',
  },
})

function AppConfigPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()

  if (!isAdmin(user) || !user) {
    return (
      <div className="p-4 text-destructive flex items-center justify-center h-full">
        {t('common.contactAdmin')}
      </div>
    )
  }

  const requesterId = user.userDocId as Id<'catechists'>
  const config = useQuery(api.appConfig.get)
  const upsertMutation = useMutation(api.appConfig.upsert)
  const generateUploadUrlMutation = useMutation(api.storage.generateUploadUrl)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Settings}
        title={t('appConfig.title')}
        subtitle={t('appConfig.subtitle')}
      />

      <div className="bg-card border rounded-xl p-4">
        <AppConfigForm
          initialValues={config ?? undefined}
          requesterId={requesterId}
          upsertMutation={upsertMutation}
          generateUploadUrlMutation={generateUploadUrlMutation}
          onSuccess={() => navigate({ to: '/admin/app-config' })}
        />
      </div>
    </div>
  )
}
