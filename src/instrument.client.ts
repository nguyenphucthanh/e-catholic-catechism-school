import * as Sentry from '@sentry/tanstackstart-react'

export function initSentry() {
  const sentryDsn = import.meta.env.VITE_SENTRY_DSN
  Sentry.init({
    enabled: !!sentryDsn,
    dsn: sentryDsn,
  })
}
