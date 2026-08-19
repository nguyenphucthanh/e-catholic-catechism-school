import { GradingEngine } from './gradingEngine'
import type { ScoreItemInput } from './gradingEngine'

export type ScoreItem = ScoreItemInput

export type GradeCalculationResult = {
  numericAverage: number
  isPassed: boolean
  letterGrade: string
}

export function calculateWeightedSemesterGrade(
  scores: Array<ScoreItem>,
): GradeCalculationResult {
  const result = GradingEngine.computeSemesterGrade(scores)
  return {
    numericAverage: result.numericAverage ?? 0,
    isPassed: result.isPassed,
    letterGrade: result.letterGrade ?? 'F',
  }
}
