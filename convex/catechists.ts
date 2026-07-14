import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  assertAdminRole,
  assertValidCatechist,
  getEffectivePermissions,
} from './lib/authz'
import { nextCounter } from './lib/counter'
import { CATECHIST_ERRORS } from './lib/errors'
import { hashPassword } from './lib/password'
import type { Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'

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
  const allContacts = await ctx.db
    .query('catechistContacts')
    .withIndex('by_catechist_id', (q) => q.eq('catechistId', catechistId))
    .collect()
  const existing = allContacts.filter((c) => !c.isDeleted)

  for (const c of existing) {
    if (c.contactType === contactType && c.isPrimary && c._id !== excludeId) {
      await ctx.db.patch('catechistContacts', c._id, { isPrimary: false })
    }
  }
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export const getMyProfile = query({
  args: {
    requesterId: v.id('catechists'),
    catechistId: v.id('catechists'),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)
    return await ctx.db.get('catechists', args.catechistId)
  },
})

export const getMyAddress = query({
  args: {
    requesterId: v.id('catechists'),
    catechistId: v.id('catechists'),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)
    const address = await ctx.db
      .query('catechistAddresses')
      .withIndex('by_catechist_id', (q) =>
        q.eq('catechistId', args.catechistId),
      )
      .unique()
    return address && !address.isDeleted ? address : null
  },
})

export const getMyContacts = query({
  args: {
    requesterId: v.id('catechists'),
    catechistId: v.id('catechists'),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)
    const contacts = await ctx.db
      .query('catechistContacts')
      .withIndex('by_catechist_id', (q) =>
        q.eq('catechistId', args.catechistId),
      )
      .collect()
    return contacts.filter((c) => !c.isDeleted)
  },
})

export const getClassAssignments = query({
  args: {
    requesterId: v.id('catechists'),
    catechistId: v.id('catechists'),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)

    const assignments = await ctx.db
      .query('classCatechists')
      .withIndex('by_catechist_id', (q) =>
        q.eq('catechistId', args.catechistId),
      )
      .collect()

    const active = assignments.filter((a) => !a.isDeleted)

    const results = await Promise.all(
      active.map(async (assignment) => {
        const classYear = await ctx.db.get('classYears', assignment.classYearId)
        if (!classYear || classYear.isDeleted) return null

        const cls = await ctx.db.get('classes', classYear.classId)
        if (!cls || cls.isDeleted) return null

        const academicYear = await ctx.db.get(
          'academicYears',
          assignment.academicYearId,
        )
        if (!academicYear || academicYear.isDeleted) return null

        const branch = await ctx.db.get('branches', cls.branchId)
        if (!branch || branch.isDeleted) return null

        return {
          _id: assignment._id,
          role: assignment.role,
          classYearId: assignment.classYearId,
          classId: classYear.classId,
          className: cls.name,
          branchId: cls.branchId,
          branchName: branch.name,
          academicYearId: assignment.academicYearId,
          academicYearName: academicYear.name,
        }
      }),
    )

    return results.filter((r): r is NonNullable<typeof r> => r !== null)
  },
})

const catechistFilterArgs = {
  name: v.optional(v.string()),
  gender: v.optional(v.union(v.literal('male'), v.literal('female'))),
  isActive: v.optional(v.boolean()),
  branchId: v.optional(v.id('branches')),
  academicYearId: v.optional(v.id('academicYears')),
  sortBy: v.optional(
    v.union(
      v.literal('memberId'),
      v.literal('saintName'),
      v.literal('fullName'),
      v.literal('gender'),
      v.literal('isActive'),
      v.literal('joinedDate'),
      v.literal('_creationTime'),
    ),
  ),
  sortOrder: v.optional(v.union(v.literal('asc'), v.literal('desc'))),
}

