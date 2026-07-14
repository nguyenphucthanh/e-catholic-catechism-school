import { describe, expect, test, vi } from 'vitest'
import { AUTHZ_ERRORS, STUDENT_ERRORS } from '../../convex/lib/errors'
import { translateConvexError } from './convex-errors'

describe('translateConvexError', () => {
  test('maps a known stable error code to its translated key', () => {
    const t = vi.fn((key: string) => `translated:${key}`)
    const err = new Error(STUDENT_ERRORS.NOT_FOUND)

    const result = translateConvexError(err, t)

    expect(t).toHaveBeenCalledWith('students.notFound')
    expect(result).toBe('translated:students.notFound')
  })

  test('maps another known code from a different error group', () => {
    const t = vi.fn((key: string) => `translated:${key}`)
    const err = new Error(AUTHZ_ERRORS.ADMIN_REQUIRED)

    translateConvexError(err, t)

    expect(t).toHaveBeenCalledWith('errors.adminRequired')
  })

  test('falls back to common.error for an unmapped Error message', () => {
    const t = vi.fn((key: string) => `translated:${key}`)
    const err = new Error('some unmapped ad-hoc string')

    const result = translateConvexError(err, t)

    expect(t).toHaveBeenCalledWith('common.error')
    expect(result).toBe('translated:common.error')
  })

  test('falls back to common.error for a non-Error thrown value', () => {
    const t = vi.fn((key: string) => `translated:${key}`)

    translateConvexError('not an error object', t)

    expect(t).toHaveBeenCalledWith('common.error')
  })

  test('respects a custom fallback key', () => {
    const t = vi.fn((key: string) => `translated:${key}`)

    translateConvexError(
      new Error('unmapped'),
      t,
      'attendance.select.unknownError',
    )

    expect(t).toHaveBeenCalledWith('attendance.select.unknownError')
  })
})
