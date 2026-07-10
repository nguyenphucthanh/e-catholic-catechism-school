import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  assertAdminRole,
  assertEditStudentPermission,
  assertEnrollmentPermission,
  assertValidCatechist,
  assertValidStudent,
  checkEditStudentPermission,
} from './lib/authz'
import { nextCounter } from './lib/counter'
import { ENROLLMENT_ERRORS, STUDENT_ERRORS } from './lib/errors'
import { hashPassword } from './lib/password'
import type { MutationCtx, QueryCtx } from './_generated/server'
import type { DataModel, Doc, Id } from './_generated/dataModel'

// Resolves the set of student ids enrolled (non-deleted) in a given class
// year. Used by the `list` query's classYear/branch filters.
async function getStudentIdsInClassYear(
  ctx: QueryCtx,
  classYearId: Id<'classYears'>,
): Promise<Array<Id<'students'>>> {
  const enrollments = await ctx.db
    .query('studentClasses')
    .withIndex('by_class_year_id', (q) => q.eq('classYearId', classYearId))
    .collect()
  return enrollments.filter((e) => !e.isDeleted).map((e) => e.studentId)
}

export const list = query({
  args: {
    requesterId: v.id('catechists'),
    paginationOpts: paginationOptsValidator,
    name: v.optional(v.string()),
    gender: v.optional(v.union(v.literal('male'), v.literal('female'))),
    isActive: v.optional(v.boolean()),
    // Class/branch filters are scoped to a single academic year: classYearId
    // already pins one, branchId needs academicYearId to disambiguate which
    // year's classes to match against.
    classYearId: v.optional(v.id('classYears')),
    branchId: v.optional(v.id('branches')),
    academicYearId: v.optional(v.id('academicYears')),
    sortBy: v.optional(
      v.union(
        v.literal('studentCode'),
        v.literal('saintName'),
        v.literal('fullName'),
        v.literal('gender'),
        v.literal('isActive'),
        v.literal('_creationTime'),
      ),
    ),
    sortOrder: v.optional(v.union(v.literal('asc'), v.literal('desc'))),
  },
  handler: async (ctx, args) => {
    const catechist = await assertValidCatechist(ctx, args.requesterId)
    const activeYears = await ctx.db
      .query('academicYears')
      .withIndex('by_is_deleted', (q) => q.eq('isDeleted', false))
      .collect()
    const activeYear = activeYears.find((y) => y.isActive)
    const activeYearId = activeYear ? activeYear._id : null
    let isBoardMemberForActiveYear = false
    if (activeYearId) {
      const boardAssignment = await ctx.db
        .query('academicYearAssignments')
        .withIndex('by_academic_year_id_and_catechist_id', (q) =>
          q
            .eq('academicYearId', activeYearId)
            .eq('catechistId', args.requesterId),
        )
        .first()
      isBoardMemberForActiveYear = !!(
        boardAssignment && !boardAssignment.isDeleted
      )
    }
    const prefetchedPerms = {
      role: catechist.role,
      activeAcademicYearId: activeYearId,
      isBoardMemberForActiveYear,
    }

    // Enrollment-based filters narrow to a set of eligible student ids.
    // Both, if provided, are combined with an intersection.
    let eligibleStudentIds: Set<Id<'students'>> | null = null

    if (args.classYearId) {
      eligibleStudentIds = new Set(
        await getStudentIdsInClassYear(ctx, args.classYearId),
      )
    }

    if (args.branchId) {
      const classesInBranch = await ctx.db
        .query('classes')
        .withIndex('by_branch_id', (q) => q.eq('branchId', args.branchId!))
        .collect()

      const classYearIds: Array<Id<'classYears'>> = []
      for (const cls of classesInBranch) {
        if (cls.isDeleted) continue
        const classYears = args.academicYearId
          ? await ctx.db
              .query('classYears')
              .withIndex('by_class_id_and_academic_year_id', (q) =>
                q
                  .eq('classId', cls._id)
                  .eq('academicYearId', args.academicYearId!),
              )
              .collect()
          : await ctx.db
              .query('classYears')
              .withIndex('by_class_id', (q) => q.eq('classId', cls._id))
              .collect()
        for (const cy of classYears) {
          if (!cy.isDeleted) classYearIds.push(cy._id)
        }
      }

      const branchStudentIds = new Set<Id<'students'>>()
      for (const classYearId of classYearIds) {
        for (const studentId of await getStudentIdsInClassYear(
          ctx,
          classYearId,
        )) {
          branchStudentIds.add(studentId)
        }
      }

      eligibleStudentIds = eligibleStudentIds
        ? new Set(
            [...eligibleStudentIds].filter((id) => branchStudentIds.has(id)),
          )
        : branchStudentIds
    }

    const students = await ctx.db
      .query('students')
      .withIndex('by_is_deleted', (q) => q.eq('isDeleted', false))
      .collect()

    const nameQuery = args.name?.trim().toLowerCase()

    const filtered = students.filter((s) => {
      if (args.isActive !== undefined && s.isActive !== args.isActive) {
        return false
      }
      if (args.gender && s.gender !== args.gender) return false
      if (nameQuery) {
        const fullNameMatch = s.fullName.toLowerCase().includes(nameQuery)
        const saintNameMatch =
          s.saintName?.toLowerCase().includes(nameQuery) ?? false
        if (!fullNameMatch && !saintNameMatch) return false
      }
      if (eligibleStudentIds && !eligibleStudentIds.has(s._id)) return false
      return true
    })

    if (args.sortBy) {
      const sortBy = args.sortBy
      const direction = args.sortOrder === 'desc' ? -1 : 1
      filtered.sort((a, b) => {
        const aValue = a[sortBy]
        const bValue = b[sortBy]
        if (aValue === bValue) return 0
        if (aValue === undefined) return 1
        if (bValue === undefined) return -1
        if (aValue < bValue) return -1 * direction
        if (aValue > bValue) return 1 * direction
        return 0
      })
    } else {
      filtered.sort((a, b) => b._creationTime - a._creationTime)
    }

    const cursor = args.paginationOpts.cursor
    const startIndex = cursor ? Number(cursor) : 0
    const numItems = args.paginationOpts.numItems
    const page = filtered.slice(startIndex, startIndex + numItems)
    const isDone = startIndex + numItems >= filtered.length

    const pageWithPermissions = await Promise.all(
      page.map(async (student) => {
        const isEditable = await checkEditStudentPermission(
          ctx,
          args.requesterId,
          student._id,
          prefetchedPerms,
        )
        return {
          ...student,
          isEditable,
        }
      }),
    )

    return {
      page: pageWithPermissions,
      isDone,
      continueCursor: isDone ? '' : String(startIndex + numItems),
    }
  },
})

