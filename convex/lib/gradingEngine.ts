export type ScaleType = 'scale_10' | 'pass_fail' | 'letter_af'

export type ScoreItemInput = {
  weight?: number
  scoreValue?: number
  // pass_fail results are recorded as a label, never a numeric scoreValue —
  // real callers (score-grid-board, batchSaveEvaluations) never populate
  // scoreValue for pass_fail items.
  scoreLabel?: 'pass' | 'fail' | string
  scaleType?: ScaleType | string
}

export type SemesterGradeResult = {
  numericAverage: number | null
  letterGrade: string | null
  isPassed: boolean
  hasPassedAllPassFail: boolean
}

export type AnnualGradeResult = {
  annualAverage: number | null
  letterGrade: string | null
  isPassed: boolean
}

export const PASSING_GRADE_THRESHOLD = 5.0

/**
 * Maps a 10-point numeric average to a standard letter grade.
 */
export function getLetterGrade(average: number | null): string | null {
  if (average === null) return null
  if (average >= 9.0) return 'A'
  if (average >= 8.0) return 'B'
  if (average >= 6.5) return 'C'
  if (average >= 5.0) return 'D'
  return 'F'
}

/**
 * Unified Server & Client Grade Calculation Engine
 */
export class GradingEngine {
  /**
   * Computes weighted average over entered `scale_10` scores, ignoring unentered items.
   */
  static computeSemesterGrade(
    scores: Array<ScoreItemInput>,
  ): SemesterGradeResult {
    const scale10Scores = scores.filter(
      (s) =>
        (s.scaleType === undefined || s.scaleType === 'scale_10') &&
        s.scoreValue !== undefined,
    )

    const passFailScores = scores.filter((s) => s.scaleType === 'pass_fail')
    const hasPassedAllPassFail = passFailScores.every(
      (s) => s.scoreLabel !== 'fail',
    )

    if (scale10Scores.length === 0) {
      return {
        numericAverage: null,
        letterGrade: null,
        isPassed: hasPassedAllPassFail,
        hasPassedAllPassFail,
      }
    }

    let totalWeightedScore = 0
    let totalWeight = 0

    for (const item of scale10Scores) {
      const weight = item.weight && item.weight > 0 ? item.weight : 1
      const value = item.scoreValue!

      totalWeightedScore += value * weight
      totalWeight += weight
    }

    const numericAverage =
      totalWeight > 0
        ? Math.round((totalWeightedScore / totalWeight) * 100) / 100
        : null

    const letterGrade = getLetterGrade(numericAverage)
    const isPassed =
      numericAverage !== null &&
      numericAverage >= PASSING_GRADE_THRESHOLD &&
      hasPassedAllPassFail

    return {
      numericAverage,
      letterGrade,
      isPassed,
      hasPassedAllPassFail,
    }
  }

  /**
   * Computes simple annual average across semester averages.
   */
  static computeAnnualGrade(
    semesterAverages: Array<number | null>,
  ): AnnualGradeResult {
    if (
      semesterAverages.length === 0 ||
      semesterAverages.some((avg) => avg === null)
    ) {
      return {
        annualAverage: null,
        letterGrade: null,
        isPassed: false,
      }
    }

    const validAverages = semesterAverages as Array<number>
    const sum = validAverages.reduce((acc, val) => acc + val, 0)
    const annualAverage = Math.round((sum / validAverages.length) * 100) / 100

    const letterGrade = getLetterGrade(annualAverage)
    const isPassed = annualAverage >= PASSING_GRADE_THRESHOLD

    return {
      annualAverage,
      letterGrade,
      isPassed,
    }
  }
}
