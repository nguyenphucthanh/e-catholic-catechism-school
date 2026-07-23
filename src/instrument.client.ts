import * as Sentry from '@sentry/tanstackstart-react'
import { clientEnv } from './clientEnv'

export function initSentry() {
  const sentryDsn = clientEnv.VITE_SENTRY_DSN
  Sentry.init({
    enabled: !!sentryDsn,
    dsn: sentryDsn,
  })
}
