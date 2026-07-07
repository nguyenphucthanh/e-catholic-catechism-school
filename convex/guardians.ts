import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  assertAdminRole,
  assertEditGuardianPermission,
  assertEditStudentPermission,
  assertValidCatechist,
} from './lib/authz'
import { GUARDIAN_ERRORS } from './lib/errors'
import type { Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'

const E164_REGEX = /^\+[1-9]\d{6,14}$/

function validatePhone(value: string): void {
  if (!E164_REGEX.test(value)) {
    throw new Error(GUARDIAN_ERRORS.INVALID_PHONE)
  }
}

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
    requesterId: v.id('catechists'),
    fullName: v.string(),
    saintName: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { requesterId, ...fields }) => {
    await assertValidCatechist(ctx, requesterId)
    return await ctx.db.insert('guardians', { ...fields, isDeleted: false })
  },
})

export const updateGuardian = mutation({
  args: {
    requesterId: v.id('catechists'),
    guardianId: v.id('guardians'),
    fullName: v.string(),
    saintName: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { requesterId, guardianId, ...fields }) => {
    await assertEditGuardianPermission(ctx, requesterId, guardianId)
    const guardian = await ctx.db.get('guardians', guardianId)
    if (!guardian || guardian.isDeleted) {
      throw new Error(GUARDIAN_ERRORS.NOT_FOUND)
    }
    await ctx.db.patch('guardians', guardianId, fields)
  },
})

export const softDeleteGuardian = mutation({
  args: {
    requesterId: v.id('catechists'),
    guardianId: v.id('guardians'),
  },
  handler: async (ctx, { requesterId, guardianId }) => {
    await assertAdminRole(ctx, requesterId)
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
    requesterId: v.id('catechists'),
    guardianId: v.id('guardians'),
  },
  handler: async (ctx, { requesterId, guardianId }) => {
    await assertValidCatechist(ctx, requesterId)
    const guardian = await ctx.db.get('guardians', guardianId)
    if (!guardian || guardian.isDeleted) return null
    const contacts = await ctx.db
      .query('guardianContacts')
      .withIndex('by_guardian_id', (q) => q.eq('guardianId', guardianId))
      .collect()
    return { ...guardian, contacts: contacts.filter((c) => !c.isDeleted) }
  },
})

export const addGuardianContact = mutation({
  args: {
    requesterId: v.id('catechists'),
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
    { requesterId, guardianId, contactType, value, isPrimary, notes },
  ) => {
    await assertEditGuardianPermission(ctx, requesterId, guardianId)
    const guardian = await ctx.db.get('guardians', guardianId)
    if (!guardian || guardian.isDeleted)
      throw new Error(GUARDIAN_ERRORS.NOT_FOUND)
    if (contactType === 'phone') validatePhone(value)
    if (isPrimary)
      await clearPrimaryGuardianContacts(ctx, guardianId, contactType)
    return await ctx.db.insert('guardianContacts', {
      guardianId,
      contactType,
      value,
      isPrimary,
      notes,
      isDeleted: false,
    })
  },
})

export const updateGuardianContact = mutation({
  args: {
    requesterId: v.id('catechists'),
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
  handler: async (
    ctx,
    { requesterId, contactId, contactType, value, isPrimary, notes },
  ) => {
    const contact = await ctx.db.get('guardianContacts', contactId)
    if (!contact || contact.isDeleted)
      throw new Error(GUARDIAN_ERRORS.CONTACT_NOT_FOUND)
    await assertEditGuardianPermission(ctx, requesterId, contact.guardianId)
    if (contactType === 'phone') validatePhone(value)
    if (isPrimary)
      await clearPrimaryGuardianContacts(
        ctx,
        contact.guardianId,
        contactType,
        contactId,
      )
    await ctx.db.patch('guardianContacts', contactId, {
      contactType,
      value,
      isPrimary,
      notes,
    })
  },
})

export const deleteGuardianContact = mutation({
  args: {
    requesterId: v.id('catechists'),
    contactId: v.id('guardianContacts'),
  },
  handler: async (ctx, { requesterId, contactId }) => {
    const contact = await ctx.db.get('guardianContacts', contactId)
    if (!contact || contact.isDeleted)
      throw new Error(GUARDIAN_ERRORS.CONTACT_NOT_FOUND)
    await assertEditGuardianPermission(ctx, requesterId, contact.guardianId)
    await ctx.db.patch('guardianContacts', contactId, { isDeleted: true })
  },
})

export const linkGuardianToStudent = mutation({
  args: {
    requesterId: v.id('catechists'),
    studentId: v.id('students'),
    guardianId: v.id('guardians'),
    relationship: v.string(),
    contactPriority: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (
    ctx,
    {
      requesterId,
      studentId,
      guardianId,
      relationship,
      contactPriority,
      notes,
    },
  ) => {
    await assertEditStudentPermission(ctx, requesterId, studentId)
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
    requesterId: v.id('catechists'),
    linkId: v.id('studentGuardians'),
    relationship: v.string(),
    contactPriority: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { requesterId, linkId, relationship, contactPriority, notes },
  ) => {
    const link = await ctx.db.get('studentGuardians', linkId)
    if (!link || link.isDeleted) throw new Error(GUARDIAN_ERRORS.LINK_NOT_FOUND)
    await assertEditStudentPermission(ctx, requesterId, link.studentId)
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
    requesterId: v.id('catechists'),
    linkId: v.id('studentGuardians'),
  },
  handler: async (ctx, { requesterId, linkId }) => {
    const link = await ctx.db.get('studentGuardians', linkId)
    if (!link || link.isDeleted) throw new Error(GUARDIAN_ERRORS.LINK_NOT_FOUND)
    await assertEditStudentPermission(ctx, requesterId, link.studentId)
    await ctx.db.patch('studentGuardians', linkId, { isDeleted: true })
  },
})

export const findByPhone = query({
  args: {
    requesterId: v.id('catechists'),
    phone: v.string(),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)

    // Use collect() instead of unique() — by_value indexes only the value string,
    // not contactType, so the same E.164 number may appear as both phone and zalo.
    const contacts = await ctx.db
      .query('guardianContacts')
      .withIndex('by_value', (q) => q.eq('value', args.phone))
      .collect()

    const contact = contacts.find(
      (c) => !c.isDeleted && c.contactType === 'phone',
    )

    if (!contact) {
      return null
    }

    const guardian = await ctx.db.get('guardians', contact.guardianId)
    if (!guardian || guardian.isDeleted) {
      return null
    }

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
    requesterId: v.id('catechists'),
    studentId: v.id('students'),
  },
  handler: async (ctx, { requesterId, studentId }) => {
    await assertValidCatechist(ctx, requesterId)
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
  },
})