export const get = query({
  args: { requesterId: v.id('catechists'), id: v.id('students') },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)
    const student = await ctx.db.get('students', args.id)
    if (!student || student.isDeleted) return null

    const address = await ctx.db
      .query('studentAddresses')
      .withIndex('by_student_id', (q) => q.eq('studentId', args.id))
      .unique()

    const links = await ctx.db
      .query('studentGuardians')
      .withIndex('by_student_id', (q) => q.eq('studentId', args.id))
      // eslint-disable-next-line @convex-dev/no-filter-in-query
      .filter((q) => q.eq(q.field('isDeleted'), false))
      .collect()

    const guardians = await Promise.all(
      links.map(async (link) => {
        let guardian = await ctx.db.get('guardians', link.guardianId)
        if (guardian?.isDeleted) {
          guardian = null
        }
        const contacts = guardian
          ? (
              await ctx.db
                .query('guardianContacts')
                .withIndex('by_guardian_id', (q) =>
                  q.eq('guardianId', link.guardianId),
                )
                .collect()
            ).filter((c) => !c.isDeleted)
          : []
        return { ...link, guardian, contacts }
      }),
    )

    return {
      ...student,
      address: address?.isDeleted ? null : (address ?? null),
      guardians,
    }
  },
})

export const create = mutation({
  args: {
    requesterId: v.id('catechists'),
    fullName: v.string(),
    saintName: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()), // ISO: YYYY-MM-DD
    gender: v.optional(v.union(v.literal('male'), v.literal('female'))),
    previousParish: v.optional(v.string()),
    previousDiocese: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    profilePhotoStorageId: v.optional(v.id('_storage')),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)

    const seq = await nextCounter(ctx, 'student')
    const studentCode = String(seq)

    const { requesterId, isActive, ...fields } = args
    const studentId = await ctx.db.insert('students', {
      ...fields,
      studentCode,
      isActive: isActive ?? true,
      isDeleted: false,
      createdAt: Date.now(),
    })

    const loginId = `STD-${studentCode}`
    await ctx.db.insert('accounts', {
      loginId,
      passwordHash: hashPassword(loginId),
      accountType: 'student',
      userRefId: studentId,
      isActive: true,
      createdAt: Date.now(),
      isDeleted: false,
    })

    return studentId
  },
})

export const update = mutation({
  args: {
    requesterId: v.id('catechists'),
    studentId: v.id('students'),
    fullName: v.optional(v.string()),
    saintName: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    gender: v.optional(v.union(v.literal('male'), v.literal('female'))),
    previousParish: v.optional(v.string()),
    previousDiocese: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await assertEditStudentPermission(ctx, args.requesterId, args.studentId)

    const student = await ctx.db.get('students', args.studentId)
    if (!student || student.isDeleted) {
      throw new Error(STUDENT_ERRORS.NOT_FOUND)
    }

    const { requesterId, studentId, ...fields } = args
    await ctx.db.patch('students', studentId, fields)
  },
})

export const softDelete = mutation({
  args: {
    requesterId: v.id('catechists'),
    studentId: v.id('students'),
  },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx, args.requesterId)

    const student = await ctx.db.get('students', args.studentId)
    if (!student || student.isDeleted) {
      throw new Error(STUDENT_ERRORS.NOT_FOUND)
    }

    // Guard: cannot delete student enrolled in active classes
    const enrollments = await ctx.db
      .query('studentClasses')
      .withIndex('by_student_id', (q) => q.eq('studentId', args.studentId))
      .collect()

    if (enrollments.some((e) => !e.isDeleted && e.status === 'active')) {
      throw new Error(STUDENT_ERRORS.IN_USE_BY_ENROLLMENT)
    }

    await ctx.db.patch('students', args.studentId, { isDeleted: true })
  },
})

export const getStudentAddress = query({
  args: {
    requesterId: v.id('catechists'),
    studentId: v.id('students'),
  },
  handler: async (ctx, { requesterId, studentId }) => {
    await assertValidCatechist(ctx, requesterId)
    return await ctx.db
      .query('studentAddresses')
      .withIndex('by_student_id', (q) => q.eq('studentId', studentId))
      // eslint-disable-next-line @convex-dev/no-filter-in-query
      .filter((q) => q.eq(q.field('isDeleted'), false))
      .unique()
  },
})

