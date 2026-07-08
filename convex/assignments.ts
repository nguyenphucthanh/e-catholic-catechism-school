import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { assertBoardMemberOrAdmin, assertValidCatechist } from './lib/authz'
import type { Doc, Id } from './_generated/dataModel'

// ─── Queries ──────────────────────────────────────────────────────────────────

export const listYearAssignments = query({
  args: {
    requesterId: v.id('catechists'),
    academicYearId: v.id('academicYears'),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)

    // Fetch academic year
    const academicYear = await ctx.db.get('academicYears', args.academicYearId)
    if (!academicYear || academicYear.isDeleted) {
      throw new Error('Academic year not found')
    }

    // Fetch all active catechists
    const allCatechists = await ctx.db.query('catechists').collect()
    const activeCatechists = allCatechists.filter(
      (c) => !c.isDeleted && c.isActive,
    )

    // Fetch all branches
    const allBranches = await ctx.db.query('branches').collect()
    const activeBranches = allBranches.filter((b) => !b.isDeleted)

    // Fetch all classes for this academic year
    const allClassYears = await ctx.db
      .query('classYears')
      .withIndex('by_academic_year_id', (q) =>
        q.eq('academicYearId', args.academicYearId),
      )
      .collect()
    const activeClassYears = allClassYears.filter((cy) => !cy.isDeleted)

    // Resolve class details
    const classDetails = await Promise.all(
      activeClassYears.map(async (cy) => {
        const cls = await ctx.db.get('classes', cy.classId)
        const branch = cls ? await ctx.db.get('branches', cls.branchId) : null
        return {
          classYearId: cy._id,
          classId: cy.classId,
          className: cls?.name || 'Unknown',
          branchName: branch?.name || 'Unknown',
        }
      }),
    )

    // Fetch board members
    const boardAssignments = await ctx.db
      .query('academicYearAssignments')
      .withIndex('by_academic_year_id', (q) =>
        q.eq('academicYearId', args.academicYearId),
      )
      .collect()
    const activeBoardMembers = boardAssignments.filter((a) => !a.isDeleted)

    // Fetch branch assignments
    const branchAssignmentsData = await ctx.db
      .query('branchAssignments')
      .withIndex('by_academic_year_id', (q) =>
        q.eq('academicYearId', args.academicYearId),
      )
      .collect()
    const activeBranchAssignments = branchAssignmentsData.filter(
      (a) => !a.isDeleted,
    )

    // Fetch class teaching assignments
    const classAssignmentsData = await ctx.db
      .query('classCatechists')
      .withIndex('by_academic_year_id', (q) =>
        q.eq('academicYearId', args.academicYearId),
      )
      .collect()
    const activeClassAssignments = classAssignmentsData.filter(
      (a) => !a.isDeleted,
    )

    // Group by role
    const homeroomByClass = new Map<
      Id<'classYears'>,
      { catechistId: Id<'catechists'>; catechist: Doc<'catechists'> } | null
    >()
    const coTeachersByClass = new Map<
      Id<'classYears'>,
      Array<{ catechistId: Id<'catechists'>; catechist: Doc<'catechists'> }>
    >()

    for (const classYearId of activeClassYears.map((cy) => cy._id)) {
      homeroomByClass.set(classYearId, null)
      coTeachersByClass.set(classYearId, [])
    }

    for (const assignment of activeClassAssignments) {
      const catechist = await ctx.db.get('catechists', assignment.catechistId)
      if (!catechist || catechist.isDeleted) continue

      if (assignment.role === 'homeroom') {
        homeroomByClass.set(assignment.classYearId, {
          catechistId: assignment.catechistId,
          catechist,
        })
      } else {
        const existing = coTeachersByClass.get(assignment.classYearId) || []
        existing.push({ catechistId: assignment.catechistId, catechist })
        coTeachersByClass.set(assignment.classYearId, existing)
      }
    }

    return {
      academicYear,
      activeCatechists,
      activeBranches,
      classDetails,
      boardMembers: {
        catechistIds: activeBoardMembers.map((a) => a.catechistId),
        catechists: await Promise.all(
          activeBoardMembers.map(async (a) => {
            const c = await ctx.db.get('catechists', a.catechistId)
            return (
              c || {
                _id: a.catechistId,
                fullName: 'Unknown',
                saintName: undefined,
              }
            )
          }),
        ),
      },
      branchHeads: {
        byBranch: Object.fromEntries(
          await Promise.all(
            activeBranches.map(async (branch) => {
              const heads = activeBranchAssignments
                .filter((a) => a.branchId === branch._id)
                .map((a) => a.catechistId)
              const catechists = await Promise.all(
                heads.map(async (id) => {
                  const c = await ctx.db.get('catechists', id)
                  return (
                    c || { _id: id, fullName: 'Unknown', saintName: undefined }
                  )
                }),
              )
              return [
                branch._id,
                { catechistIds: heads, catechists, branchName: branch.name },
              ]
            }),
          ),
        ),
      },
      classTeachers: {
        byClass: Object.fromEntries(
          activeClassYears.map((cy) => [
            cy._id,
            {
              homeroom: homeroomByClass.get(cy._id),
              coTeachers: coTeachersByClass.get(cy._id) || [],
            },
          ]),
        ),
      },
    }
  },
})

// ─── Mutations ────────────────────────────────────────────────────────────────

