import { EXTRACURRICULAR_ERRORS } from './errors'
import { getStudentPrimaryClass } from './studentClassLookup'
import type { Doc, Id } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'

export interface EligibilityResult {
  eligible: boolean
  reason?: string
}

export async function checkAcademicYearActive(
  ctx: QueryCtx,
  academicYearId: Id<'academicYears'>,
): Promise<EligibilityResult> {
  const academicYear = await ctx.db.get('academicYears', academicYearId)
  if (!academicYear || !academicYear.isActive) {
    return {
      eligible: false,
      reason: EXTRACURRICULAR_ERRORS.INACTIVE_ACADEMIC_YEAR,
    }
  }
  return { eligible: true }
}

export function checkTargetEligibility(
  actorType: 'catechist' | 'student',
  programTarget: string,
): EligibilityResult {
  if (programTarget !== 'all' && programTarget !== actorType) {
    return {
      eligible: false,
      reason: EXTRACURRICULAR_ERRORS.TARGET_NOT_ELIGIBLE,
    }
  }
  return { eligible: true }
}

export async function checkBranchEligibility(
  ctx: QueryCtx,
  actorType: 'catechist' | 'student',
  studentId: Id<'students'> | null,
  programBranches: Array<Id<'branches'>>,
  academicYearId: Id<'academicYears'>,
): Promise<EligibilityResult> {
  // Catechists are always eligible for branch scope
  if (actorType === 'catechist') {
    return { eligible: true }
  }

  // Students: no branch restriction = always eligible
  if (programBranches.length === 0) {
    return { eligible: true }
  }

  if (!studentId) {
    return {
      eligible: false,
      reason: EXTRACURRICULAR_ERRORS.BRANCH_NOT_ELIGIBLE,
    }
  }

  const classRecord = await getStudentPrimaryClass(
    ctx,
    studentId,
    academicYearId,
  )

  // If student has no primary class and program has branch restrictions, not eligible
  if (!classRecord) {
    return {
      eligible: false,
      reason: EXTRACURRICULAR_ERRORS.BRANCH_NOT_ELIGIBLE,
    }
  }

  // Student has a class; check if their branch matches program's allowed branches
  if (!programBranches.includes(classRecord.branchId)) {
    return {
      eligible: false,
      reason: EXTRACURRICULAR_ERRORS.BRANCH_NOT_ELIGIBLE,
    }
  }

  return { eligible: true }
}

export async function checkProgramEligibility(
  ctx: QueryCtx,
  actor: {
    catechist: Doc<'catechists'> | null
    student: Doc<'students'> | null
  },
  program: Doc<'extracurricularPrograms'>,
): Promise<EligibilityResult> {
  // Check academic year is active
  const yearCheck = await checkAcademicYearActive(ctx, program.academicYearId)
  if (!yearCheck.eligible) {
    return yearCheck
  }

  // Determine actor type
  const actorType = actor.catechist ? 'catechist' : 'student'

  // Check target eligibility
  const targetCheck = checkTargetEligibility(actorType, program.target)
  if (!targetCheck.eligible) {
    return targetCheck
  }

  // Check branch eligibility
  const branchCheck = await checkBranchEligibility(
    ctx,
    actorType,
    actor.student?._id ?? null,
    program.branches,
    program.academicYearId,
  )
  if (!branchCheck.eligible) {
    return branchCheck
  }

  return { eligible: true }
}
