interface ScaleExam {
  scaleType: string
  weight?: number
  scoreValue?: number
}

/**
 * Weighted average of scale_10 exams for one semester
 * (weighted sum / sum of weights). Computes with as few as 1 entered
 * scale_10 score; null only when there are none.
 */
export function computeSemesterAvg(exams: Array<ScaleExam>): number | null {
  const scored = exams.filter(
    (e) => e.scaleType === 'scale_10' && e.scoreValue !== undefined,
  )
  if (scored.length < 1) return null

  const weightedSum = scored.reduce(
    (sum, e) => sum + e.scoreValue! * (e.weight ?? 1),
    0,
  )
  const weightSum = scored.reduce((sum, e) => sum + (e.weight ?? 1), 0)
  return weightedSum / weightSum
}

/**
 * Simple average of semester averages. Only computed once every semester
 * in the academic year has its own avg — a single missing semester means
 * no annual avg yet.
 */
export function computeAnnualAvg(
  semesterAvgs: Array<number | null>,
): number | null {
  if (semesterAvgs.length === 0) return null
  if (semesterAvgs.some((avg) => avg === null)) return null
  const values = semesterAvgs as Array<number>
  return values.reduce((sum, v) => sum + v, 0) / values.length
}
