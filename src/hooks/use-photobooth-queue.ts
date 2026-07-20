import * as React from 'react'

export type PhotoboothStudent = {
  studentId: string
  fullName: string
  saintName: string | null | undefined
  hasPhoto: boolean
}

/**
 * Orders a roster for a photobooth session: students missing a photo first
 * (in the order they were given), then students who already have one.
 */
export function orderPhotoboothQueue<T extends PhotoboothStudent>(
  students: Array<T>,
): Array<T> {
  const missing: Array<T> = []
  const withPhoto: Array<T> = []
  for (const s of students) {
    ;(s.hasPhoto ? withPhoto : missing).push(s)
  }
  return [...missing, ...withPhoto]
}

type QueueState<T extends PhotoboothStudent> = {
  queue: Array<T>
  confirmedIds: Set<string>
}

/**
 * Drives a single photobooth session in memory: current student, skip
 * (pushes to end of queue), confirm (removes from queue, counts toward the
 * session), and the running total still missing a photo.
 *
 * The roster is captured once on mount — later changes to `students` (e.g.
 * a refetch after a photo upload) do not reorder or resize an in-progress
 * session.
 */
export function usePhotoboothQueue<T extends PhotoboothStudent>(
  students: Array<T>,
) {
  const [initialStudents] = React.useState(students)
  const [state, setState] = React.useState<QueueState<T>>(() => ({
    queue: orderPhotoboothQueue(initialStudents),
    confirmedIds: new Set(),
  }))

  const skip = React.useCallback(() => {
    setState((s) => {
      if (s.queue.length <= 1) return s
      const [head, ...rest] = s.queue
      return { ...s, queue: [...rest, head] }
    })
  }, [])

  const confirm = React.useCallback(() => {
    setState((s) => {
      if (s.queue.length === 0) return s
      const [head, ...rest] = s.queue
      const confirmedIds = new Set(s.confirmedIds)
      confirmedIds.add(head.studentId)
      return { queue: rest, confirmedIds }
    })
  }, [])

  const missingStudents = React.useMemo(
    () =>
      initialStudents.filter(
        (s) => !s.hasPhoto && !state.confirmedIds.has(s.studentId),
      ),
    [initialStudents, state.confirmedIds],
  )

  const current: T | null = state.queue.length > 0 ? state.queue[0] : null

  return {
    current,
    isDone: state.queue.length === 0,
    total: initialStudents.length,
    confirmedCount: state.confirmedIds.size,
    missingStudents,
    skip,
    confirm,
  }
}
