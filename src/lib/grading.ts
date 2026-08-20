import { GradingEngine } from '../../convex/lib/gradingEngine'
import type {
  ScoreItemInput,
  SemesterGradeResult,
} from '../../convex/lib/gradingEngine'

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
 * Full semester grade result (average + pass/fail verdict), for callers
 * that need to surface hasPassedAllPassFail, not just the number.
 */
export function computeSemesterGrade(
  exams: Array<ScaleExam>,
): SemesterGradeResult {
  return GradingEngine.computeSemesterGrade(exams)
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
