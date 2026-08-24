import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  assertAdminRole,
  assertEnrollmentPermission,
  assertValidCatechist,
  getEffectivePermissions,
} from './lib/authz'
import { CLASS_ERRORS, ENROLLMENT_ERRORS } from './lib/errors'
import { DEFAULT_CLASS_TYPE, classTypeValidator } from './lib/classTypes'
import type { Doc, Id } from './_generated/dataModel'

// ─── Queries ──────────────────────────────────────────────────────────────────

export const list = query({
  args: {
    requesterId: v.id('catechists'),
    academicYearId: v.optional(v.id('academicYears')),
    branchId: v.optional(v.id('branches')),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)
    const classes = await ctx.db
      .query('classes')
      .withIndex('by_is_deleted')
      .collect()
    let filtered = classes.filter((c) => !c.isDeleted)

    if (args.branchId) {
      filtered = filtered.filter((c) => c.branchId === args.branchId)
    }

    let classYearByClassId: Map<Id<'classes'>, Doc<'classYears'>> | undefined

    if (args.academicYearId) {
      const classYears = await ctx.db
        .query('classYears')
        .withIndex('by_academic_year_id', (q) =>
          q.eq('academicYearId', args.academicYearId!),
        )
        .collect()
      const activeClassYears = classYears.filter((cy) => !cy.isDeleted)
      classYearByClassId = new Map(
        activeClassYears.map((cy) => [cy.classId, cy]),
      )
      filtered = filtered.filter((c) => classYearByClassId!.has(c._id))
    }

    const studentCountByClassYearId = new Map<Id<'classYears'>, number>()
    if (classYearByClassId && classYearByClassId.size > 0) {
      const studentClasses = await Promise.all(
        Array.from(classYearByClassId.values()).map(async (cy) => {
          const scs = await ctx.db
            .query('studentClasses')
            .withIndex('by_class_year_id', (q) => q.eq('classYearId', cy._id))
            .collect()
          const activeCount = scs.filter((sc) => !sc.isDeleted).length
          return [cy._id, activeCount] as const
        }),
      )
      for (const [cyId, count] of studentClasses) {
        studentCountByClassYearId.set(cyId, count)
      }
    }

    return filtered.map((c) => {
      const cy = classYearByClassId?.get(c._id)
      return {
        ...c,
        classType: classYearByClassId
          ? (cy?.classType ?? DEFAULT_CLASS_TYPE)
          : undefined,
        studentCount: cy ? (studentCountByClassYearId.get(cy._id) ?? 0) : 0,
      }
    })
  },
})

export const listClassYears = query({
  args: {
    requesterId: v.id('catechists'),
    academicYearId: v.id('academicYears'),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)

    const classYears = await ctx.db
      .query('classYears')
      .withIndex('by_academic_year_id', (q) =>
        q.eq('academicYearId', args.academicYearId),
      )
      .collect()

    const activeClassYears = classYears.filter((cy) => !cy.isDeleted)

    const results = await Promise.all(
      activeClassYears.map(async (cy) => {
        const classRecord = await ctx.db.get('classes', cy.classId)
        return {
          classYearId: cy._id,
          classId: cy.classId,
          className: classRecord?.name ?? '—',
        }
      }),
    )

    return results.filter((r) => r.className !== '—')
  },
})

