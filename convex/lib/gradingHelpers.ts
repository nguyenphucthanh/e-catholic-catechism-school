export type ScoreItem = {
  weight: number
  scoreValue?: number
  scaleType?: 'scale_10' | 'pass_fail' | 'letter_af' | string
}

export type GradeCalculationResult = {
  numericAverage: number
  isPassed: boolean
  letterGrade: string
}

export function calculateWeightedSemesterGrade(
  scores: Array<ScoreItem>,
): GradeCalculationResult {
  if (scores.length === 0) {
    return {
      numericAverage: 0,
      isPassed: false,
      letterGrade: 'F',
    }
  }

  let totalWeightedScore = 0
  let totalWeight = 0

  for (const item of scores) {
    const weight = item.weight || 1
    const value = item.scoreValue ?? 0 // Option B: treat unentered columns as 0

    totalWeightedScore += value * weight
    totalWeight += weight
  }

  const numericAverage =
    totalWeight > 0
      ? Math.round((totalWeightedScore / totalWeight) * 100) / 100
      : 0

  const isPassed = numericAverage >= 5.0

  let letterGrade = 'F'
  if (numericAverage >= 9.0) letterGrade = 'A'
  else if (numericAverage >= 8.0) letterGrade = 'B'
  else if (numericAverage >= 6.5) letterGrade = 'C'
  else if (numericAverage >= 5.0) letterGrade = 'D'

  return {
    numericAverage,
    isPassed,
    letterGrade,
  }
}