async function filterAndSortCatechists(
  ctx: QueryCtx | MutationCtx,
  args: {
    name?: string
    gender?: 'male' | 'female'
    isActive?: boolean
    branchId?: Id<'branches'>
    academicYearId?: Id<'academicYears'>
    sortBy?:
      | 'memberId'
      | 'saintName'
      | 'fullName'
      | 'gender'
      | 'isActive'
      | 'joinedDate'
      | '_creationTime'
    sortOrder?: 'asc' | 'desc'
  },
) {
  let eligibleCatechistIds: Set<Id<'catechists'>> | null = null

  if (args.branchId && args.academicYearId) {
    const assignments = await ctx.db
      .query('branchAssignments')
      .withIndex('by_academic_year_id_and_branch_id', (q) =>
        q
          .eq('academicYearId', args.academicYearId!)
          .eq('branchId', args.branchId!),
      )
      .collect()
    const activeAssignments = assignments.filter((a) => !a.isDeleted)
    eligibleCatechistIds = new Set(activeAssignments.map((a) => a.catechistId))
  }

  const catechists = await ctx.db
    .query('catechists')
    .withIndex('by_is_deleted', (q) => q.eq('isDeleted', false))
    .collect()

  const nameQuery = args.name?.trim().toLowerCase()

  const filtered = catechists.filter((c) => {
    if (eligibleCatechistIds && !eligibleCatechistIds.has(c._id)) return false
    if (args.isActive !== undefined && c.isActive !== args.isActive)
      return false
    if (args.gender && c.gender !== args.gender) return false
    if (nameQuery) {
      const fullNameMatch = c.fullName.toLowerCase().includes(nameQuery)
      const saintNameMatch =
        c.saintName?.toLowerCase().includes(nameQuery) ?? false
      if (!fullNameMatch && !saintNameMatch) return false
    }
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

  return filtered
}

export const list = query({
  args: {
    requesterId: v.id('catechists'),
    paginationOpts: paginationOptsValidator,
    ...catechistFilterArgs,
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)

    const filtered = await filterAndSortCatechists(ctx, args)

    const cursor = args.paginationOpts.cursor
    const startIndex = cursor ? Number(cursor) : 0
    const numItems = args.paginationOpts.numItems
    const page = filtered.slice(startIndex, startIndex + numItems)
    const isDone = startIndex + numItems >= filtered.length

    return {
      page,
      isDone,
      continueCursor: isDone ? '' : String(startIndex + numItems),
    }
  },
})

async function getActiveAcademicYearId(
  ctx: QueryCtx | MutationCtx,
): Promise<Id<'academicYears'> | null> {
  const activeYears = await ctx.db
    .query('academicYears')
    .withIndex('by_is_deleted', (q) => q.eq('isDeleted', false))
    .collect()
  const activeYear = activeYears.find((y) => y.isActive)
  return activeYear ? activeYear._id : null
}

export const exportList = query({
  args: {
    requesterId: v.id('catechists'),
    ...catechistFilterArgs,
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)

    // Board-member status is checked against the true active year, not a
    // client-supplied one — matches the trust boundary students.ts uses.
    const activeYearId = await getActiveAcademicYearId(ctx)
    const perms = await getEffectivePermissions(
      ctx,
      args.requesterId,
      activeYearId ?? undefined,
    )
    if (!perms.isAdmin && !perms.isBoardMember) {
      throw new Error(CATECHIST_ERRORS.EXPORT_UNAUTHORIZED)
    }

    const filtered = await filterAndSortCatechists(ctx, args)

    return Promise.all(
      filtered.map(async (c) => {
        const addresses = await ctx.db
          .query('catechistAddresses')
          .withIndex('by_catechist_id', (q) => q.eq('catechistId', c._id))
          .collect()
        const address = addresses.find((a) => !a.isDeleted)

        const contacts = await ctx.db
          .query('catechistContacts')
          .withIndex('by_catechist_id', (q) => q.eq('catechistId', c._id))
          .collect()
        const activeContacts = contacts.filter((ct) => !ct.isDeleted)
        const primaryPhone = activeContacts.find(
          (ct) => ct.contactType === 'phone' && ct.isPrimary,
        )?.value
        const primaryEmail = activeContacts.find(
          (ct) => ct.contactType === 'email' && ct.isPrimary,
        )?.value

        return {
          memberId: c.memberId,
          saintName: c.saintName,
          fullName: c.fullName,
          gender: c.gender,
          dateOfBirth: c.dateOfBirth,
          role: c.role,
          isActive: c.isActive,
          joinedDate: c.joinedDate,
          title: c.title,
          community: c.community,
          level: c.level,
          notes: c.notes,
          addressLine1: address?.addressLine1,
          addressLine2: address?.addressLine2,
          city: address?.city,
          stateProvince: address?.stateProvince,
          postalCode: address?.postalCode,
          country: address?.country,
          hamlet: address?.hamlet,
          subHamlet: address?.subHamlet,
          primaryPhone,
          primaryEmail,
        }
      }),
    )
  },
})