export const listMyClasses = query({
  args: {
    requesterId: v.id('catechists'),
    academicYearId: v.id('academicYears'),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)

    const perms = await getEffectivePermissions(
      ctx,
      args.requesterId,
      args.academicYearId,
    )

    const classIds = new Set<Id<'classes'>>()

    if (perms.branchHeadOf.length > 0) {
      const classYears = await ctx.db
        .query('classYears')
        .withIndex('by_academic_year_id', (q) =>
          q.eq('academicYearId', args.academicYearId),
        )
        // eslint-disable-next-line @convex-dev/no-filter-in-query
        .filter((q) => q.eq(q.field('isDeleted'), false))
        .collect()

      for (const classYear of classYears) {
        const classRecord = await ctx.db.get('classes', classYear.classId)
        if (
          classRecord &&
          !classRecord.isDeleted &&
          perms.branchHeadOf.includes(classRecord.branchId)
        ) {
          classIds.add(classYear.classId)
        }
      }
    }

    for (const classYearId of perms.classCatechistOf) {
      const classYear = await ctx.db.get('classYears', classYearId)
      if (
        classYear &&
        !classYear.isDeleted &&
        classYear.academicYearId === args.academicYearId
      ) {
        classIds.add(classYear.classId)
      }
    }

    type MyClass = {
      classId: Id<'classes'>
      className: string
      role: 'homeroom' | 'co_teacher' | null
      studentCount: number
      branchName: string
    }

    const classes = (
      await Promise.all(
        [...classIds].map(async (classId): Promise<MyClass | null> => {
          const classRecord = await ctx.db.get('classes', classId)
          if (!classRecord || classRecord.isDeleted) return null

          const classYear = await ctx.db
            .query('classYears')
            .withIndex('by_class_id_and_academic_year_id', (q) =>
              q
                .eq('classId', classId)
                .eq('academicYearId', args.academicYearId),
            )
            .unique()

          let role: 'homeroom' | 'co_teacher' | null = null
          let studentCount = 0

          if (classYear && !classYear.isDeleted) {
            const classCatechists = await ctx.db
              .query('classCatechists')
              .withIndex('by_class_year_id', (q) =>
                q.eq('classYearId', classYear._id),
              )
              .collect()
            const ownAssignment = classCatechists.find(
              (cc) => !cc.isDeleted && cc.catechistId === args.requesterId,
            )
            role = ownAssignment?.role ?? null

            const studentClasses = await ctx.db
              .query('studentClasses')
              .withIndex('by_class_year_id', (q) =>
                q.eq('classYearId', classYear._id),
              )
              .collect()
            studentCount = studentClasses.filter((sc) => !sc.isDeleted).length
          }

          const branch = await ctx.db.get('branches', classRecord.branchId)

          return {
            classId: classRecord._id,
            className: classRecord.name,
            role,
            studentCount,
            branchName: branch?.name ?? '',
          }
        }),
      )
    ).filter((item): item is MyClass => item !== null)

    return classes.sort((a, b) => a.className.localeCompare(b.className))
  },
})

export const get = query({
  args: { requesterId: v.id('catechists'), id: v.id('classes') },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)
    const cls = await ctx.db.get('classes', args.id)
    if (!cls || cls.isDeleted) return null
    return cls
  },
})

export const getClassDetails = query({
  args: {
    requesterId: v.id('catechists'),
    classId: v.id('classes'),
    academicYearId: v.id('academicYears'),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)

    const cls = await ctx.db.get('classes', args.classId)
    if (!cls || cls.isDeleted) return null

    const branch = await ctx.db.get('branches', cls.branchId)

    const classYear = await ctx.db
      .query('classYears')
      .withIndex('by_class_id_and_academic_year_id', (q) =>
        q.eq('classId', args.classId).eq('academicYearId', args.academicYearId),
      )
      .unique()

    if (!classYear || classYear.isDeleted) {
      return {
        class: cls,
        branch,
        classYear: null,
        assignedCatechists: [],
        students: [],
        studentCount: 0,
        canManageEnrollments: false,
      }
    }

    let canManageEnrollments = false
    try {
      await assertEnrollmentPermission(ctx, args.requesterId, classYear._id)
      canManageEnrollments = true
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === ENROLLMENT_ERRORS.UNAUTHORIZED
      ) {
        // requester lacks enrollment permission
      } else {
        throw error
      }
    }

    const classCatechists = await ctx.db
      .query('classCatechists')
      .withIndex('by_class_year_id', (q) => q.eq('classYearId', classYear._id))
      .collect()

    const activeCatechists = classCatechists.filter((cc) => !cc.isDeleted)
    const catechistRecords = (
      await Promise.all(
        activeCatechists.map(async (cc) => {
          const catechist = await ctx.db.get('catechists', cc.catechistId)
          if (!catechist || catechist.isDeleted) return null
          return { role: cc.role, catechist }
        }),
      )
    ).filter(
      (
        r,
      ): r is {
        role: 'homeroom' | 'co_teacher'
        catechist: Doc<'catechists'>
      } => r !== null,
    )

    const studentClasses = await ctx.db
      .query('studentClasses')
      .withIndex('by_class_year_id', (q) => q.eq('classYearId', classYear._id))
      .collect()

    const activeEnrollments = studentClasses.filter((sc) => !sc.isDeleted)
    const studentRecords = (
      await Promise.all(
        activeEnrollments.map(async (sc) => {
          const [student, sacraments] = await Promise.all([
            ctx.db.get('students', sc.studentId),
            ctx.db
              .query('studentSacraments')
              .withIndex('by_student_id', (q) =>
                q.eq('studentId', sc.studentId),
              )
              .collect(),
          ])
          if (!student || student.isDeleted) return null
          const activeSacraments = sacraments.filter((s) => !s.isDeleted)
          const sacramentDates: Record<string, string | undefined> = {
            baptism: activeSacraments.find((s) => s.sacramentType === 'baptism')
              ?.receivedDate,
            first_confession: activeSacraments.find(
              (s) => s.sacramentType === 'first_confession',
            )?.receivedDate,
            first_communion: activeSacraments.find(
              (s) => s.sacramentType === 'first_communion',
            )?.receivedDate,
            confirmation: activeSacraments.find(
              (s) => s.sacramentType === 'confirmation',
            )?.receivedDate,
          }
          return {
            enrollment: {
              _id: sc._id,
              status: sc.status,
              enrolledDate: sc.enrolledDate,
            },
            student,
            sacramentDates,
          }
        }),
      )
    )
      .filter(
        (
          r,
        ): r is {
          enrollment: {
            _id: Id<'studentClasses'>
            status: 'active' | 'on_leave' | 'withdrawn'
            enrolledDate: string
          }
          student: Doc<'students'>
          sacramentDates: {
            baptism?: string
            first_confession?: string
            first_communion?: string
            confirmation?: string
          }
        } => r !== null,
      )
      .sort((a, b) =>
        a.student.fullName.localeCompare(b.student.fullName, 'vi'),
      )

    return {
      class: cls,
      branch,
      classYear,
      assignedCatechists: catechistRecords,
      students: studentRecords,
      studentCount: studentRecords.length,
      canManageEnrollments,
    }
  },
})

