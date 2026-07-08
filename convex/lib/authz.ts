import { CALENDAR_EVENT_ERRORS, ENROLLMENT_ERRORS } from './errors'
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

async function getBaseStudent(
  ctx: QueryCtx | MutationCtx,
  requesterId: Id<'students'>,
) {
  const student = await ctx.db.get('students', requesterId)
  if (!student) throw new Error('Unauthorized: Student profile not found')
  if (student.isDeleted)
    throw new Error('Unauthorized: Account has been deleted')
  if (!student.isActive) throw new Error('Unauthorized: Account is inactive')
  return student
}

export async function assertValidStudent(
  ctx: QueryCtx | MutationCtx,
  requesterId: Id<'students'>,
) {
  return getBaseStudent(ctx, requesterId)
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

  if (classAssignment) {
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

async function getActiveAcademicYear(
  ctx: QueryCtx | MutationCtx,
): Promise<Id<'academicYears'> | null> {
  const activeYears = await ctx.db
    .query('academicYears')
    .withIndex('by_is_deleted', (q) => q.eq('isDeleted', false))
    .collect()
  const active = activeYears.find((y) => y.isActive)
  return active ? active._id : null
}

export async function checkEditStudentPermission(
  ctx: QueryCtx | MutationCtx,
  requesterId: Id<'catechists'>,
  studentId: Id<'students'>,
  prefetched?: {
    role?: 'admin' | 'user'
    isBoardMemberForActiveYear?: boolean
    activeAcademicYearId?: Id<'academicYears'> | null
  },
): Promise<boolean> {
  const catechist = await ctx.db.get('catechists', requesterId)
  if (!catechist || catechist.isDeleted || !catechist.isActive) {
    return false
  }

  const role = prefetched?.role ?? catechist.role
  if (role === 'admin') {
    return true
  }

  // Check if they are a board member for the active academic year
  let isBoard = prefetched?.isBoardMemberForActiveYear
  let activeYearId = prefetched?.activeAcademicYearId
  if (isBoard === undefined) {
    activeYearId = prefetched?.hasOwnProperty('activeAcademicYearId')
      ? prefetched.activeAcademicYearId
      : await getActiveAcademicYear(ctx)
    if (activeYearId) {
      const boardAssignment = await ctx.db
        .query('academicYearAssignments')
        .withIndex('by_academic_year_id_and_catechist_id', (q) =>
          q.eq('academicYearId', activeYearId!).eq('catechistId', requesterId),
        )
        .first()
      isBoard = !!(boardAssignment && !boardAssignment.isDeleted)
    } else {
      isBoard = false
    }
  }

  if (isBoard) {
    return true
  }

  // Get student enrollments
  const studentEnrollments = await ctx.db
    .query('studentClasses')
    .withIndex('by_student_id', (q) => q.eq('studentId', studentId))
    .collect()

  const nonDeletedEnrollments = studentEnrollments.filter((e) => !e.isDeleted)

  // Floating student rule: if the student has no non-deleted class enrollments, any catechist can edit them
  if (nonDeletedEnrollments.length === 0) {
    return true
  }

  for (const enrollment of nonDeletedEnrollments) {
    const classYear = await ctx.db.get('classYears', enrollment.classYearId)
    if (!classYear || classYear.isDeleted) continue

    // Also check if requester is a board member for this specific enrollment's academic year
    // (if it differs from activeYearId)
    if (classYear.academicYearId !== activeYearId) {
      const boardAssignment = await ctx.db
        .query('academicYearAssignments')
        .withIndex('by_academic_year_id_and_catechist_id', (q) =>
          q
            .eq('academicYearId', classYear.academicYearId)
            .eq('catechistId', requesterId),
        )
        .first()
      if (boardAssignment && !boardAssignment.isDeleted) {
        return true
      }
    }

    // Check if requester is assigned to this class year
    const classAssignment = await ctx.db
      .query('classCatechists')
      .withIndex('by_catechist_id_and_class_year_id', (q) =>
        q
          .eq('catechistId', requesterId)
          .eq('classYearId', enrollment.classYearId),
      )
      .first()
    if (classAssignment && !classAssignment.isDeleted) {
      return true
    }

    // Check if requester is branch head for the branch of this class year
    const classDoc = await ctx.db.get('classes', classYear.classId)
    if (!classDoc || classDoc.isDeleted) continue

    const branchAssignment = await ctx.db
      .query('branchAssignments')
      .withIndex('by_academic_year_id_and_catechist_id_and_branch_id', (q) =>
        q
          .eq('academicYearId', classYear.academicYearId)
          .eq('catechistId', requesterId)
          .eq('branchId', classDoc.branchId),
      )
      .first()
    if (branchAssignment && !branchAssignment.isDeleted) {
      return true
    }
  }

  return false
}

export async function assertEditStudentPermission(
  ctx: QueryCtx | MutationCtx,
  requesterId: Id<'catechists'>,
  studentId: Id<'students'>,
) {
  const allowed = await checkEditStudentPermission(ctx, requesterId, studentId)
  if (!allowed) {
    throw new Error(
      'Unauthorized: You do not have permission to edit this student',
    )
  }
}

export async function assertEditGuardianPermission(
  ctx: QueryCtx | MutationCtx,
  requesterId: Id<'catechists'>,
  guardianId: Id<'guardians'>,
) {
  const catechist = await ctx.db.get('catechists', requesterId)
  if (!catechist || catechist.isDeleted || !catechist.isActive) {
    throw new Error('Unauthorized')
  }
  if (catechist.role === 'admin') return

  const links = await ctx.db
    .query('studentGuardians')
    .withIndex('by_guardian_id', (q) => q.eq('guardianId', guardianId))
    .collect()

  const nonDeletedLinks = links.filter((l) => !l.isDeleted)

  // Floating guardian rule: if guardian has no student links, any catechist can manage them
  if (nonDeletedLinks.length === 0) return

  // Must have edit permission for at least one linked student
  let allowed = false
  for (const link of nonDeletedLinks) {
    if (await checkEditStudentPermission(ctx, requesterId, link.studentId)) {
      allowed = true
      break
    }
  }

  if (!allowed) {
    throw new Error(
      'Unauthorized: You do not have permission to manage this guardian',
    )
  }
}

type CalendarEventScope = 'board' | 'branch' | 'class'
type CalendarEventTarget = {
  branchId?: Id<'branches'>
  classYearId?: Id<'classYears'>
}

function matchesCalendarEventScope(
  perms: Awaited<ReturnType<typeof getEffectivePermissions>>,
  scope: CalendarEventScope,
  target: CalendarEventTarget,
) {
  return (
    (scope === 'board' && perms.isBoardMember) ||
    (scope === 'branch' &&
      !!target.branchId &&
      perms.branchHeadOf.includes(target.branchId)) ||
    (scope === 'class' &&
      !!target.classYearId &&
      perms.classCatechistOf.includes(target.classYearId))
  )
}

// Strict same-scope rule: a catechist may only act on the scope matching
// their own assignment (board_member → board, branch_head → own branch,
// class_catechist → own class). No cascading from a higher assignment.
export async function assertCalendarEventScopePermission(
  ctx: QueryCtx | MutationCtx,
  requesterId: Id<'catechists'>,
  academicYearId: Id<'academicYears'>,
  scope: CalendarEventScope,
  target: CalendarEventTarget,
) {
  const catechist = await getBaseCatechist(ctx, requesterId)
  if (catechist.role === 'admin') return catechist

  const perms = await getEffectivePermissions(ctx, requesterId, academicYearId)

  if (matchesCalendarEventScope(perms, scope, target)) return catechist

  const hasAnyAssignment =
    perms.isBoardMember ||
    perms.branchHeadOf.length > 0 ||
    perms.classCatechistOf.length > 0

  if (!hasAnyAssignment) {
    throw new Error(CALENDAR_EVENT_ERRORS.NOT_ASSIGNED)
  }
  throw new Error(CALENDAR_EVENT_ERRORS.UNAUTHORIZED)
}

// Editing an existing event: admin, the original owner, or a peer holding
// the same-scope assignment as the event (per KAN-224 edit rules).
export async function assertCalendarEventEditPermission(
  ctx: QueryCtx | MutationCtx,
  requesterId: Id<'catechists'>,
  event: {
    createdBy: Id<'catechists'>
    academicYearId: Id<'academicYears'>
    scope: CalendarEventScope
  } & CalendarEventTarget,
) {
  const catechist = await getBaseCatechist(ctx, requesterId)
  if (catechist.role === 'admin') return catechist
  if (event.createdBy === requesterId) return catechist

  const perms = await getEffectivePermissions(
    ctx,
    requesterId,
    event.academicYearId,
  )

  if (!matchesCalendarEventScope(perms, event.scope, event)) {
    throw new Error(CALENDAR_EVENT_ERRORS.UNAUTHORIZED)
  }
  return catechist
}