export const get = query({
  args: { requesterId: v.id('catechists'), catechistId: v.id('catechists') },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)
    const catechist = await ctx.db.get('catechists', args.catechistId)
    if (!catechist || catechist.isDeleted) return null

    const addr = await ctx.db
      .query('catechistAddresses')
      .withIndex('by_catechist_id', (q) =>
        q.eq('catechistId', args.catechistId),
      )
      .unique()
    const address = addr && !addr.isDeleted ? addr : null

    const allContacts = await ctx.db
      .query('catechistContacts')
      .withIndex('by_catechist_id', (q) =>
        q.eq('catechistId', args.catechistId),
      )
      .collect()
    const contacts = allContacts.filter((c) => !c.isDeleted)

    return { ...catechist, address, contacts }
  },
})

// ─── Mutations ────────────────────────────────────────────────────────────────

export const updateMyProfile = mutation({
  args: {
    requesterId: v.id('catechists'),
    catechistId: v.id('catechists'),
    fullName: v.string(),
    saintName: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    gender: v.optional(v.union(v.literal('male'), v.literal('female'))),
    joinedDate: v.optional(v.string()),
    notes: v.optional(v.string()),
    title: v.optional(v.string()),
    community: v.optional(v.string()),
    level: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const requester = await assertValidCatechist(ctx, args.requesterId)
    if (args.requesterId !== args.catechistId && requester.role !== 'admin') {
      throw new Error('Unauthorized: You can only update your own profile')
    }
    const { requesterId, catechistId, ...fields } = args
    await ctx.db.patch('catechists', catechistId, fields)
  },
})

