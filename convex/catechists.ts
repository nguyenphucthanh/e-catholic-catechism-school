import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { MutationCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { assertAdminRole, assertValidCatechist } from './lib/authz'
import { nextCounter } from './lib/counter'
import { CATECHIST_ERRORS } from './lib/errors'

const E164_REGEX = /^\+[1-9]\d{6,14}$/

function validatePhone(value: string): void {
  if (!E164_REGEX.test(value)) {
    throw new Error(CATECHIST_ERRORS.INVALID_PHONE)
  }
}

async function clearPrimaryContacts(
  ctx: MutationCtx,
  catechistId: Id<'catechists'>,
  contactType: string,
  excludeId?: Id<'catechistContacts'>,
): Promise<void> {
  const existing = await ctx.db
    .query('catechistContacts')
    .withIndex('by_catechist_id', (q) => q.eq('catechistId', catechistId))
    .filter((q) => q.eq(q.field('isDeleted'), false))
    .collect()

  for (const c of existing) {
    if (c.contactType === contactType && c.isPrimary && c._id !== excludeId) {
      await ctx.db.patch('catechistContacts', c._id, { isPrimary: false })
    }
  }
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export const getMyProfile = query({
  args: { catechistId: v.id('catechists') },
  handler: async (ctx, args) => {
    return await ctx.db.get('catechists', args.catechistId)
  },
})

export const getMyAddress = query({
  args: { catechistId: v.id('catechists') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('catechistAddresses')
      .withIndex('by_catechist_id', (q) =>
        q.eq('catechistId', args.catechistId),
      )
      .filter((q) => q.eq(q.field('isDeleted'), false))
      .unique()
  },
})

export const getMyContacts = query({
  args: { catechistId: v.id('catechists') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('catechistContacts')
      .withIndex('by_catechist_id', (q) =>
        q.eq('catechistId', args.catechistId),
      )
      .filter((q) => q.eq(q.field('isDeleted'), false))
      .collect()
  },
})

export const list = query({
  args: { requesterId: v.id('catechists') },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)
    const catechists = await ctx.db
      .query('catechists')
      .withIndex('by_is_deleted', (q) => q.eq('isDeleted', false))
      .collect()
    return catechists
  },
})

export const get = query({
  args: { requesterId: v.id('catechists'), catechistId: v.id('catechists') },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)
    const catechist = await ctx.db.get('catechists', args.catechistId)
    if (!catechist || catechist.isDeleted) return null

    const address = await ctx.db
      .query('catechistAddresses')
      .withIndex('by_catechist_id', (q) =>
        q.eq('catechistId', args.catechistId),
      )
      .filter((q) => q.eq(q.field('isDeleted'), false))
      .unique()

    const contacts = await ctx.db
      .query('catechistContacts')
      .withIndex('by_catechist_id', (q) =>
        q.eq('catechistId', args.catechistId),
      )
      .filter((q) => q.eq(q.field('isDeleted'), false))
      .collect()

    return { ...catechist, address, contacts }
  },
})

// ─── Mutations ────────────────────────────────────────────────────────────────

export const updateMyProfile = mutation({
  args: {
    catechistId: v.id('catechists'),
    fullName: v.string(),
    saintName: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    gender: v.optional(
      v.union(v.literal('male'), v.literal('female'), v.literal('other')),
    ),
    joinedDate: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { catechistId, ...fields } = args
    await ctx.db.patch('catechists', catechistId, fields)
  },
})

export const upsertMyAddress = mutation({
  args: {
    catechistId: v.id('catechists'),
    country: v.string(),
    addressLine1: v.optional(v.string()),
    addressLine2: v.optional(v.string()),
    city: v.optional(v.string()),
    stateProvince: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    hamlet: v.optional(v.string()),
    subHamlet: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { catechistId, ...fields } = args
    const existing = await ctx.db
      .query('catechistAddresses')
      .withIndex('by_catechist_id', (q) => q.eq('catechistId', catechistId))
      .unique()

    if (existing !== null) {
      await ctx.db.patch('catechistAddresses', existing._id, fields)
    } else {
      await ctx.db.insert('catechistAddresses', {
        catechistId,
        ...fields,
        isDeleted: false,
      })
    }
  },
})