export const upsertStudentAddress = mutation({
  args: {
    requesterId: v.id('catechists'),
    studentId: v.id('students'),
    country: v.string(),
    addressLine1: v.optional(v.string()),
    addressLine2: v.optional(v.string()),
    city: v.optional(v.string()),
    stateProvince: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    hamlet: v.optional(v.string()),
    subHamlet: v.optional(v.string()),
  },
  handler: async (ctx, { requesterId, studentId, ...fields }) => {
    await assertEditStudentPermission(ctx, requesterId, studentId)
    const existing = await ctx.db
      .query('studentAddresses')
      .withIndex('by_student_id', (q) => q.eq('studentId', studentId))
      .unique()
    if (existing !== null) {
      await ctx.db.patch('studentAddresses', existing._id, fields)
    } else {
      await ctx.db.insert('studentAddresses', {
        studentId,
        ...fields,
        isDeleted: false,
      })
    }
  },
})

export const softDeleteStudentAddress = mutation({
  args: {
    requesterId: v.id('catechists'),
    studentId: v.id('students'),
  },
  handler: async (ctx, { requesterId, studentId }) => {
    await assertEditStudentPermission(ctx, requesterId, studentId)
    const address = await ctx.db
      .query('studentAddresses')
      .withIndex('by_student_id', (q) => q.eq('studentId', studentId))
      .unique()
    if (!address || address.isDeleted) {
      throw new Error(STUDENT_ERRORS.ADDRESS_NOT_FOUND)
    }
    await ctx.db.patch('studentAddresses', address._id, { isDeleted: true })
  },
})

export const upsertStudentSacrament = mutation({
  args: {
    requesterId: v.id('catechists'),
    studentId: v.id('students'),
    sacramentType: v.union(
      v.literal('baptism'),
      v.literal('first_confession'),
      v.literal('first_communion'),
      v.literal('confirmation'),
    ),
    receivedDate: v.optional(v.string()),
    receivedPlace: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertEditStudentPermission(ctx, args.requesterId, args.studentId)
    const { requesterId, studentId, sacramentType, ...fields } = args

    const existing = await ctx.db
      .query('studentSacraments')
      .withIndex('by_student_id_and_sacrament_type', (q) =>
        q.eq('studentId', studentId).eq('sacramentType', sacramentType),
      )
      .unique()

    if (existing) {
      await ctx.db.patch('studentSacraments', existing._id, {
        ...fields,
        isDeleted: false,
      })
      return existing._id
    } else {
      return await ctx.db.insert('studentSacraments', {
        studentId,
        sacramentType,
        ...fields,
        isDeleted: false,
      })
    }
  },
})

export const softDeleteStudentSacrament = mutation({
  args: {
    requesterId: v.id('catechists'),
    studentId: v.id('students'),
    sacramentType: v.union(
      v.literal('baptism'),
      v.literal('first_confession'),
      v.literal('first_communion'),
      v.literal('confirmation'),
    ),
  },
  handler: async (ctx, args) => {
    await assertEditStudentPermission(ctx, args.requesterId, args.studentId)
    const { studentId, sacramentType } = args

    const existing = await ctx.db
      .query('studentSacraments')
      .withIndex('by_student_id_and_sacrament_type', (q) =>
        q.eq('studentId', studentId).eq('sacramentType', sacramentType),
      )
      .unique()

    if (existing && !existing.isDeleted) {
      await ctx.db.patch('studentSacraments', existing._id, { isDeleted: true })
    }
  },
})

export const bulkUpdateStudentSacraments = mutation({
  args: {
    requesterId: v.id('catechists'),
    classYearId: v.id('classYears'),
    studentIds: v.array(v.id('students')),
    sacramentType: v.union(
      v.literal('baptism'),
      v.literal('first_confession'),
      v.literal('first_communion'),
      v.literal('confirmation'),
    ),
    receivedDate: v.string(),
    receivedPlace: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertEnrollmentPermission(ctx, args.requesterId, args.classYearId)

    const classYear = await ctx.db.get('classYears', args.classYearId)
    if (!classYear || classYear.isDeleted) {
      throw new Error(ENROLLMENT_ERRORS.CLASS_YEAR_NOT_FOUND)
    }

    // Batch-fetch all enrollments and existing sacraments in parallel
    const [enrollments, existingSacraments] = await Promise.all([
      Promise.all(
        args.studentIds.map((studentId) =>
          ctx.db
            .query('studentClasses')
            .withIndex('by_student_id_and_class_year_id', (q) =>
              q.eq('studentId', studentId).eq('classYearId', args.classYearId),
            )
            .unique(),
        ),
      ),
      Promise.all(
        args.studentIds.map((studentId) =>
          ctx.db
            .query('studentSacraments')
            .withIndex('by_student_id_and_sacrament_type', (q) =>
              q
                .eq('studentId', studentId)
                .eq('sacramentType', args.sacramentType),
            )
            .unique(),
        ),
      ),
    ])

    // Validate all enrollments before writing anything
    for (let i = 0; i < args.studentIds.length; i++) {
      const enrollment = enrollments[i]
      if (
        !enrollment ||
        enrollment.isDeleted ||
        enrollment.status !== 'active'
      ) {
        throw new Error(ENROLLMENT_ERRORS.STUDENT_NOT_ENROLLED)
      }
    }

    // Apply upserts
    await Promise.all(
      args.studentIds.map(async (studentId, i) => {
        const existing = existingSacraments[i]
        const patchFields: Partial<DataModel['studentSacraments']['document']> =
          {
            receivedDate: args.receivedDate,
            isDeleted: false,
          }
        if (args.receivedPlace !== undefined) {
          patchFields.receivedPlace = args.receivedPlace
        }

        if (existing) {
          await ctx.db.patch('studentSacraments', existing._id, patchFields)
        } else {
          await ctx.db.insert('studentSacraments', {
            studentId,
            sacramentType: args.sacramentType,
            isDeleted: false,
            ...patchFields,
          })
        }
      }),
    )
  },
})

