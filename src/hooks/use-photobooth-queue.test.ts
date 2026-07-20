import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import {
  orderPhotoboothQueue,
  usePhotoboothQueue,
} from './use-photobooth-queue'
import type { PhotoboothStudent } from './use-photobooth-queue'

function student(
  studentId: string,
  hasPhoto: boolean,
  fullName = studentId,
): PhotoboothStudent {
  return { studentId, fullName, saintName: null, hasPhoto }
}

describe('orderPhotoboothQueue', () => {
  it('puts students missing a photo before students who have one', () => {
    const a = student('a', true)
    const b = student('b', false)
    const c = student('c', true)
    const d = student('d', false)

    expect(orderPhotoboothQueue([a, b, c, d])).toEqual([b, d, a, c])
  })

  it('preserves relative order within each group', () => {
    const missing1 = student('m1', false)
    const missing2 = student('m2', false)
    const has1 = student('h1', true)
    const has2 = student('h2', true)

    expect(orderPhotoboothQueue([has1, missing1, has2, missing2])).toEqual([
      missing1,
      missing2,
      has1,
      has2,
    ])
  })

  it('returns an empty array for an empty roster', () => {
    expect(orderPhotoboothQueue([])).toEqual([])
  })

  it('returns the same order when every student is missing a photo', () => {
    const roster = [
      student('a', false),
      student('b', false),
      student('c', false),
    ]
    expect(orderPhotoboothQueue(roster)).toEqual(roster)
  })

  it('returns the same order when every student already has a photo', () => {
    const roster = [student('a', true), student('b', true), student('c', true)]
    expect(orderPhotoboothQueue(roster)).toEqual(roster)
  })
})

