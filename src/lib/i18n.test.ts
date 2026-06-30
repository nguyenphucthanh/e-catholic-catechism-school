import { beforeEach, describe, expect, test, vi } from 'vitest'

// The i18n module uses initReactI18next which is globally mocked in setup.
// We only need to test the localStorage behavior and the LANG_KEY export,
// not the underlying i18next internals.
vi.mock('i18next', () => {
  const changeLanguage = vi.fn()
  const use = vi.fn()
  const init = vi.fn()
  const instance = { use, init, changeLanguage }
  // support chaining: i18n.use(...).init(...)
  use.mockReturnValue(instance)
  init.mockReturnValue(instance)
  return { default: instance }
})

vi.mock('react-i18next', () => ({
  initReactI18next: {},
}))

// JSON imports — the content doesn't matter for these tests
vi.mock('~/locales/vi.json', () => ({ default: {} }))
vi.mock('~/locales/en.json', () => ({ default: {} }))

// Import AFTER mocks are in place
const { LANG_KEY, setLanguage } = await import('~/lib/i18n')

beforeEach(() => {
  localStorage.clear()
})

describe('i18n module', () => {
  test('LANG_KEY is the expected storage key', () => {
    expect(LANG_KEY).toBe('giaoly_lang')
  })

  test('setLanguage persists the chosen language to localStorage', () => {
    setLanguage('en')
    expect(localStorage.getItem(LANG_KEY)).toBe('en')
  })

  test('setLanguage overwrites a previously stored language', () => {
    setLanguage('en')
    setLanguage('vi')
    expect(localStorage.getItem(LANG_KEY)).toBe('vi')
  })
})
