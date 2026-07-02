import { ENROLLMENT_ERRORS } from './errors'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'

async function getBaseCatechist(
  ctx: QueryCtx | MutationCtx,
  requesterId: Id<'catechists'>,
) {
  const catechist = await ctx.db.get('catechists', requesterId)
  if (!catechist) throw new Error('Unauthorized: Catechist profile not found')
  if (catechist.isDeleted)
    throw new Error('Unauthorized: Account has been deleted')
  if (!catechist.isActive) throw new Error('Unauthorized: Account is inactive')
  return catechist
}

export async function assertValidCatechist(
  ctx: QueryCtx | MutationCtx,
  requesterId: Id<'catechists'>,
) {
  return getBaseCatechist(ctx, requesterId)
}

export async function assertAdminRole(
  ctx: QueryCtx | MutationCtx,
  requesterId: Id<'catechists'>,
) {
  const catechist = await getBaseCatechist(ctx, requesterId)
  if (catechist.role !== 'admin') {
    throw new Error('Unauthorized: Requester does not have admin permissions')
  }
  return catechist
}

export async function assertBoardMemberOrAdmin(
  ctx: QueryCtx | MutationCtx,
  requesterId: Id<'catechists'>,
  academicYearId: Id<'academicYears'>,
) {
  const catechist = await getBaseCatechist(ctx, requesterId)
  if (catechist.role === 'admin') return catechist

  const assignments = await ctx.db
    .query('academicYearAssignments')
    .withIndex('by_academic_year_id_and_catechist_id', (q) =>
      q.eq('academicYearId', academicYearId).eq('catechistId', requesterId),
    )
    .collect()

  const assignment = assignments.find((a) => !a.isDeleted)

  if (!assignment) {
    throw new Error(
      'Unauthorized: Requester is not a board member for this academic year',
    )
  }
  return catechist
}

export async function assertBranchHeadOrAbove(
  ctx: QueryCtx | MutationCtx,
  requesterId: Id<'catechists'>,
  academicYearId: Id<'academicYears'>,
  branchId: Id<'branches'>,
) {
  const catechist = await getBaseCatechist(ctx, requesterId)
  if (catechist.role === 'admin') return catechist

  const boardAssignments = await ctx.db
    .query('academicYearAssignments')
    .withIndex('by_academic_year_id_and_catechist_id', (q) =>
      q.eq('academicYearId', academicYearId).eq('catechistId', requesterId),
    )
    .collect()

  if (boardAssignments.some((a) => !a.isDeleted)) return catechist

  const branchAssignments = await ctx.db
    .query('branchAssignments')
    .withIndex('by_academic_year_id_and_catechist_id_and_branch_id', (q) =>
      q
        .eq('academicYearId', academicYearId)
        .eq('catechistId', requesterId)
        .eq('branchId', branchId),
    )
    .collect()

  const branchAssignment = branchAssignments.find((a) => !a.isDeleted)

  if (!branchAssignment) {
    throw new Error(
      'Unauthorized: Requester is not a branch head or above for this academic year',
    )
  }
  return catechist
}

export async function assertHomeroomCatechistOrAbove(
  ctx: QueryCtx | MutationCtx,
  requesterId: Id<'catechists'>,
  academicYearId: Id<'academicYears'>,
  classYearId: Id<'classYears'>,
) {
  const catechist = await getBaseCatechist(ctx, requesterId)
  if (catechist.role === 'admin') return catechist

  const boardAssignment = await ctx.db
    .query('academicYearAssignments')
    .withIndex('by_academic_year_id_and_catechist_id', (q) =>
      q.eq('academicYearId', academicYearId).eq('catechistId', requesterId),
    )
    .first()

  if (boardAssignment && !boardAssignment.isDeleted) return catechist

  const classYear = await ctx.db.get('classYears', classYearId)
  if (!classYear || classYear.isDeleted) {
    throw new Error('Unauthorized: Class year not found')
  }
  const classDoc = await ctx.db.get('classes', classYear.classId)
  if (!classDoc || classDoc.isDeleted) {
    throw new Error('Unauthorized: Class not found')
  }

  const branchAssignment = await ctx.db
    .query('branchAssignments')
    .withIndex('by_academic_year_id_and_catechist_id_and_branch_id', (q) =>
      q
        .eq('academicYearId', academicYearId)
        .eq('catechistId', requesterId)
        .eq('branchId', classDoc.branchId),
    )
    .first()

  if (branchAssignment && !branchAssignment.isDeleted) return catechist

  const classAssignment = await ctx.db
    .query('classCatechists')
    .withIndex('by_catechist_id_and_class_year_id', (q) =>
      q.eq('catechistId', requesterId).eq('classYearId', classYearId),
    )
    .first()

  if (
    !classAssignment ||
    classAssignment.isDeleted ||
    classAssignment.role !== 'homeroom'
  ) {
    throw new Error(
      'Unauthorized: Requester is not a homeroom catechist for this class',
    )
  }
  return catechist
}