// Checks whether the student already has another active/on_leave primary
// class enrollment within the given academic year. `excludeId` lets the
// reactivation flow skip the record it is about to patch.
async function hasPrimaryClassConflict(
  ctx: MutationCtx,
  studentId: Id<'students'>,
  academicYearId: Id<'academicYears'>,
  excludeId?: Id<'studentClasses'>,
): Promise<boolean> {
  const enrollments = await ctx.db
    .query('studentClasses')
    .withIndex('by_student_id_and_is_primary_class', (q) =>
      q.eq('studentId', studentId).eq('isPrimaryClass', true),
    )
    .collect()

  for (const e of enrollments) {
    if (excludeId && e._id === excludeId) continue
    if (e.isDeleted) continue
    if (e.status !== 'active' && e.status !== 'on_leave') continue
    const cy = await ctx.db.get('classYears', e.classYearId)
    if (cy && !cy.isDeleted && cy.academicYearId === academicYearId) {
      return true
    }
  }
  return false
}

async function enrollStudentsInternal(
  ctx: MutationCtx,
  args: {
    requesterId: Id<'catechists'>
    studentIds: Array<Id<'students'>>
    classYearId: Id<'classYears'>
    isPrimaryClass: boolean
    enrolledDate: string
  },
): Promise<Array<Id<'studentClasses'>>> {
  await assertEnrollmentPermission(ctx, args.requesterId, args.classYearId)

  const classYear = await ctx.db.get('classYears', args.classYearId)
  if (!classYear || classYear.isDeleted) {
    throw new Error(ENROLLMENT_ERRORS.CLASS_YEAR_NOT_FOUND)
  }

  const academicYear = await ctx.db.get(
    'academicYears',
    classYear.academicYearId,
  )
  if (!academicYear || academicYear.isDeleted || !academicYear.isActive) {
    throw new Error(ENROLLMENT_ERRORS.ACADEMIC_YEAR_NOT_ACTIVE)
  }

  const results: Array<Id<'studentClasses'>> = []

  for (const studentId of args.studentIds) {
    const student = await ctx.db.get('students', studentId)
    if (!student || student.isDeleted) {
      throw new Error(STUDENT_ERRORS.NOT_FOUND)
    }

    const existing = await ctx.db
      .query('studentClasses')
      .withIndex('by_student_id_and_class_year_id', (q) =>
        q.eq('studentId', studentId).eq('classYearId', args.classYearId),
      )
      .unique()

    if (existing) {
      if (existing.isDeleted || existing.status !== 'active') {
        // Reactivation flow
        if (args.isPrimaryClass) {
          const conflict = await hasPrimaryClassConflict(
            ctx,
            studentId,
            classYear.academicYearId,
            existing._id,
          )
          if (conflict) {
            throw new Error(ENROLLMENT_ERRORS.PRIMARY_CLASS_CONFLICT)
          }
        }
        await ctx.db.patch('studentClasses', existing._id, {
          status: 'active',
          enrolledDate: args.enrolledDate,
          isPrimaryClass: args.isPrimaryClass,
          isDeleted: false,
          leftDate: undefined,
          statusChangedDate: undefined,
        })
        results.push(existing._id)
        continue
      }

      // Already-enrolled flow
      if (existing.isPrimaryClass === args.isPrimaryClass) {
        throw new Error(ENROLLMENT_ERRORS.ALREADY_ENROLLED)
      }
      if (args.isPrimaryClass) {
        const conflict = await hasPrimaryClassConflict(
          ctx,
          studentId,
          classYear.academicYearId,
          existing._id,
        )
        if (conflict) {
          throw new Error(ENROLLMENT_ERRORS.PRIMARY_CLASS_CONFLICT)
        }
      }
      await ctx.db.patch('studentClasses', existing._id, {
        isPrimaryClass: args.isPrimaryClass,
      })
      results.push(existing._id)
      continue
    }

    // New enrollment flow
    if (args.isPrimaryClass) {
      const conflict = await hasPrimaryClassConflict(
        ctx,
        studentId,
        classYear.academicYearId,
      )
      if (conflict) {
        throw new Error(ENROLLMENT_ERRORS.PRIMARY_CLASS_CONFLICT)
      }
    }

    const id = await ctx.db.insert('studentClasses', {
      studentId,
      classYearId: args.classYearId,
      enrolledDate: args.enrolledDate,
      isPrimaryClass: args.isPrimaryClass,
      status: 'active',
      isDeleted: false,
    })
    results.push(id)
  }

  return results
}

export const enrollStudents = mutation({
  args: {
    requesterId: v.id('catechists'),
    studentIds: v.array(v.id('students')),
    classYearId: v.id('classYears'),
    isPrimaryClass: v.boolean(),
    enrolledDate: v.string(),
  },
  handler: async (ctx, args) => {
    return await enrollStudentsInternal(ctx, args)
  },
})

