import { GradingEngine } from '../../convex/lib/gradingEngine'
import type { ScoreItemInput } from '../../convex/lib/gradingEngine'

export interface ScaleExam extends ScoreItemInput {
  scaleType: string
  weight?: number
  scoreValue?: number
}

/**
 * Weighted average of scale_10 exams for one semester.
 * Computes with as few as 1 entered scale_10 score; returns null when there are none.
 */
export function computeSemesterAvg(exams: Array<ScaleExam>): number | null {
  const result = GradingEngine.computeSemesterGrade(exams)
  return result.numericAverage
}

/**
 * Simple average of semester averages.
 */
export function computeAnnualAvg(
  semesterAvgs: Array<number | null>,
): number | null {
  const result = GradingEngine.computeAnnualGrade(semesterAvgs)
  return result.annualAverage
}
