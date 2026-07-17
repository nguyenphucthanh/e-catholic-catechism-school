import { afterEach, describe, expect, test, vi } from 'vitest'

vi.mock('@sentry/tanstackstart-react', () => ({
  init: vi.fn(),
}))

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('initSentry', () => {
  test('enables Sentry with the configured dsn when VITE_SENTRY_DSN is set', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://example.ingest.sentry.io/1')
    const Sentry = await import('@sentry/tanstackstart-react')
    const { initSentry } = await import('./instrument.client')

    initSentry()

    expect(Sentry.init).toHaveBeenCalledWith({
      enabled: true,
      dsn: 'https://example.ingest.sentry.io/1',
    })
  })

  test('disables Sentry when VITE_SENTRY_DSN is unset', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', undefined)
    const Sentry = await import('@sentry/tanstackstart-react')
    const { initSentry } = await import('./instrument.client')

    initSentry()

    expect(Sentry.init).toHaveBeenCalledWith({
      enabled: false,
      dsn: undefined,
    })
  })
})
