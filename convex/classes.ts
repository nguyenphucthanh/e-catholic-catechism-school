import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { assertAdminRole, assertValidCatechist } from './lib/authz'
import { CLASS_ERRORS } from './lib/errors'

// ─── Queries ──────────────────────────────────────────────────────────────────

export const list = query({
  args: {
    requesterId: v.id('catechists'),
    academicYearId: v.optional(v.id('academicYears')),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)
    const classes = await ctx.db
      .query('classes')
      .withIndex('by_is_deleted')
      .collect()
    const filtered = classes.filter((c) => !c.isDeleted)

    if (args.academicYearId) {
      const classYears = await ctx.db
        .query('classYears')
        .withIndex('by_academic_year_id', (q) =>
          q.eq('academicYearId', args.academicYearId!),
        )
        .collect()
      const classIds = new Set(
        classYears.filter((cy) => !cy.isDeleted).map((cy) => cy.classId),
      )
      return filtered.filter((c) => classIds.has(c._id))
    }

    return filtered
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

export const get = query({
  args: { requesterId: v.id('catechists'), id: v.id('classes') },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)
    const cls = await ctx.db.get('classes', args.id)
    if (!cls || cls.isDeleted) return null
    return cls
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
  },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx, args.requesterId)

    const name = args.name.trim()
    if (!name) {
      throw new Error(CLASS_ERRORS.EMPTY_NAME)
    }

    const { requesterId, academicYearId, ...fields } = args
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
      }),
    ),
  },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx, args.requesterId)

    const resultIds = []

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
        isDeleted: false,
      })

      resultIds.push(classId)
    }

    return resultIds
  },
})
