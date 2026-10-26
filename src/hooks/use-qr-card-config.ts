import { useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { api } from '../../convex/_generated/api'
import type { QrCardAppConfig } from '~/lib/export/qr-card-pdf'
import { useAuth } from '~/lib/auth'

// undefined until app config + prefixes have loaded; guard print handlers on it.
export function useQrCardConfig(): QrCardAppConfig | undefined {
  const { t } = useTranslation()
  const { user } = useAuth()
  const appConfig = useQuery(api.appConfig.get)
  const prefixes = useQuery(
    api.appConfig.getAccountPrefixes,
    user ? {} : 'skip',
  )
  if (!appConfig || !prefixes) return undefined
  return {
    troopName: appConfig.troopName,
    parishName: appConfig.parishName,
    studentCodeLabel: t('printCards.studentCodeLabel'),
    catechistCodeLabel: t('printCards.catechistCodeLabel'),
    studentPrefix: prefixes.student,
    catechistPrefix: prefixes.catechist,
  }
}
