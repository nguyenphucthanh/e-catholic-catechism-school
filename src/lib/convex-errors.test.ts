import { describe, expect, test, vi } from 'vitest'
import {
  AUTHZ_ERRORS,
  AUTH_ERRORS,
  CATECHIST_ATTENDANCE_ERRORS,
  CATECHIST_MEETING_ERRORS,
  CLASS_ERRORS,
  STUDENT_ERRORS,
} from '../../convex/lib/errors'
import { translateConvexError } from './convex-errors'

describe('translateConvexError', () => {
  test('maps a known stable error code to its translated key', () => {
    const t = vi.fn((key: string) => `translated:${key}`)
    const err = new Error(STUDENT_ERRORS.NOT_FOUND)

    const result = translateConvexError(err, t)

    expect(t).toHaveBeenCalledWith('students.notFound')
    expect(result).toBe('translated:students.notFound')
  })

  test('maps a wrapped/embedded error code to its translated key', () => {
    const t = vi.fn((key: string) => `translated:${key}`)
    const err = new Error(
      `[CONVEX M(auth:login)] [Request ID: 480dc9d10c1bd9d6] Server Error Uncaught Error: ${AUTH_ERRORS.INVALID_CREDENTIALS} at handler (../convex/auth.ts:22:12) Called by client`,
    )

    const result = translateConvexError(err, t)

    expect(t).toHaveBeenCalledWith('errors.invalidCredentials')
    expect(result).toBe('translated:errors.invalidCredentials')
  })

  test('maps AUTH_ERRORS.ACCOUNT_LOCKED to errors.accountLocked', () => {
    const t = vi.fn((key: string) => `translated:${key}`)
    const err = new Error(AUTH_ERRORS.ACCOUNT_LOCKED)

    const result = translateConvexError(err, t)

    expect(t).toHaveBeenCalledWith('errors.accountLocked')
    expect(result).toBe('translated:errors.accountLocked')
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

describe('translateConvexError: catechist attendance codes', () => {
  test.each([
    ['SESSION_NOT_FOUND', 'catechistAttendance.errors.sessionNotFound'],
    ['SESSION_CANCELLED', 'catechistAttendance.errors.sessionCancelled'],
    ['INACTIVE_ACADEMIC_YEAR', 'catechistAttendance.errors.inactiveYear'],
    ['CATECHIST_NOT_FOUND', 'catechistAttendance.errors.catechistNotFound'],
    ['RECORD_NOT_FOUND', 'catechistAttendance.errors.recordNotFound'],
    ['MEETING_NOT_FOUND', 'catechistAttendance.errors.meetingNotFound'],
    ['MEETING_CANCELLED', 'catechistAttendance.errors.meetingCancelled'],
    ['DUPLICATE_CATECHIST', 'catechistAttendance.errors.duplicateCatechist'],
    ['INVALID_ROLE', 'catechistAttendance.errors.invalidRole'],
    ['SUBSTITUTE_ASSIGNED', 'catechistAttendance.errors.substituteAssigned'],
  ] as const)('maps %s to %s', (code, key) => {
    const t = vi.fn((k: string) => `translated:${k}`)
    const result = translateConvexError(
      new Error(CATECHIST_ATTENDANCE_ERRORS[code]),
      t,
    )
    expect(t).toHaveBeenCalledWith(key)
    expect(result).toBe(`translated:${key}`)
  })
})

describe('translateConvexError: catechist meeting codes', () => {
  test.each([
    ['NOT_FOUND', 'meetings.errors.notFound'],
    ['ACADEMIC_YEAR_NOT_FOUND', 'meetings.errors.yearNotFound'],
    ['INACTIVE_ACADEMIC_YEAR', 'meetings.errors.inactiveYear'],
    ['INVALID_SCOPE', 'meetings.errors.invalidScope'],
    ['BRANCH_NOT_FOUND', 'meetings.errors.branchNotFound'],
    ['INVALID_DATE', 'meetings.errors.invalidDate'],
  ] as const)('maps %s to %s', (code, key) => {
    const t = vi.fn((k: string) => `translated:${k}`)
    const result = translateConvexError(
      new Error(CATECHIST_MEETING_ERRORS[code]),
      t,
    )
    expect(t).toHaveBeenCalledWith(key)
    expect(result).toBe(`translated:${key}`)
  })
})

describe('translateConvexError: class delete codes', () => {
  test.each([
    [CLASS_ERRORS.HAS_ACTIVE_ENROLLMENTS, 'classes.deleteInUseError'],
    [CLASS_ERRORS.HAS_PAST_YEAR_HISTORY, 'classes.deleteHistoryError'],
  ])('maps %s to %s', (code, key) => {
    const t = vi.fn((k: string) => `translated:${k}`)

    const result = translateConvexError(new Error(code), t)

    expect(t).toHaveBeenCalledWith(key)
    expect(result).toBe(`translated:${key}`)
  })
})