export async function assertClassCatechistOrAbove(
  ctx: QueryCtx | MutationCtx,
  requesterId: Id<'catechists'>,
  academicYearId: Id<'academicYears'>,
  classYearId: Id<'classYears'>,
) {
  const catechist = await getBaseCatechist(ctx, requesterId)
  if (catechist.role === 'admin') return catechist

  const boardAssignments = await ctx.db
    .query('academicYearAssignments')
    .withIndex('by_academic_year_id_and_catechist_id', (q) =>
      q.eq('academicYearId', academicYearId).eq('catechistId', requesterId),
    )
    .collect()

  if (boardAssignments.some((a) => !a.isDeleted)) return catechist

  const classYear = await ctx.db.get('classYears', classYearId)
  if (!classYear || classYear.isDeleted) {
    throw new Error('Unauthorized: Class year not found')
  }
  const classDoc = await ctx.db.get('classes', classYear.classId)
  if (!classDoc || classDoc.isDeleted) {
    throw new Error('Unauthorized: Class not found')
  }

  const branchAssignments = await ctx.db
    .query('branchAssignments')
    .withIndex('by_academic_year_id_and_catechist_id_and_branch_id', (q) =>
      q
        .eq('academicYearId', academicYearId)
        .eq('catechistId', requesterId)
        .eq('branchId', classDoc.branchId),
    )
    .collect()

  if (branchAssignments.some((a) => !a.isDeleted)) return catechist

  const classAssignments = await ctx.db
    .query('classCatechists')
    .withIndex('by_catechist_id_and_class_year_id', (q) =>
      q.eq('catechistId', requesterId).eq('classYearId', classYearId),
    )
    .collect()

  const classAssignment = classAssignments.find((a) => !a.isDeleted)

  if (!classAssignment) {
    throw new Error(
      'Unauthorized: Requester does not have access to this class',
    )
  }
  return catechist
}

export async function assertEnrollmentPermission(
  ctx: QueryCtx | MutationCtx,
  requesterId: Id<'catechists'>,
  classYearId: Id<'classYears'>,
) {
  const catechist = await getBaseCatechist(ctx, requesterId)
  if (catechist.role === 'admin') return catechist

  const classYear = await ctx.db.get('classYears', classYearId)
  if (!classYear || classYear.isDeleted) {
    throw new Error(ENROLLMENT_ERRORS.CLASS_YEAR_NOT_FOUND)
  }

  const boardAssignments = await ctx.db
    .query('academicYearAssignments')
    .withIndex('by_academic_year_id_and_catechist_id', (q) =>
      q
        .eq('academicYearId', classYear.academicYearId)
        .eq('catechistId', requesterId),
    )
    .collect()

  if (boardAssignments.some((a) => !a.isDeleted)) return catechist

  const classDoc = await ctx.db.get('classes', classYear.classId)
  if (!classDoc || classDoc.isDeleted) {
    throw new Error(ENROLLMENT_ERRORS.CLASS_YEAR_NOT_FOUND)
  }

  const branchAssignments = await ctx.db
    .query('branchAssignments')
    .withIndex('by_academic_year_id_and_catechist_id_and_branch_id', (q) =>
      q
        .eq('academicYearId', classYear.academicYearId)
        .eq('catechistId', requesterId)
        .eq('branchId', classDoc.branchId),
    )
    .collect()

  if (branchAssignments.some((a) => !a.isDeleted)) return catechist

  const classAssignments = await ctx.db
    .query('classCatechists')
    .withIndex('by_catechist_id_and_class_year_id', (q) =>
      q.eq('catechistId', requesterId).eq('classYearId', classYearId),
    )
    .collect()

  const classAssignment = classAssignments.find((a) => !a.isDeleted)

  if (classAssignment && classAssignment.role === 'homeroom') {
    return catechist
  }

  throw new Error(ENROLLMENT_ERRORS.UNAUTHORIZED)
}

export async function getEffectivePermissions(
  ctx: QueryCtx | MutationCtx,
  requesterId: Id<'catechists'>,
  academicYearId?: Id<'academicYears'>,
) {
  const catechist = await getBaseCatechist(ctx, requesterId)
  const perms = {
    isAdmin: catechist.role === 'admin',
    isBoardMember: false,
    branchHeadOf: [] as Array<Id<'branches'>>,
    classCatechistOf: [] as Array<Id<'classYears'>>,
  }

  if (!academicYearId) return perms

  const boardAssignments = await ctx.db
    .query('academicYearAssignments')
    .withIndex('by_academic_year_id_and_catechist_id', (q) =>
      q.eq('academicYearId', academicYearId).eq('catechistId', requesterId),
    )
    .collect()
  if (boardAssignments.some((a) => !a.isDeleted)) {
    perms.isBoardMember = true
  }

  const branchAssignments = await ctx.db
    .query('branchAssignments')
    .withIndex('by_catechist_id', (q) => q.eq('catechistId', requesterId))
    .collect()

  perms.branchHeadOf = branchAssignments
    .filter((a) => !a.isDeleted && a.academicYearId === academicYearId)
    .map((a) => a.branchId)

  const classAssignments = await ctx.db
    .query('classCatechists')
    .withIndex('by_catechist_id', (q) => q.eq('catechistId', requesterId))
    .collect()

  perms.classCatechistOf = classAssignments
    .filter((a) => !a.isDeleted && a.academicYearId === academicYearId)
    .map((a) => a.classYearId)

  return perms
}
