import { describe, expect, test } from 'vitest'
import { isActiveEnrollment } from './enrollment'

describe('isActiveEnrollment', () => {
  test.each([
    { isDeleted: false, status: 'active', expected: true },
    { isDeleted: false, status: 'on_leave', expected: true },
    { isDeleted: false, status: 'withdrawn', expected: false },
    { isDeleted: true, status: 'active', expected: false },
    { isDeleted: true, status: 'on_leave', expected: false },
    { isDeleted: true, status: 'withdrawn', expected: false },
  ] as const)(
    'isDeleted=$isDeleted status=$status -> $expected',
    ({ isDeleted, status, expected }) => {
      expect(isActiveEnrollment({ isDeleted, status })).toBe(expected)
    },
  )
})