export const upsertMyAddress = mutation({
  args: {
    requesterId: v.id('catechists'),
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
    const requester = await assertValidCatechist(ctx, args.requesterId)
    if (args.requesterId !== args.catechistId && requester.role !== 'admin') {
      throw new Error('Unauthorized: You can only update your own address')
    }
    const { requesterId, catechistId, ...fields } = args
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

const contactArgs = {
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
}

export const addContact = mutation({
  args: {
    requesterId: v.id('catechists'),
    catechistId: v.id('catechists'),
    ...contactArgs,
  },
  handler: async (ctx, args) => {
    const requester = await assertValidCatechist(ctx, args.requesterId)
    if (args.requesterId !== args.catechistId && requester.role !== 'admin') {
      throw new Error(
        'Unauthorized: You can only add contacts to your own profile',
      )
    }
    if (args.contactType === 'phone') {
      validatePhone(args.value)
    }
    if (args.isPrimary) {
      await clearPrimaryContacts(ctx, args.catechistId, args.contactType)
    }
    const { requesterId: _r, ...contactFields } = args
    return await ctx.db.insert('catechistContacts', {
      ...contactFields,
      isDeleted: false,
    })
  },
})

export const updateContact = mutation({
  args: {
    requesterId: v.id('catechists'),
    contactId: v.id('catechistContacts'),
    ...contactArgs,
  },
  handler: async (ctx, args) => {
    const requester = await assertValidCatechist(ctx, args.requesterId)
    const contact = await ctx.db.get('catechistContacts', args.contactId)
    if (!contact || contact.isDeleted) {
      throw new Error(CATECHIST_ERRORS.CONTACT_NOT_FOUND)
    }
    if (
      args.requesterId !== contact.catechistId &&
      requester.role !== 'admin'
    ) {
      throw new Error('Unauthorized: You can only update your own contacts')
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
    const { contactId, requesterId, ...fields } = args
    await ctx.db.patch('catechistContacts', contactId, fields)
  },
})

export const deleteContact = mutation({
  args: {
    requesterId: v.id('catechists'),
    contactId: v.id('catechistContacts'),
  },
  handler: async (ctx, args) => {
    const requester = await assertValidCatechist(ctx, args.requesterId)
    const contact = await ctx.db.get('catechistContacts', args.contactId)
    if (!contact || contact.isDeleted) {
      throw new Error(CATECHIST_ERRORS.CONTACT_NOT_FOUND)
    }
    if (
      args.requesterId !== contact.catechistId &&
      requester.role !== 'admin'
    ) {
      throw new Error('Unauthorized: You can only delete your own contacts')
    }
    await ctx.db.patch('catechistContacts', args.contactId, { isDeleted: true })
  },
})

type CatechistCoreFields = {
  fullName: string
  saintName?: string
  dateOfBirth?: string
  gender?: 'male' | 'female'
  role: 'admin' | 'user'
  joinedDate?: string
  notes?: string
  title?: string
  community?: string
  level?: string
  profilePhotoStorageId?: Id<'_storage'>
}

async function insertCatechistRecord(
  ctx: MutationCtx,
  fields: CatechistCoreFields,
): Promise<Id<'catechists'>> {
  const memberId = (await nextCounter(ctx, 'catechist')).toString()
  const catechistId = await ctx.db.insert('catechists', {
    ...fields,
    memberId,
    isActive: true,
    isDeleted: false,
  })

  const loginId = `CAT-${memberId}`
  await ctx.db.insert('accounts', {
    loginId,
    passwordHash: hashPassword(loginId),
    accountType: 'catechist',
    userRefId: catechistId,
    isActive: true,
    createdAt: Date.now(),
    isDeleted: false,
  })

  return catechistId
}

export const create = mutation({
  args: {
    requesterId: v.id('catechists'),
    fullName: v.string(),
    saintName: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    gender: v.optional(v.union(v.literal('male'), v.literal('female'))),
    role: v.union(v.literal('admin'), v.literal('user')),
    joinedDate: v.optional(v.string()),
    notes: v.optional(v.string()),
    title: v.optional(v.string()),
    community: v.optional(v.string()),
    level: v.optional(v.string()),
    profilePhotoStorageId: v.optional(v.id('_storage')),
  },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx, args.requesterId)
    const { requesterId, ...fields } = args
    return insertCatechistRecord(ctx, fields)
  },
})

export const createWithDetails = mutation({
  args: {
    requesterId: v.id('catechists'),
    fullName: v.string(),
    saintName: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    gender: v.optional(v.union(v.literal('male'), v.literal('female'))),
    role: v.union(v.literal('admin'), v.literal('user')),
    joinedDate: v.optional(v.string()),
    notes: v.optional(v.string()),
    title: v.optional(v.string()),
    community: v.optional(v.string()),
    level: v.optional(v.string()),
    profilePhotoStorageId: v.optional(v.id('_storage')),
    address: v.optional(
      v.object({
        country: v.string(),
        addressLine1: v.optional(v.string()),
        addressLine2: v.optional(v.string()),
        city: v.optional(v.string()),
        stateProvince: v.optional(v.string()),
        postalCode: v.optional(v.string()),
        hamlet: v.optional(v.string()),
        subHamlet: v.optional(v.string()),
      }),
    ),
    contacts: v.optional(v.array(v.object(contactArgs))),
  },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx, args.requesterId)
    const { requesterId, address, contacts, ...fields } = args

    if (contacts) {
      for (const contact of contacts) {
        if (contact.contactType === 'phone') {
          validatePhone(contact.value)
        }
      }
    }

    const catechistId = await insertCatechistRecord(ctx, fields)

    if (address) {
      await ctx.db.insert('catechistAddresses', {
        catechistId,
        ...address,
        isDeleted: false,
      })
    }

    if (contacts) {
      // Last contact with isPrimary:true per type wins — matches addContact semantics
      const lastPrimaryIndex = new Map<string, number>()
      contacts.forEach((c, i) => {
        if (c.isPrimary) lastPrimaryIndex.set(c.contactType, i)
      })
      await Promise.all(
        contacts.map((contact, i) =>
          ctx.db.insert('catechistContacts', {
            catechistId,
            ...contact,
            isPrimary: lastPrimaryIndex.get(contact.contactType) === i,
            isDeleted: false,
          }),
        ),
      )
    }

    return catechistId
  },
})