export const addContact = mutation({
  args: {
    catechistId: v.id('catechists'),
    label: v.string(),
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
  handler: async (ctx, args) => {
    if (args.contactType === 'phone') {
      validatePhone(args.value)
    }
    if (args.isPrimary) {
      await clearPrimaryContacts(ctx, args.catechistId, args.contactType)
    }
    return await ctx.db.insert('catechistContacts', {
      ...args,
      isDeleted: false,
    })
  },
})

export const updateContact = mutation({
  args: {
    contactId: v.id('catechistContacts'),
    label: v.string(),
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
  handler: async (ctx, args) => {
    const contact = await ctx.db.get('catechistContacts', args.contactId)
    if (!contact || contact.isDeleted) {
      throw new Error(CATECHIST_ERRORS.CONTACT_NOT_FOUND)
    }
    if (args.contactType === 'phone') {
      validatePhone(args.value)
    }
    if (args.isPrimary) {
      await clearPrimaryContacts(
        ctx,
        contact.catechistId,
        args.contactType,
        args.contactId,
      )
    }
    const { contactId, ...fields } = args
    await ctx.db.patch('catechistContacts', contactId, fields)
  },
})

export const deleteContact = mutation({
  args: { contactId: v.id('catechistContacts') },
  handler: async (ctx, args) => {
    const contact = await ctx.db.get('catechistContacts', args.contactId)
    if (!contact || contact.isDeleted) {
      throw new Error(CATECHIST_ERRORS.CONTACT_NOT_FOUND)
    }
    await ctx.db.patch('catechistContacts', args.contactId, { isDeleted: true })
  },
})

export const create = mutation({
  args: {
    requesterId: v.id('catechists'),
    fullName: v.string(),
    saintName: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    gender: v.optional(
      v.union(v.literal('male'), v.literal('female'), v.literal('other')),
    ),
    role: v.union(v.literal('admin'), v.literal('user')),
    joinedDate: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx, args.requesterId)
    const memberIdNum = await nextCounter(ctx, 'catechist')
    const memberId = memberIdNum.toString()
    const { requesterId, ...fields } = args
    return await ctx.db.insert('catechists', {
      ...fields,
      memberId,
      isActive: true,
      isDeleted: false,
    })
  },
})

export const update = mutation({
  args: {
    requesterId: v.id('catechists'),
    catechistId: v.id('catechists'),
    fullName: v.optional(v.string()),
    saintName: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    gender: v.optional(
      v.union(v.literal('male'), v.literal('female'), v.literal('other')),
    ),
    role: v.optional(v.union(v.literal('admin'), v.literal('user'))),
    isActive: v.optional(v.boolean()),
    joinedDate: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx, args.requesterId)
    const catechist = await ctx.db.get('catechists', args.catechistId)
    if (!catechist || catechist.isDeleted) {
      throw new Error(CATECHIST_ERRORS.NOT_FOUND)
    }
    const { requesterId, catechistId, ...fields } = args
    await ctx.db.patch('catechists', catechistId, fields)
  },
})

export const softDelete = mutation({
  args: {
    requesterId: v.id('catechists'),
    catechistId: v.id('catechists'),
  },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx, args.requesterId)
    const catechist = await ctx.db.get('catechists', args.catechistId)
    if (!catechist || catechist.isDeleted) {
      throw new Error(CATECHIST_ERRORS.NOT_FOUND)
    }
    await ctx.db.patch('catechists', args.catechistId, { isDeleted: true })
  },
})

export const softDeleteAddress = mutation({
  args: {
    requesterId: v.id('catechists'),
    catechistId: v.id('catechists'),
  },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx, args.requesterId)
    const address = await ctx.db
      .query('catechistAddresses')
      .withIndex('by_catechist_id', (q) =>
        q.eq('catechistId', args.catechistId),
      )
      .filter((q) => q.eq(q.field('isDeleted'), false))
      .unique()
    if (!address) {
      throw new Error(CATECHIST_ERRORS.ADDRESS_NOT_FOUND)
    }
    await ctx.db.patch('catechistAddresses', address._id, { isDeleted: true })
  },
})
