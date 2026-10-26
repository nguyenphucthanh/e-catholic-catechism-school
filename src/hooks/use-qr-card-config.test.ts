import { beforeEach, describe, expect, test, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useQuery } from 'convex/react'
import { useQrCardConfig } from './use-qr-card-config'
import { useAuth } from '~/lib/auth'

vi.mock('~/lib/auth', () => ({ useAuth: vi.fn() }))
vi.mock('convex/react', () => ({ useQuery: vi.fn() }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

const appConfig = { troopName: 'Đoàn', parishName: 'Giáo xứ' }
const prefixes = { student: 'TN', catechist: 'GLV' }

function mockQueries(cfg: any, pre: any) {
  vi.mocked(useQuery).mockImplementation(((ref: any) =>
    ref?.[Symbol.for('functionName')] === 'appConfig:getAccountPrefixes'
      ? pre
      : cfg) as any)
}

describe('useQrCardConfig', () => {
  beforeEach(() => {
    vi.mocked(useQuery).mockReset()
    vi.mocked(useAuth).mockReturnValue({
      user: { accountType: 'catechist', userDocId: 'c1' },
    } as any)
  })

  test('returns undefined while appConfig is loading', () => {
    mockQueries(undefined, prefixes)
    expect(renderHook(() => useQrCardConfig()).result.current).toBeUndefined()
  })

  test('returns undefined while prefixes are loading', () => {
    mockQueries(appConfig, undefined)
    expect(renderHook(() => useQrCardConfig()).result.current).toBeUndefined()
  })

  test('returns config with prefixes and translated labels', () => {
    mockQueries(appConfig, prefixes)
    expect(renderHook(() => useQrCardConfig()).result.current).toEqual({
      troopName: 'Đoàn',
      parishName: 'Giáo xứ',
      studentCodeLabel: 'printCards.studentCodeLabel',
      catechistCodeLabel: 'printCards.catechistCodeLabel',
      studentPrefix: 'TN',
      catechistPrefix: 'GLV',
    })
  })

  test('queries prefixes with empty args when logged in', () => {
    mockQueries(appConfig, prefixes)
    renderHook(() => useQrCardConfig())
    expect(useQuery).toHaveBeenCalledWith(expect.anything(), {})
  })

  test('skips the prefixes query when there is no user', () => {
    vi.mocked(useAuth).mockReturnValue({ user: null } as any)
    mockQueries(appConfig, undefined)
    const { result } = renderHook(() => useQrCardConfig())
    expect(useQuery).toHaveBeenCalledWith(expect.anything(), 'skip')
    expect(result.current).toBeUndefined()
  })
})
