import { useTranslation } from 'react-i18next'
import { Badge } from '~/components/ui/badge'

export function MeetingScopeBadge({
  scope,
  branchName,
}: {
  scope: 'all' | 'board' | 'branch'
  branchName: string | null
}) {
  const { t } = useTranslation()
  return (
    <Badge variant="outline">
      {scope === 'branch'
        ? t('meetings.scope.branchNamed', { name: branchName ?? '' })
        : t(`meetings.scope.${scope}`)}
    </Badge>
  )
}