export const updateEnrollmentsStatus = mutation({
  args: {
    requesterId: v.id('catechists'),
    studentClassIds: v.array(v.id('studentClasses')),
    status: v.union(
      v.literal('active'),
      v.literal('on_leave'),
      v.literal('withdrawn'),
    ),
    statusChangedDate: v.string(),
  },
  handler: async (ctx, args) => {
    for (const studentClassId of args.studentClassIds) {
      const studentClass = await ctx.db.get('studentClasses', studentClassId)
      if (!studentClass || studentClass.isDeleted) {
        throw new Error(ENROLLMENT_ERRORS.RECORD_NOT_FOUND)
      }

      await assertEnrollmentPermission(
        ctx,
        args.requesterId,
        studentClass.classYearId,
      )

      const patch: Partial<Doc<'studentClasses'>> = {
        status: args.status,
        statusChangedDate: args.statusChangedDate,
      }

      if (args.status === 'withdrawn') {
        patch.leftDate = args.statusChangedDate
      } else {
        patch.leftDate = undefined
        if (studentClass.isPrimaryClass) {
          const classYear = await ctx.db.get(
            'classYears',
            studentClass.classYearId,
          )
          if (classYear && !classYear.isDeleted) {
            const conflict = await hasPrimaryClassConflict(
              ctx,
              studentClass.studentId,
              classYear.academicYearId,
              studentClass._id,
            )
            if (conflict) {
              throw new Error(ENROLLMENT_ERRORS.PRIMARY_CLASS_CONFLICT)
            }
          }
        }
      }

      await ctx.db.patch('studentClasses', studentClassId, patch)
    }
  },
})

export const enrollStudentInClass = mutation({
  args: {
    requesterId: v.id('catechists'),
    studentId: v.id('students'),
    classYearId: v.id('classYears'),
    enrolledDate: v.string(),
  },
  handler: async (ctx, args) => {
    const results = await enrollStudentsInternal(ctx, {
      requesterId: args.requesterId,
      studentIds: [args.studentId],
      classYearId: args.classYearId,
      isPrimaryClass: true,
      enrolledDate: args.enrolledDate,
    })
    return results[0]
  },
})

async function buildStudentDetail(ctx: QueryCtx, studentId: Id<'students'>) {
  const student = await ctx.db.get('students', studentId)
  if (!student || student.isDeleted) return null

  const address = await ctx.db
    .query('studentAddresses')
    .withIndex('by_student_id', (q) => q.eq('studentId', studentId))
    .unique()

  const sacraments = await ctx.db
    .query('studentSacraments')
    .withIndex('by_student_id', (q) => q.eq('studentId', studentId))
    // eslint-disable-next-line @convex-dev/no-filter-in-query
    .filter((q) => q.eq(q.field('isDeleted'), false))
    .collect()

  const studentClasses = await ctx.db
    .query('studentClasses')
    .withIndex('by_student_id', (q) => q.eq('studentId', studentId))
    // eslint-disable-next-line @convex-dev/no-filter-in-query
    .filter((q) => q.eq(q.field('isDeleted'), false))
    .collect()

  const enrollments = await Promise.all(
    studentClasses.map(async (sc) => {
      const classYear = await ctx.db.get('classYears', sc.classYearId)
      if (!classYear || classYear.isDeleted) {
        return null
      }

      const classRecord = await ctx.db.get('classes', classYear.classId)
      if (!classRecord || classRecord.isDeleted) {
        return null
      }

      const academicYear = await ctx.db.get(
        'academicYears',
        classYear.academicYearId,
      )
      if (!academicYear || academicYear.isDeleted) {
        return null
      }

      return {
        ...sc,
        classYear: {
          ...classYear,
          className: classRecord.name,
          academicYearName: academicYear.name,
          academicYearActive: academicYear.isActive,
          academicYearStartDate: academicYear.startDate,
        },
      }
    }),
  )

  // filter out nulls in case any classYear / class / academicYear was deleted
  const filteredEnrollments = enrollments.filter(
    (e): e is NonNullable<typeof e> => e !== null,
  )

  const guardianLinks = await ctx.db
    .query('studentGuardians')
    .withIndex('by_student_id', (q) => q.eq('studentId', studentId))
    // eslint-disable-next-line @convex-dev/no-filter-in-query
    .filter((q) => q.eq(q.field('isDeleted'), false))
    .collect()

  const guardians = await Promise.all(
    guardianLinks.map(async (link) => {
      const guardian = await ctx.db.get('guardians', link.guardianId)
      if (!guardian || guardian.isDeleted) return null
      const contacts = await ctx.db
        .query('guardianContacts')
        .withIndex('by_guardian_id', (q) => q.eq('guardianId', link.guardianId))
        // eslint-disable-next-line @convex-dev/no-filter-in-query
        .filter((q) => q.eq(q.field('isDeleted'), false))
        .collect()
      return { ...link, guardian, contacts }
    }),
  )

  const filteredGuardians = guardians
    .filter((g): g is NonNullable<typeof g> => g !== null)
    .sort((a, b) => a.contactPriority - b.contactPriority)

  // ─── Siblings (students sharing a guardian) ────────────────────────
  const siblingLinksByGuardian = await Promise.all(
    filteredGuardians.map((g) =>
      ctx.db
        .query('studentGuardians')
        .withIndex('by_guardian_id', (q) => q.eq('guardianId', g.guardianId))
        // eslint-disable-next-line @convex-dev/no-filter-in-query
        .filter((q) => q.eq(q.field('isDeleted'), false))
        .collect(),
    ),
  )

  const siblingStudentIds = new Set<Id<'students'>>()
  for (const links of siblingLinksByGuardian) {
    for (const link of links) {
      if (link.studentId !== studentId) siblingStudentIds.add(link.studentId)
    }
  }

  const siblings = (
    await Promise.all(
      Array.from(siblingStudentIds).map(async (siblingId) => {
        const sibling = await ctx.db.get('students', siblingId)
        if (!sibling || sibling.isDeleted) return null

        const siblingClasses = (
          await ctx.db
            .query('studentClasses')
            .withIndex('by_student_id', (q) => q.eq('studentId', siblingId))
            // eslint-disable-next-line @convex-dev/no-filter-in-query
            .filter((q) => q.eq(q.field('isDeleted'), false))
            .collect()
        ).filter((sc) => sc.status === 'active')

        let currentClassName: string | null = null
        for (const sc of siblingClasses) {
          const classYear = await ctx.db.get('classYears', sc.classYearId)
          if (!classYear || classYear.isDeleted) continue
          const academicYear = await ctx.db.get(
            'academicYears',
            classYear.academicYearId,
          )
          if (!academicYear || academicYear.isDeleted || !academicYear.isActive)
            continue
          const classRecord = await ctx.db.get('classes', classYear.classId)
          if (!classRecord || classRecord.isDeleted) continue
          currentClassName = classRecord.name
          break
        }

        return {
          _id: sibling._id,
          studentCode: sibling.studentCode,
          saintName: sibling.saintName,
          fullName: sibling.fullName,
          currentClassName,
        }
      }),
    )
  ).filter((s): s is NonNullable<typeof s> => s !== null)

  return {
    ...student,
    address: address?.isDeleted ? null : (address ?? null),
    sacraments,
    enrollments: filteredEnrollments,
    guardians: filteredGuardians,
    siblings,
  }
}