// ─── Mutations ────────────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    requesterId: v.id('catechists'),
    branchId: v.id('branches'),
    name: v.string(),
    description: v.optional(v.string()),
    academicYearId: v.id('academicYears'),
    classType: v.optional(classTypeValidator),
  },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx, args.requesterId)

    const name = args.name.trim()
    if (!name) {
      throw new Error(CLASS_ERRORS.EMPTY_NAME)
    }

    const { requesterId, academicYearId, classType, ...fields } = args
    const classId = await ctx.db.insert('classes', {
      ...fields,
      name,
      isDeleted: false,
    })

    const existingClassYear = await ctx.db
      .query('classYears')
      .withIndex('by_class_id_and_academic_year_id', (q) =>
        q.eq('classId', classId).eq('academicYearId', academicYearId),
      )
      .unique()

    if (existingClassYear) {
      throw new Error(CLASS_ERRORS.CLASS_YEAR_DUPLICATE)
    }

    await ctx.db.insert('classYears', {
      classId,
      academicYearId,
      classType: classType ?? DEFAULT_CLASS_TYPE,
      isDeleted: false,
    })

    return classId
  },
})

export const update = mutation({
  args: {
    requesterId: v.id('catechists'),
    classId: v.id('classes'),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx, args.requesterId)

    const cls = await ctx.db.get('classes', args.classId)
    if (!cls || cls.isDeleted) {
      throw new Error(CLASS_ERRORS.NOT_FOUND)
    }

    const name = args.name !== undefined ? args.name.trim() : undefined

    if (name !== undefined && !name) {
      throw new Error(CLASS_ERRORS.EMPTY_NAME)
    }

    const { requesterId, classId, ...fields } = args
    await ctx.db.patch('classes', classId, {
      ...fields,
      ...(name !== undefined ? { name } : {}),
    })
  },
})

export const updateClassYear = mutation({
  args: {
    requesterId: v.id('catechists'),
    classYearId: v.id('classYears'),
    classType: classTypeValidator,
  },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx, args.requesterId)

    const classYear = await ctx.db.get('classYears', args.classYearId)
    if (!classYear || classYear.isDeleted) {
      throw new Error(CLASS_ERRORS.NOT_FOUND)
    }

    await ctx.db.patch('classYears', args.classYearId, {
      classType: args.classType,
    })
  },
})