describe('usePhotoboothQueue', () => {
  it('starts current at the first missing-photo student per ordering rule', () => {
    const roster = [
      student('a', true),
      student('b', false),
      student('c', false),
    ]
    const { result } = renderHook(() => usePhotoboothQueue(roster))

    expect(result.current.current!.studentId).toBe('b')
    expect(result.current.isDone).toBe(false)
    expect(result.current.total).toBe(3)
    expect(result.current.confirmedCount).toBe(0)
    expect(result.current.missingStudents.map((s) => s.studentId)).toEqual([
      'b',
      'c',
    ])
  })

  it('skip() pushes current to the end and advances without touching total/confirmedCount', () => {
    const roster = [
      student('a', false),
      student('b', false),
      student('c', true),
    ]
    const { result } = renderHook(() => usePhotoboothQueue(roster))

    expect(result.current.current!.studentId).toBe('a')

    act(() => {
      result.current.skip()
    })

    expect(result.current.current!.studentId).toBe('b')
    expect(result.current.total).toBe(3)
    expect(result.current.confirmedCount).toBe(0)
  })

  it('skip() is a no-op when the queue has only one item', () => {
    const roster = [student('a', false)]
    const { result } = renderHook(() => usePhotoboothQueue(roster))

    act(() => {
      result.current.skip()
    })

    expect(result.current.current!.studentId).toBe('a')
  })

  it('confirm() removes current, increments confirmedCount, advances, and drops the student from missingStudents', () => {
    const roster = [student('a', false), student('b', false)]
    const { result } = renderHook(() => usePhotoboothQueue(roster))

    expect(result.current.missingStudents.map((s) => s.studentId)).toEqual([
      'a',
      'b',
    ])

    act(() => {
      result.current.confirm()
    })

    expect(result.current.current!.studentId).toBe('b')
    expect(result.current.confirmedCount).toBe(1)
    expect(result.current.missingStudents.map((s) => s.studentId)).toEqual([
      'b',
    ])
  })

  it('confirming a student who already had a photo does not change missingStudents', () => {
    const roster = [student('a', true), student('b', false)]
    const { result } = renderHook(() => usePhotoboothQueue(roster))

    expect(result.current.current!.studentId).toBe('b')
    expect(result.current.missingStudents.map((s) => s.studentId)).toEqual([
      'b',
    ])

    act(() => {
      result.current.skip()
    })
    expect(result.current.current!.studentId).toBe('a')

    act(() => {
      result.current.confirm()
    })

    expect(result.current.confirmedCount).toBe(1)
    expect(result.current.missingStudents.map((s) => s.studentId)).toEqual([
      'b',
    ])
  })

  it('confirm() is a no-op once the queue is already empty', () => {
    const roster = [student('a', false)]
    const { result } = renderHook(() => usePhotoboothQueue(roster))

    act(() => {
      result.current.confirm()
    })
    expect(result.current.isDone).toBe(true)
    expect(result.current.confirmedCount).toBe(1)

    act(() => {
      result.current.confirm()
    })
    expect(result.current.confirmedCount).toBe(1)
    expect(result.current.current).toBeNull()
  })

  it('isDone becomes true once the queue is fully drained via a mix of skip and confirm', () => {
    const roster = [
      student('a', false),
      student('b', false),
      student('c', true),
    ]
    const { result } = renderHook(() => usePhotoboothQueue(roster))

    expect(result.current.isDone).toBe(false)

    act(() => {
      result.current.skip()
    })
    act(() => {
      result.current.confirm()
    })
    expect(result.current.isDone).toBe(false)

    act(() => {
      result.current.confirm()
    })
    expect(result.current.isDone).toBe(false)

    act(() => {
      result.current.confirm()
    })
    expect(result.current.isDone).toBe(true)
    expect(result.current.current).toBeNull()
  })

  it('keeps total and missingStudents baseline stable across a students-array identity/content change', () => {
    const roster = [student('a', false), student('b', true)]
    const { result, rerender } = renderHook(
      ({ students }) => usePhotoboothQueue(students),
      { initialProps: { students: roster } },
    )

    expect(result.current.total).toBe(2)
    expect(result.current.missingStudents.map((s) => s.studentId)).toEqual([
      'a',
    ])

    const changedRoster = [
      student('a', true),
      student('b', true),
      student('c', false),
      student('d', false),
    ]
    rerender({ students: changedRoster })

    expect(result.current.total).toBe(2)
    expect(result.current.missingStudents.map((s) => s.studentId)).toEqual([
      'a',
    ])
  })

  it('studentsWithStatus reflects pending/current/confirmed for the whole roster', () => {
    const roster = [
      student('a', false),
      student('b', false),
      student('c', false),
    ]
    const { result } = renderHook(() => usePhotoboothQueue(roster))

    expect(result.current.current!.studentId).toBe('a')
    expect(
      result.current.studentsWithStatus.map((s) => [s.studentId, s.status]),
    ).toEqual([
      ['a', 'current'],
      ['b', 'pending'],
      ['c', 'pending'],
    ])

    act(() => {
      result.current.confirm()
    })

    expect(
      result.current.studentsWithStatus.map((s) => [s.studentId, s.status]),
    ).toEqual([
      ['a', 'confirmed'],
      ['b', 'current'],
      ['c', 'pending'],
    ])
  })

  describe('jumpTo', () => {
    it('is a no-op when jumping to the current student', () => {
      const roster = [student('a', false), student('b', false)]
      const { result } = renderHook(() => usePhotoboothQueue(roster))

      act(() => {
        result.current.jumpTo('a')
      })

      expect(result.current.current!.studentId).toBe('a')
      expect(result.current.confirmedCount).toBe(0)
    })

    it('reorders a pending student from elsewhere in the queue to the front', () => {
      const roster = [
        student('a', false),
        student('b', false),
        student('c', false),
      ]
      const { result } = renderHook(() => usePhotoboothQueue(roster))

      act(() => {
        result.current.jumpTo('c')
      })

      expect(result.current.current!.studentId).toBe('c')
      expect(
        result.current.studentsWithStatus.map((s) => [s.studentId, s.status]),
      ).toEqual([
        ['a', 'pending'],
        ['b', 'pending'],
        ['c', 'current'],
      ])
    })

    it('jumping to an already-confirmed student un-confirms them and puts them at the front (retake)', () => {
      const roster = [student('a', false), student('b', false)]
      const { result } = renderHook(() => usePhotoboothQueue(roster))

      act(() => {
        result.current.confirm()
      })
      expect(result.current.current!.studentId).toBe('b')
      expect(result.current.confirmedCount).toBe(1)

      act(() => {
        result.current.jumpTo('a')
      })

      expect(result.current.current!.studentId).toBe('a')
      expect(result.current.confirmedCount).toBe(0)
      expect(result.current.isDone).toBe(false)
      expect(
        result.current.studentsWithStatus.map((s) => [s.studentId, s.status]),
      ).toEqual([
        ['a', 'current'],
        ['b', 'pending'],
      ])
    })
  })
})