export const getStudentDetail = query({
  args: {
    requesterId: v.id('catechists'),
    studentId: v.id('students'),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)
    const detail = await buildStudentDetail(ctx, args.studentId)
    if (!detail) return null
    const isEditable = await checkEditStudentPermission(
      ctx,
      args.requesterId,
      args.studentId,
    )
    return {
      ...detail,
      isEditable,
    }
  },
})

export const getMyProfile = query({
  args: {
    requesterId: v.id('students'),
  },
  handler: async (ctx, args) => {
    await assertValidStudent(ctx, args.requesterId)
    const detail = await buildStudentDetail(ctx, args.requesterId)
    if (!detail) return null
    return {
      ...detail,
      isEditable: false,
    }
  },
})

async function buildEnrollmentSummary(
  ctx: QueryCtx,
  studentClassId: Id<'studentClasses'>,
) {
  // ─── Attendance ─────────────────────────────────────────────────────
  const attendanceRecords = (
    await ctx.db
      .query('attendanceRecords')
      .withIndex('by_student_class_id', (q) =>
        q.eq('studentClassId', studentClassId),
      )
      .collect()
  ).filter((r) => !r.isDeleted)

  const attendanceTally = {
    present: 0,
    late: 0,
    excusedAbsence: 0,
    unexcusedAbsence: 0,
  }
  for (const record of attendanceRecords) {
    if (record.status === 'present') attendanceTally.present += 1
    else if (record.status === 'late') attendanceTally.late += 1
    else if (record.status === 'excused_absence')
      attendanceTally.excusedAbsence += 1
    else attendanceTally.unexcusedAbsence += 1
  }
  const attendanceTotal =
    attendanceTally.present +
    attendanceTally.late +
    attendanceTally.excusedAbsence +
    attendanceTally.unexcusedAbsence

  const attendance = {
    ...attendanceTally,
    total: attendanceTotal,
    rate: attendanceTotal > 0 ? attendanceTally.present / attendanceTotal : 0,
  }

  // ─── Grading ────────────────────────────────────────────────────────
  const scoreEntries = (
    await ctx.db
      .query('scoreEntries')
      .withIndex('by_student_class_id', (q) =>
        q.eq('studentClassId', studentClassId),
      )
      .collect()
  ).filter((e) => !e.isDeleted)

  const semesterGroups = new Map<
    Id<'semesters'>,
    Array<{
      sortOrder: number
      exam: {
        columnName: string
        columnType: string
        scoreValue?: number
        scoreLabel?: string
      }
    }>
  >()
  const semesterDocCache = new Map<Id<'semesters'>, Doc<'semesters'> | null>()

  for (const entry of scoreEntries) {
    const column = await ctx.db.get('scoreColumns', entry.scoreColumnId)
    if (!column || column.isDeleted) continue

    if (!semesterDocCache.has(column.semesterId)) {
      const semester = await ctx.db.get('semesters', column.semesterId)
      semesterDocCache.set(
        column.semesterId,
        semester && !semester.isDeleted ? semester : null,
      )
    }
    const semester = semesterDocCache.get(column.semesterId)
    if (!semester) continue

    const group = semesterGroups.get(column.semesterId) ?? []
    group.push({
      sortOrder: column.sortOrder,
      exam: {
        columnName: column.columnName,
        columnType: column.columnType,
        scoreValue: entry.scoreValue,
        scoreLabel: entry.scoreLabel,
      },
    })
    semesterGroups.set(column.semesterId, group)
  }

  const grading = Array.from(semesterGroups.entries())
    .map(([semesterId, exams]) => {
      const semester = semesterDocCache.get(semesterId)
      return {
        semesterId,
        semesterName: semester?.name,
        semesterNumber: semester?.semesterNumber ?? 0,
        exams: exams
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((e) => e.exam),
      }
    })
    .sort((a, b) => a.semesterNumber - b.semesterNumber)

  // ─── Semester results ───────────────────────────────────────────────
  const semesterResultRows = (
    await ctx.db
      .query('semesterResults')
      .withIndex('by_student_class_id', (q) =>
        q.eq('studentClassId', studentClassId),
      )
      .collect()
  ).filter((r) => !r.isDeleted)

  const semesterResultsWithSemester = await Promise.all(
    semesterResultRows.map(async (row) => {
      const semester = await ctx.db.get('semesters', row.semesterId)
      if (!semester || semester.isDeleted) return null
      return {
        semesterId: row.semesterId,
        semesterName: semester.name,
        semesterNumber: semester.semesterNumber,
        morality: row.morality,
        teacherNote: row.teacherNote,
        isCompleted: row.isCompleted,
      }
    }),
  )

  const semesterResults = semesterResultsWithSemester
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => a.semesterNumber - b.semesterNumber)

  // ─── Annual result ──────────────────────────────────────────────────
  const annualResultRows = (
    await ctx.db
      .query('annualResults')
      .withIndex('by_student_class_id', (q) =>
        q.eq('studentClassId', studentClassId),
      )
      .collect()
  ).filter((r) => !r.isDeleted)

  const annualResultRow = annualResultRows.at(0)
  const annualResult = annualResultRow
    ? {
        conductGrade: annualResultRow.conductGrade,
        remark: annualResultRow.remark,
        isCompleted: annualResultRow.isCompleted,
      }
    : null

  return {
    attendance,
    grading,
    semesterResults,
    annualResult,
  }
}

