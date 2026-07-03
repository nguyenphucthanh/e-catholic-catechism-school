import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  assertAdminRole,
  assertEnrollmentPermission,
  assertValidCatechist,
} from './lib/authz'
import { nextCounter } from './lib/counter'
import { ENROLLMENT_ERRORS, STUDENT_ERRORS } from './lib/errors'
import { hashPassword } from './lib/password'
import type { MutationCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'

export const list = query({
  args: {
    requesterId: v.id('catechists'),
    paginationOpts: paginationOptsValidator,
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)

    const dbQuery = ctx.db
      .query('students')
      .withIndex('by_is_deleted', (q) => q.eq('isDeleted', false))

    const page = await dbQuery.order('desc').paginate(args.paginationOpts)

    const filtered =
      args.isActive !== undefined
        ? {
            ...page,
            page: page.page.filter((s) => s.isActive === args.isActive),
          }
        : page

    return filtered
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
  },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx, args.requesterId)

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
    await assertAdminRole(ctx, args.requesterId)

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
    await assertAdminRole(ctx, requesterId)
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
    await assertAdminRole(ctx, requesterId)
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
    await assertAdminRole(ctx, args.requesterId)
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
    await assertAdminRole(ctx, args.requesterId)
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

export const getStudentDetail = query({
  args: {
    requesterId: v.id('catechists'),
    studentId: v.id('students'),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)

    const student = await ctx.db.get('students', args.studentId)
    if (!student || student.isDeleted) return null

    const address = await ctx.db
      .query('studentAddresses')
      .withIndex('by_student_id', (q) => q.eq('studentId', args.studentId))
      .unique()

    const sacraments = await ctx.db
      .query('studentSacraments')
      .withIndex('by_student_id', (q) => q.eq('studentId', args.studentId))
      // eslint-disable-next-line @convex-dev/no-filter-in-query
      .filter((q) => q.eq(q.field('isDeleted'), false))
      .collect()

    const studentClasses = await ctx.db
      .query('studentClasses')
      .withIndex('by_student_id', (q) => q.eq('studentId', args.studentId))
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
      .withIndex('by_student_id', (q) => q.eq('studentId', args.studentId))
      // eslint-disable-next-line @convex-dev/no-filter-in-query
      .filter((q) => q.eq(q.field('isDeleted'), false))
      .collect()

    const guardians = await Promise.all(
      guardianLinks.map(async (link) => {
        const guardian = await ctx.db.get('guardians', link.guardianId)
        if (!guardian || guardian.isDeleted) return null
        const contacts = await ctx.db
          .query('guardianContacts')
          .withIndex('by_guardian_id', (q) =>
            q.eq('guardianId', link.guardianId),
          )
          // eslint-disable-next-line @convex-dev/no-filter-in-query
          .filter((q) => q.eq(q.field('isDeleted'), false))
          .collect()
        return { ...link, guardian, contacts }
      }),
    )

    const filteredGuardians = guardians
      .filter((g): g is NonNullable<typeof g> => g !== null)
      .sort((a, b) => a.contactPriority - b.contactPriority)

    return {
      ...student,
      address: address?.isDeleted ? null : (address ?? null),
      sacraments,
      enrollments: filteredEnrollments,
      guardians: filteredGuardians,
    }
  },
})

export const getEnrollmentSummary = query({
  args: {
    requesterId: v.id('catechists'),
    studentClassId: v.id('studentClasses'),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)

    const studentClass = await ctx.db.get('studentClasses', args.studentClassId)
    if (!studentClass || studentClass.isDeleted) return null

    // ─── Attendance ─────────────────────────────────────────────────────
    const attendanceRecords = (
      await ctx.db
        .query('attendanceRecords')
        .withIndex('by_student_class_id', (q) =>
          q.eq('studentClassId', args.studentClassId),
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
          q.eq('studentClassId', args.studentClassId),
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
          q.eq('studentClassId', args.studentClassId),
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
          q.eq('studentClassId', args.studentClassId),
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
