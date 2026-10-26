import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  assertAdminRole,
  assertEditGuardianPermission,
  assertEditStudentPermission,
  assertValidCatechist,
  checkStudentSensitiveInfoPermission,
} from './lib/authz'
import { GUARDIAN_ERRORS } from './lib/errors'
import { normalizeToE164 } from './lib/phone'
import type { Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'

type ContactType = 'phone' | 'email' | 'zalo' | 'other'

async function clearPrimaryGuardianContacts(
  ctx: MutationCtx,
  guardianId: Id<'guardians'>,
  contactType: ContactType,
  excludeId?: Id<'guardianContacts'>,
) {
  const contacts = await ctx.db
    .query('guardianContacts')
    .withIndex('by_guardian_id', (q) => q.eq('guardianId', guardianId))
    .collect()
  for (const c of contacts) {
    if (!c.isDeleted && c.contactType === contactType && c._id !== excludeId) {
      await ctx.db.patch('guardianContacts', c._id, { isPrimary: false })
    }
  }
}

export const createGuardian = mutation({
  args: {
    fullName: v.string(),
    saintName: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { ...fields }) => {
    await assertValidCatechist(ctx)
    return await ctx.db.insert('guardians', { ...fields, isDeleted: false })
  },
})

export const updateGuardian = mutation({
  args: {
    guardianId: v.id('guardians'),
    fullName: v.string(),
    saintName: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { guardianId, ...fields }) => {
    await assertEditGuardianPermission(ctx, guardianId)
    const guardian = await ctx.db.get('guardians', guardianId)
    if (!guardian || guardian.isDeleted) {
      throw new Error(GUARDIAN_ERRORS.NOT_FOUND)
    }
    await ctx.db.patch('guardians', guardianId, fields)
  },
})

export const softDeleteGuardian = mutation({
  args: {
    guardianId: v.id('guardians'),
  },
  handler: async (ctx, { guardianId }) => {
    await assertAdminRole(ctx)
    const guardian = await ctx.db.get('guardians', guardianId)
    if (!guardian || guardian.isDeleted) {
      throw new Error(GUARDIAN_ERRORS.NOT_FOUND)
    }
    const activeLinks = await ctx.db
      .query('studentGuardians')
      .withIndex('by_guardian_id', (q) => q.eq('guardianId', guardianId))
      // eslint-disable-next-line @convex-dev/no-filter-in-query
      .filter((q) => q.eq(q.field('isDeleted'), false))
      .take(1)
    if (activeLinks.length > 0) {
      throw new Error(GUARDIAN_ERRORS.IN_USE_BY_STUDENT)
    }
    await ctx.db.patch('guardians', guardianId, { isDeleted: true })
  },
})

export const getGuardian = query({
  args: {
    guardianId: v.id('guardians'),
  },
  handler: async (ctx, { guardianId }) => {
    const requester = await assertValidCatechist(ctx)
    const guardian = await ctx.db.get('guardians', guardianId)
    if (!guardian || guardian.isDeleted) return null

    // Contacts are sensitive: only visible via a linked student the requester may see.
    const links = await ctx.db
      .query('studentGuardians')
      .withIndex('by_guardian_id', (q) => q.eq('guardianId', guardianId))
      .collect()
    let canViewSensitive = requester.role === 'admin'
    for (const link of links) {
      if (canViewSensitive) break
      if (link.isDeleted) continue
      if (await checkStudentSensitiveInfoPermission(ctx, link.studentId)) {
        canViewSensitive = true
      }
    }
    if (!canViewSensitive) return { ...guardian, contacts: [] }

    const contacts = await ctx.db
      .query('guardianContacts')
      .withIndex('by_guardian_id', (q) => q.eq('guardianId', guardianId))
      .collect()
    return { ...guardian, contacts: contacts.filter((c) => !c.isDeleted) }
  },
})

export const addGuardianContact = mutation({
  args: {
    guardianId: v.id('guardians'),
    contactType: v.union(
      v.literal('phone'),
      v.literal('email'),
      v.literal('zalo'),
      v.literal('other'),
    ),
    value: v.string(),
    isPrimary: v.boolean(),
    notes: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { guardianId, contactType, value, isPrimary, notes },
  ) => {
    await assertEditGuardianPermission(ctx, guardianId)
    const guardian = await ctx.db.get('guardians', guardianId)
    if (!guardian || guardian.isDeleted)
      throw new Error(GUARDIAN_ERRORS.NOT_FOUND)
    const normalizedValue =
      contactType === 'phone'
        ? normalizeToE164(value, GUARDIAN_ERRORS.INVALID_PHONE)
        : value
    if (isPrimary)
      await clearPrimaryGuardianContacts(ctx, guardianId, contactType)
    return await ctx.db.insert('guardianContacts', {
      guardianId,
      contactType,
      value: normalizedValue,
      isPrimary,
      notes,
      isDeleted: false,
    })
  },
})

export const updateGuardianContact = mutation({
  args: {
    contactId: v.id('guardianContacts'),
    contactType: v.union(
      v.literal('phone'),
      v.literal('email'),
      v.literal('zalo'),
      v.literal('other'),
    ),
    value: v.string(),
    isPrimary: v.boolean(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { contactId, contactType, value, isPrimary, notes }) => {
    const contact = await ctx.db.get('guardianContacts', contactId)
    if (!contact || contact.isDeleted)
      throw new Error(GUARDIAN_ERRORS.CONTACT_NOT_FOUND)
    await assertEditGuardianPermission(ctx, contact.guardianId)
    const normalizedValue =
      contactType === 'phone'
        ? normalizeToE164(value, GUARDIAN_ERRORS.INVALID_PHONE)
        : value
    if (isPrimary)
      await clearPrimaryGuardianContacts(
        ctx,
        contact.guardianId,
        contactType,
        contactId,
      )
    await ctx.db.patch('guardianContacts', contactId, {
      contactType,
      value: normalizedValue,
      isPrimary,
      notes,
    })
  },
})

export const deleteGuardianContact = mutation({
  args: {
    contactId: v.id('guardianContacts'),
  },
  handler: async (ctx, { contactId }) => {
    const contact = await ctx.db.get('guardianContacts', contactId)
    if (!contact || contact.isDeleted)
      throw new Error(GUARDIAN_ERRORS.CONTACT_NOT_FOUND)
    await assertEditGuardianPermission(ctx, contact.guardianId)
    await ctx.db.patch('guardianContacts', contactId, { isDeleted: true })
  },
})

export const linkGuardianToStudent = mutation({
  args: {
    studentId: v.id('students'),
    guardianId: v.id('guardians'),
    relationship: v.string(),
    contactPriority: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { studentId, guardianId, relationship, contactPriority, notes },
  ) => {
    await assertEditStudentPermission(ctx, studentId)
    // Guard: guardian exists
    const guardian = await ctx.db.get('guardians', guardianId)
    if (!guardian || guardian.isDeleted)
      throw new Error(GUARDIAN_ERRORS.NOT_FOUND)
    // Guard: no duplicate link
    const existingLink = await ctx.db
      .query('studentGuardians')
      .withIndex('by_student_id_and_guardian_id', (q) =>
        q.eq('studentId', studentId).eq('guardianId', guardianId),
      )
      // eslint-disable-next-line @convex-dev/no-filter-in-query
      .filter((q) => q.eq(q.field('isDeleted'), false))
      .unique()
    if (existingLink) throw new Error(GUARDIAN_ERRORS.DUPLICATE_LINK)
    // Guard: no duplicate priority for this student
    const priorityConflict = await ctx.db
      .query('studentGuardians')
      .withIndex('by_student_id_and_contact_priority', (q) =>
        q.eq('studentId', studentId).eq('contactPriority', contactPriority),
      )
      // eslint-disable-next-line @convex-dev/no-filter-in-query
      .filter((q) => q.eq(q.field('isDeleted'), false))
      .unique()
    if (priorityConflict) throw new Error(GUARDIAN_ERRORS.DUPLICATE_PRIORITY)

    return await ctx.db.insert('studentGuardians', {
      studentId,
      guardianId,
      relationship,
      contactPriority,
      notes,
      isDeleted: false,
    })
  },
})

export const updateStudentGuardianLink = mutation({
  args: {
    linkId: v.id('studentGuardians'),
    relationship: v.string(),
    contactPriority: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { linkId, relationship, contactPriority, notes }) => {
    const link = await ctx.db.get('studentGuardians', linkId)
    if (!link || link.isDeleted) throw new Error(GUARDIAN_ERRORS.LINK_NOT_FOUND)
    await assertEditStudentPermission(ctx, link.studentId)
    // Guard: no other active link for same student has same priority
    const priorityConflict = await ctx.db
      .query('studentGuardians')
      .withIndex('by_student_id_and_contact_priority', (q) =>
        q
          .eq('studentId', link.studentId)
          .eq('contactPriority', contactPriority),
      )
      // eslint-disable-next-line @convex-dev/no-filter-in-query
      .filter((q) => q.eq(q.field('isDeleted'), false))
      .unique()
    if (priorityConflict && priorityConflict._id !== linkId) {
      throw new Error(GUARDIAN_ERRORS.DUPLICATE_PRIORITY)
    }
    await ctx.db.patch('studentGuardians', linkId, {
      relationship,
      contactPriority,
      notes,
    })
  },
})

export const unlinkGuardianFromStudent = mutation({
  args: {
    linkId: v.id('studentGuardians'),
  },
  handler: async (ctx, { linkId }) => {
    const link = await ctx.db.get('studentGuardians', linkId)
    if (!link || link.isDeleted) throw new Error(GUARDIAN_ERRORS.LINK_NOT_FOUND)
    await assertEditStudentPermission(ctx, link.studentId)
    await ctx.db.patch('studentGuardians', linkId, { isDeleted: true })
  },
})

export const findByPhone = query({
  args: {
    phone: v.string(),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx)

    // Use collect() instead of unique() — by_value indexes only the value string,
    // not contactType, so the same E.164 number may appear as both phone and zalo.
    const contacts = await ctx.db
      .query('guardianContacts')
      .withIndex('by_value', (q) => q.eq('value', args.phone))
      .collect()

    const matchingContacts = contacts.filter(
      (c) => !c.isDeleted && c.contactType === 'phone',
    )

    if (matchingContacts.length === 0) {
      return null
    }

    // Filter to valid non-deleted unique guardians
    const uniqueGuardianIds = Array.from(
      new Set(matchingContacts.map((c) => c.guardianId)),
    )

    const validGuardians = (
      await Promise.all(
        uniqueGuardianIds.map(async (id) => {
          const g = await ctx.db.get('guardians', id)
          return g && !g.isDeleted ? g : null
        }),
      )
    ).filter((g): g is NonNullable<typeof g> => g !== null)

    // If more than one unique guardian found, treat as edge case: no auto-link
    if (validGuardians.length !== 1) {
      return null
    }

    const guardian = validGuardians[0]

    return {
      _id: guardian._id,
      fullName: guardian.fullName,
      saintName: guardian.saintName,
      notes: guardian.notes,
    }
  },
})

export const getStudentGuardians = query({
  args: {
    studentId: v.id('students'),
  },
  handler: async (ctx, { studentId }) => {
    await assertValidCatechist(ctx)
    const canViewSensitive = await checkStudentSensitiveInfoPermission(
      ctx,
      studentId,
    )
    const links = await ctx.db
      .query('studentGuardians')
      .withIndex('by_student_id', (q) => q.eq('studentId', studentId))
      // eslint-disable-next-line @convex-dev/no-filter-in-query
      .filter((q) => q.eq(q.field('isDeleted'), false))
      .collect()
    return await Promise.all(
      links.map(async (link) => {
        let guardian = await ctx.db.get('guardians', link.guardianId)
        if (guardian?.isDeleted) {
          guardian = null
        }
        const contacts =
          guardian && canViewSensitive
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
  },
})