export const getEnrollmentSummary = query({
  args: {
    requesterId: v.id('catechists'),
    studentClassId: v.id('studentClasses'),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)

    const studentClass = await ctx.db.get('studentClasses', args.studentClassId)
    if (!studentClass || studentClass.isDeleted) return null

    return buildEnrollmentSummary(ctx, args.studentClassId)
  },
})

export const getMyEnrollmentSummary = query({
  args: {
    requesterId: v.id('students'),
    studentClassId: v.id('studentClasses'),
  },
  handler: async (ctx, args) => {
    await assertValidStudent(ctx, args.requesterId)

    const studentClass = await ctx.db.get('studentClasses', args.studentClassId)
    if (
      !studentClass ||
      studentClass.isDeleted ||
      studentClass.studentId !== args.requesterId
    ) {
      return null
    }

    return buildEnrollmentSummary(ctx, args.studentClassId)
  },
})

// ─── Photo Upload ─────────────────────────────────────────────────────────────

export const updateProfilePhoto = mutation({
  args: {
    requesterId: v.id('catechists'),
    studentId: v.id('students'),
    storageId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    await assertEditStudentPermission(ctx, args.requesterId, args.studentId)
    await ctx.db.patch('students', args.studentId, {
      profilePhotoStorageId: args.storageId,
    })
  },
})

export const deleteProfilePhoto = mutation({
  args: {
    requesterId: v.id('catechists'),
    studentId: v.id('students'),
  },
  handler: async (ctx, args) => {
    await assertEditStudentPermission(ctx, args.requesterId, args.studentId)
    const student = await ctx.db.get('students', args.studentId)
    if (!student || !student.profilePhotoStorageId) return
    await ctx.storage.delete(student.profilePhotoStorageId)
    await ctx.db.replace('students', args.studentId, {
      studentCode: student.studentCode,
      fullName: student.fullName,
      saintName: student.saintName,
      dateOfBirth: student.dateOfBirth,
      gender: student.gender,
      previousParish: student.previousParish,
      previousDiocese: student.previousDiocese,
      isActive: student.isActive,
      createdAt: student.createdAt,
      isDeleted: student.isDeleted,
    })
  },
})

export const getProfilePhotoUrl = query({
  args: { studentId: v.id('students') },
  handler: async (ctx, args) => {
    const student = await ctx.db.get('students', args.studentId)
    if (!student || !student.profilePhotoStorageId) return null
    return await ctx.storage.getUrl(student.profilePhotoStorageId)
  },
})