export const softDelete = mutation({
  args: {
    requesterId: v.id('catechists'),
    classId: v.id('classes'),
  },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx, args.requesterId)

    const cls = await ctx.db.get('classes', args.classId)
    if (!cls || cls.isDeleted) {
      throw new Error(CLASS_ERRORS.NOT_FOUND)
    }

    // Check referential integrity: query classYears by by_class_id
    const classYears = await ctx.db
      .query('classYears')
      .withIndex('by_class_id', (q) => q.eq('classId', args.classId))
      .collect()

    if (classYears.some((cy) => !cy.isDeleted)) {
      throw new Error(CLASS_ERRORS.IN_USE_BY_CLASS_YEAR)
    }

    await ctx.db.patch('classes', args.classId, {
      isDeleted: true,
    })
  },
})

export const bulkCreate = mutation({
  args: {
    requesterId: v.id('catechists'),
    academicYearId: v.id('academicYears'),
    classes: v.array(
      v.object({
        branchId: v.id('branches'),
        name: v.string(),
        classType: v.optional(classTypeValidator),
      }),
    ),
  },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx, args.requesterId)

    const resultIds: Array<Id<'classes'>> = []

    for (const c of args.classes) {
      const name = c.name.trim()
      if (!name) {
        throw new Error(CLASS_ERRORS.EMPTY_NAME)
      }

      const classId = await ctx.db.insert('classes', {
        branchId: c.branchId,
        name,
        isDeleted: false,
      })

      const existingClassYear = await ctx.db
        .query('classYears')
        .withIndex('by_class_id_and_academic_year_id', (q) =>
          q.eq('classId', classId).eq('academicYearId', args.academicYearId),
        )
        .unique()

      if (existingClassYear) {
        throw new Error(CLASS_ERRORS.CLASS_YEAR_DUPLICATE)
      }

      await ctx.db.insert('classYears', {
        classId,
        academicYearId: args.academicYearId,
        classType: c.classType ?? DEFAULT_CLASS_TYPE,
        isDeleted: false,
      })

      resultIds.push(classId)
    }

    return resultIds
  },
})

export const getPhotoboothRoster = query({
  args: {
    requesterId: v.id('catechists'),
    classId: v.id('classes'),
    academicYearId: v.id('academicYears'),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)

    const cls = await ctx.db.get('classes', args.classId)
    if (!cls || cls.isDeleted) return null

    const classYear = await ctx.db
      .query('classYears')
      .withIndex('by_class_id_and_academic_year_id', (q) =>
        q.eq('classId', args.classId).eq('academicYearId', args.academicYearId),
      )
      .unique()

    if (!classYear || classYear.isDeleted) {
      return {
        class: cls,
        canManageEnrollments: false,
        students: [],
      }
    }

    let canManageEnrollments = false
    try {
      await assertEnrollmentPermission(ctx, args.requesterId, classYear._id)
      canManageEnrollments = true
    } catch {
      canManageEnrollments = false
    }

    const studentClasses = await ctx.db
      .query('studentClasses')
      .withIndex('by_class_year_id', (q) => q.eq('classYearId', classYear._id))
      .collect()

    const activeStudentClasses = studentClasses.filter(
      (sc) => !sc.isDeleted && sc.status === 'active',
    )

    const students = await Promise.all(
      activeStudentClasses.map(async (sc) => {
        const s = await ctx.db.get('students', sc.studentId)
        if (!s || s.isDeleted) return null

        return {
          studentId: s._id,
          fullName: s.fullName,
          saintName: s.saintName,
          hasPhoto: !!s.profilePhotoStorageId,
          profilePhotoStorageId: s.profilePhotoStorageId,
        }
      }),
    )

    const validStudents = students.filter(
      (s): s is NonNullable<typeof s> => s !== null,
    )

    const missing: typeof validStudents = []
    const withPhoto: typeof validStudents = []

    for (const st of validStudents) {
      if (st.hasPhoto) {
        withPhoto.push(st)
      } else {
        missing.push(st)
      }
    }

    const sortedMissing = missing.sort((a, b) =>
      a.fullName.localeCompare(b.fullName),
    )
    const sortedWithPhoto = withPhoto.sort((a, b) =>
      a.fullName.localeCompare(b.fullName),
    )

    return {
      class: cls,
      canManageEnrollments,
      students: [...sortedMissing, ...sortedWithPhoto],
    }
  },
})