export const updateBoardAssignments = mutation({
  args: {
    requesterId: v.id('catechists'),
    academicYearId: v.id('academicYears'),
    catechistIds: v.array(v.id('catechists')),
  },
  handler: async (ctx, args) => {
    // Verify academic year is active
    const academicYear = await ctx.db.get('academicYears', args.academicYearId)
    if (!academicYear || academicYear.isDeleted) {
      throw new Error('Academic year not found')
    }
    if (!academicYear.isActive) {
      throw new Error('Cannot edit inactive academic year')
    }

    // Verify requester is admin or board member
    await assertBoardMemberOrAdmin(ctx, args.requesterId, args.academicYearId)

    // Soft-delete existing assignments
    const existingAssignments = await ctx.db
      .query('academicYearAssignments')
      .withIndex('by_academic_year_id', (q) =>
        q.eq('academicYearId', args.academicYearId),
      )
      .collect()

    for (const assignment of existingAssignments) {
      if (!assignment.isDeleted) {
        await ctx.db.patch('academicYearAssignments', assignment._id, {
          isDeleted: true,
        })
      }
    }

    // Create new assignments
    for (const catechistId of args.catechistIds) {
      const catechist = await ctx.db.get('catechists', catechistId)
      if (!catechist || catechist.isDeleted || !catechist.isActive) {
        throw new Error(`Invalid catechist: ${catechistId}`)
      }

      await ctx.db.insert('academicYearAssignments', {
        academicYearId: args.academicYearId,
        catechistId,
        assignmentType: 'board_member',
        isDeleted: false,
      })
    }

    return { success: true }
  },
})

export const updateBranchAssignments = mutation({
  args: {
    requesterId: v.id('catechists'),
    academicYearId: v.id('academicYears'),
    branchId: v.id('branches'),
    catechistIds: v.array(v.id('catechists')),
  },
  handler: async (ctx, args) => {
    // Verify academic year is active
    const academicYear = await ctx.db.get('academicYears', args.academicYearId)
    if (!academicYear || academicYear.isDeleted) {
      throw new Error('Academic year not found')
    }
    if (!academicYear.isActive) {
      throw new Error('Cannot edit inactive academic year')
    }

    // Verify requester is admin or board member
    await assertBoardMemberOrAdmin(ctx, args.requesterId, args.academicYearId)

    // Verify branch exists
    const branch = await ctx.db.get('branches', args.branchId)
    if (!branch || branch.isDeleted) {
      throw new Error('Branch not found')
    }

    // Soft-delete existing assignments for this branch
    const existingAssignments = await ctx.db
      .query('branchAssignments')
      .withIndex('by_academic_year_id_and_branch_id', (q) =>
        q
          .eq('academicYearId', args.academicYearId)
          .eq('branchId', args.branchId),
      )
      .collect()

    for (const assignment of existingAssignments) {
      if (!assignment.isDeleted) {
        await ctx.db.patch('branchAssignments', assignment._id, {
          isDeleted: true,
        })
      }
    }

    // Create new assignments
    for (const catechistId of args.catechistIds) {
      const catechist = await ctx.db.get('catechists', catechistId)
      if (!catechist || catechist.isDeleted || !catechist.isActive) {
        throw new Error(`Invalid catechist: ${catechistId}`)
      }

      await ctx.db.insert('branchAssignments', {
        academicYearId: args.academicYearId,
        catechistId,
        branchId: args.branchId,
        isDeleted: false,
      })
    }

    return { success: true }
  },
})

export const updateClassAssignments = mutation({
  args: {
    requesterId: v.id('catechists'),
    academicYearId: v.id('academicYears'),
    classYearId: v.id('classYears'),
    homeroomCatechistId: v.union(v.id('catechists'), v.null()),
    coTeacherCatechistIds: v.array(v.id('catechists')),
  },
  handler: async (ctx, args) => {
    // Verify academic year is active
    const academicYear = await ctx.db.get('academicYears', args.academicYearId)
    if (!academicYear || academicYear.isDeleted) {
      throw new Error('Academic year not found')
    }
    if (!academicYear.isActive) {
      throw new Error('Cannot edit inactive academic year')
    }

    // Verify requester is admin or board member
    await assertBoardMemberOrAdmin(ctx, args.requesterId, args.academicYearId)

    // Verify class year exists and belongs to the academic year
    const classYear = await ctx.db.get('classYears', args.classYearId)
    if (!classYear || classYear.isDeleted) {
      throw new Error('Class year not found')
    }
    if (classYear.academicYearId !== args.academicYearId) {
      throw new Error('Class year does not belong to the academic year')
    }

    // Soft-delete existing assignments for this class
    const existingAssignments = await ctx.db
      .query('classCatechists')
      .withIndex('by_class_year_id', (q) =>
        q.eq('classYearId', args.classYearId),
      )
      .collect()

    for (const assignment of existingAssignments) {
      if (!assignment.isDeleted) {
        await ctx.db.patch('classCatechists', assignment._id, {
          isDeleted: true,
        })
      }
    }

    // Add homeroom teacher if specified
    if (args.homeroomCatechistId) {
      const catechist = await ctx.db.get('catechists', args.homeroomCatechistId)
      if (!catechist || catechist.isDeleted || !catechist.isActive) {
        throw new Error('Invalid homeroom catechist')
      }

      await ctx.db.insert('classCatechists', {
        catechistId: args.homeroomCatechistId,
        classYearId: args.classYearId,
        academicYearId: args.academicYearId,
        role: 'homeroom',
        isDeleted: false,
      })
    }

    // Add co-teachers
    for (const catechistId of args.coTeacherCatechistIds) {
      if (catechistId === args.homeroomCatechistId) {
        continue
      }

      const catechist = await ctx.db.get('catechists', catechistId)
      if (!catechist || catechist.isDeleted || !catechist.isActive) {
        throw new Error(`Invalid co-teacher catechist: ${catechistId}`)
      }

      await ctx.db.insert('classCatechists', {
        catechistId,
        classYearId: args.classYearId,
        academicYearId: args.academicYearId,
        role: 'co_teacher',
        isDeleted: false,
      })
    }

    return { success: true }
  },
})