export const getEligibleForEnrollment = query({
  args: {
    requesterId: v.id('catechists'),
    academicYearId: v.id('academicYears'),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)

    // Fetch all active, non-deleted students
    const students = await ctx.db
      .query('students')
      .withIndex('by_is_deleted', (q) => q.eq('isDeleted', false))
      // eslint-disable-next-line @convex-dev/no-filter-in-query
      .filter((q) => q.eq(q.field('isActive'), true))
      .collect()

    // Fetch all class years for the current academic year
    const classYears = await ctx.db
      .query('classYears')
      .withIndex('by_academic_year_id', (q) =>
        q.eq('academicYearId', args.academicYearId),
      )
      // eslint-disable-next-line @convex-dev/no-filter-in-query
      .filter((q) => q.eq(q.field('isDeleted'), false))
      .collect()

    const classYearIds = classYears.map((cy) => cy._id)

    // Fetch all enrollments for these class years
    const allEnrollments = await ctx.db.query('studentClasses').collect()

    // Filter to only non-deleted active/on_leave enrollments in the current academic year
    const relevantEnrollments = allEnrollments.filter((e) => {
      if (e.isDeleted) return false
      if (e.status !== 'active' && e.status !== 'on_leave') return false
      return classYearIds.includes(e.classYearId)
    })

    // Build a map of studentId -> enrollment info for quick lookup
    const enrollmentMap = new Map<
      Id<'students'>,
      {
        enrolledClassYearId: Id<'classYears'>
        isPrimaryClass: boolean
        status: 'active' | 'on_leave' | 'withdrawn'
      }
    >()

    for (const enrollment of relevantEnrollments) {
      if (!enrollmentMap.has(enrollment.studentId)) {
        enrollmentMap.set(enrollment.studentId, {
          enrolledClassYearId: enrollment.classYearId,
          isPrimaryClass: enrollment.isPrimaryClass,
          status: enrollment.status,
        })
      }
    }

    // Fetch class names for enrolled students
    const classNameMap = new Map<Id<'classYears'>, string>()
    for (const classYear of classYears) {
      const classDoc = await ctx.db.get('classes', classYear.classId)
      if (classDoc && !classDoc.isDeleted) {
        classNameMap.set(classYear._id, classDoc.name)
      }
    }

    // Build result with enrollment info for each student
    return students.map((student) => {
      const enrollmentInfo = enrollmentMap.get(student._id)
      if (enrollmentInfo) {
        const className = classNameMap.get(enrollmentInfo.enrolledClassYearId)
        return {
          ...student,
          enrolledClassYearId: enrollmentInfo.enrolledClassYearId,
          className: className ?? 'Unknown',
          isPrimaryClass: enrollmentInfo.isPrimaryClass,
          status: enrollmentInfo.status,
        }
      }

      // Not enrolled
      return {
        ...student,
        enrolledClassYearId: null,
        className: null,
        isPrimaryClass: false,
        status: null,
      }
    })
  },
})

// Builds the roster of a source class year (from a past academic year) for
// the "promote/transfer students" flow, flagging students who already have
// a non-deleted active/on_leave enrollment somewhere in the target academic
// year so the frontend can disable/warn on them instead of letting the
// bulk `enrollStudents` mutation throw PRIMARY_CLASS_CONFLICT.
export const getEligibleForTransfer = query({
  args: {
    requesterId: v.id('catechists'),
    sourceClassYearId: v.id('classYears'),
    targetAcademicYearId: v.id('academicYears'),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)

    const sourceClassYear = await ctx.db.get(
      'classYears',
      args.sourceClassYearId,
    )
    if (!sourceClassYear || sourceClassYear.isDeleted) {
      throw new Error(ENROLLMENT_ERRORS.CLASS_YEAR_NOT_FOUND)
    }

    // Roster of the source class year: non-deleted active/on_leave enrollments.
    const sourceEnrollments = await ctx.db
      .query('studentClasses')
      .withIndex('by_class_year_id', (q) =>
        q.eq('classYearId', args.sourceClassYearId),
      )
      .collect()

    const rosterEnrollments = sourceEnrollments.filter(
      (e) => !e.isDeleted && (e.status === 'active' || e.status === 'on_leave'),
    )

    // Class years belonging to the target academic year, to know which
    // studentClasses rows count as "already enrolled in target year".
    const targetClassYears = await ctx.db
      .query('classYears')
      .withIndex('by_academic_year_id', (q) =>
        q.eq('academicYearId', args.targetAcademicYearId),
      )
      .collect()
    const targetClassYearIds = new Set(
      targetClassYears.filter((cy) => !cy.isDeleted).map((cy) => cy._id),
    )

    // All studentClasses rows, filtered in-memory to the target class years'
    // active/on_leave, non-deleted, primary-class enrollments — this mirrors
    // `hasPrimaryClassConflict`, the actual check `enrollStudents` runs when
    // called with `isPrimaryClass: true` (as the transfer flow always does).
    // A non-primary enrollment in the target year is not a real conflict.
    const allEnrollments = await ctx.db.query('studentClasses').collect()
    const alreadyEnrolledStudentIds = new Set<Id<'students'>>()
    for (const e of allEnrollments) {
      if (e.isDeleted) continue
      if (!e.isPrimaryClass) continue
      if (e.status !== 'active' && e.status !== 'on_leave') continue
      if (!targetClassYearIds.has(e.classYearId)) continue
      alreadyEnrolledStudentIds.add(e.studentId)
    }

    const roster: Array<{
      studentClassId: Id<'studentClasses'>
      studentId: Id<'students'>
      studentCode: string
      fullName: string
      saintName: string | undefined
      gender: 'male' | 'female' | undefined
      alreadyEnrolledInTargetYear: boolean
    }> = []

    for (const enrollment of rosterEnrollments) {
      const student = await ctx.db.get('students', enrollment.studentId)
      if (!student || student.isDeleted) continue

      roster.push({
        studentClassId: enrollment._id,
        studentId: student._id,
        studentCode: student.studentCode,
        fullName: student.fullName,
        saintName: student.saintName,
        gender: student.gender,
        alreadyEnrolledInTargetYear: alreadyEnrolledStudentIds.has(student._id),
      })
    }

    roster.sort((a, b) => a.fullName.localeCompare(b.fullName))

    return roster
  },
})
