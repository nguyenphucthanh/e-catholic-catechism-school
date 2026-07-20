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

export type PhotoboothStudentStatus = 'pending' | 'current' | 'confirmed'

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

  const currentId = state.queue.length > 0 ? state.queue[0].studentId : null

  const studentsWithStatus = React.useMemo(
    () =>
      initialStudents.map((s) => ({
        ...s,
        status: state.confirmedIds.has(s.studentId)
          ? ('confirmed' as const)
          : s.studentId === currentId
            ? ('current' as const)
            : ('pending' as const),
      })),
    [initialStudents, state.confirmedIds, currentId],
  )

  // Moves a student to the front of the queue, whether they're still
  // pending elsewhere in line or already confirmed (a "retake").
  const jumpTo = React.useCallback(
    (studentId: string) => {
      setState((s) => {
        if (s.queue.length > 0 && s.queue[0].studentId === studentId) return s

        if (s.confirmedIds.has(studentId)) {
          const student = initialStudents.find(
            (st) => st.studentId === studentId,
          )
          if (!student) return s
          const confirmedIds = new Set(s.confirmedIds)
          confirmedIds.delete(studentId)
          return { queue: [student, ...s.queue], confirmedIds }
        }

        const idx = s.queue.findIndex((st) => st.studentId === studentId)
        if (idx <= 0) return s
        const target = s.queue[idx]
        const rest = [...s.queue.slice(0, idx), ...s.queue.slice(idx + 1)]
        return { ...s, queue: [target, ...rest] }
      })
    },
    [initialStudents],
  )

  const current: T | null = state.queue.length > 0 ? state.queue[0] : null

  return {
    current,
    isDone: state.queue.length === 0,
    total: initialStudents.length,
    confirmedCount: state.confirmedIds.size,
    missingStudents,
    studentsWithStatus,
    skip,
    confirm,
    jumpTo,
  }
}