export const update = mutation({
  args: {
    requesterId: v.id('catechists'),
    catechistId: v.id('catechists'),
    fullName: v.optional(v.string()),
    saintName: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    gender: v.optional(v.union(v.literal('male'), v.literal('female'))),
    role: v.optional(v.union(v.literal('admin'), v.literal('user'))),
    isActive: v.optional(v.boolean()),
    joinedDate: v.optional(v.string()),
    notes: v.optional(v.string()),
    title: v.optional(v.string()),
    community: v.optional(v.string()),
    level: v.optional(v.string()),
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
    const addresses = await ctx.db
      .query('catechistAddresses')
      .withIndex('by_catechist_id', (q) =>
        q.eq('catechistId', args.catechistId),
      )
      .collect()
    const address = addresses.find((a) => !a.isDeleted) ?? null
    if (!address) {
      throw new Error(CATECHIST_ERRORS.ADDRESS_NOT_FOUND)
    }
    await ctx.db.patch('catechistAddresses', address._id, { isDeleted: true })
  },
})

// ─── Photo Upload ─────────────────────────────────────────────────────────────

export const updateProfilePhoto = mutation({
  args: {
    requesterId: v.id('catechists'),
    catechistId: v.id('catechists'),
    storageId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    const requester = await assertValidCatechist(ctx, args.requesterId)
    if (args.requesterId !== args.catechistId && requester.role !== 'admin') {
      throw new Error(
        'Unauthorized: You can only update your own profile photo',
      )
    }
    await ctx.db.patch('catechists', args.catechistId, {
      profilePhotoStorageId: args.storageId,
    })
  },
})

export const deleteProfilePhoto = mutation({
  args: {
    requesterId: v.id('catechists'),
    catechistId: v.id('catechists'),
  },
  handler: async (ctx, args) => {
    const requester = await assertValidCatechist(ctx, args.requesterId)
    if (args.requesterId !== args.catechistId && requester.role !== 'admin') {
      throw new Error(
        'Unauthorized: You can only delete your own profile photo',
      )
    }
    const catechist = await ctx.db.get('catechists', args.catechistId)
    if (!catechist || !catechist.profilePhotoStorageId) return
    await ctx.storage.delete(catechist.profilePhotoStorageId)
    await ctx.db.replace('catechists', args.catechistId, {
      memberId: catechist.memberId,
      fullName: catechist.fullName,
      saintName: catechist.saintName,
      dateOfBirth: catechist.dateOfBirth,
      gender: catechist.gender,
      role: catechist.role,
      isActive: catechist.isActive,
      joinedDate: catechist.joinedDate,
      notes: catechist.notes,
      title: catechist.title,
      community: catechist.community,
      level: catechist.level,
      isDeleted: catechist.isDeleted,
    })
  },
})

export const getProfilePhotoUrl = query({
  args: { catechistId: v.id('catechists') },
  handler: async (ctx, args) => {
    const catechist = await ctx.db.get('catechists', args.catechistId)
    if (!catechist || !catechist.profilePhotoStorageId) return null
    return await ctx.storage.getUrl(catechist.profilePhotoStorageId)
  },
})
