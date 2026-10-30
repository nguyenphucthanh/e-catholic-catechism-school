interface SemesterLike {
  _id: string
  semesterNumber: number
  startDate?: string
}

/**
 * Semester that `dateStr` (YYYY-MM-DD) falls in: the latest one whose start
 * date has passed. Semester 1 (no start date, begins with the year) is the
 * fallback, as are legacy rows without a date.
 */
export function pickSemesterForDate<T extends SemesterLike>(
  semesters: ReadonlyArray<T>,
  dateStr: string,
): T | undefined {
  const sorted = [...semesters].sort(
    (a, b) => a.semesterNumber - b.semesterNumber,
  )
  return sorted.reduce<T | undefined>(
    (picked, s) =>
      !picked || (s.startDate && s.startDate <= dateStr) ? s : picked,
    undefined,
  )
}
