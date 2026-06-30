import { v } from 'convex/values'
import { mutation, query } from './_generated/server'

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
      .collect()
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
    const { contactId, ...fields } = args
    await ctx.db.patch('catechistContacts', contactId, fields)
  },
})

export const deleteContact = mutation({
  args: { contactId: v.id('catechistContacts') },
  handler: async (ctx, args) => {
    await ctx.db.delete('catechistContacts', args.contactId)
  },
})
