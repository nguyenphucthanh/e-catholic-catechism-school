import { describe, expect, test } from 'vitest'
import { getProgramStatus } from './programStatus'

describe('getProgramStatus', () => {
  test('returns upcoming when dateStart is after today', () => {
    expect(getProgramStatus('2099-02-01', '2099-03-01', '2099-01-01')).toBe(
      'upcoming',
    )
  })

  test('returns past when dateEnd is before today', () => {
    expect(getProgramStatus('2099-01-01', '2099-01-15', '2099-02-01')).toBe(
      'past',
    )
  })

  test('returns active when today is strictly between dateStart and dateEnd', () => {
    expect(getProgramStatus('2099-01-01', '2099-03-01', '2099-02-01')).toBe(
      'active',
    )
  })

  test('returns active when today equals dateStart (inclusive boundary)', () => {
    expect(getProgramStatus('2099-02-01', '2099-03-01', '2099-02-01')).toBe(
      'active',
    )
  })

  test('returns active when today equals dateEnd (inclusive boundary)', () => {
    expect(getProgramStatus('2099-01-01', '2099-02-01', '2099-02-01')).toBe(
      'active',
    )
  })
})
