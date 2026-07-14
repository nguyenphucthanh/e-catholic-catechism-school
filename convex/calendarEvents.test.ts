/// <reference types="vite/client" />

/* eslint-disable no-shadow */

import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'
import { ACADEMIC_YEAR_ERRORS } from './lib/errors'
import type { Id } from './_generated/dataModel'

const modules = import.meta.glob('./**/*.ts')

// ─── Shared seed helpers ──────────────────────────────────────────────────────

function seedAdmin(ctx: any): Promise<Id<'catechists'>> {
  return ctx.db.insert('catechists', {
    memberId: 'ADMIN',
    fullName: 'Admin User',
    role: 'admin',
    isActive: true,
    isDeleted: false,
  })
}

function seedCatechist(
  ctx: any,
  memberId: string,
  fullName: string,
  opts: { isActive?: boolean; isDeleted?: boolean } = {},
): Promise<Id<'catechists'>> {
  return ctx.db.insert('catechists', {
    memberId,
    fullName,
    role: 'user',
    isActive: opts.isActive ?? true,
    isDeleted: opts.isDeleted ?? false,
  })
}

function seedActiveYear(
  ctx: any,
  name = '2024-2025',
): Promise<Id<'academicYears'>> {
  return ctx.db.insert('academicYears', {
    name,
    startDate: '2024-09-01',
    endDate: '2025-05-31',
    timezone: 'Asia/Ho_Chi_Minh',
    isActive: true,
    isDeleted: false,
  })
}

function seedInactiveYear(
  ctx: any,
  name = '2023-2024',
): Promise<Id<'academicYears'>> {
  return ctx.db.insert('academicYears', {
    name,
    startDate: '2023-09-01',
    endDate: '2024-05-31',
    timezone: 'Asia/Ho_Chi_Minh',
    isActive: false,
    isDeleted: false,
  })
}

function seedBranch(
  ctx: any,
  name: string,
  sortOrder: number,
  opts: { isDeleted?: boolean } = {},
): Promise<Id<'branches'>> {
  return ctx.db.insert('branches', {
    name,
    sortOrder,
    isDeleted: opts.isDeleted ?? false,
  })
}

function seedClass(
  ctx: any,
  branchId: Id<'branches'>,
  name: string,
): Promise<Id<'classes'>> {
  return ctx.db.insert('classes', {
    branchId,
    name,
    isDeleted: false,
  })
}

function seedClassYear(
  ctx: any,
  classId: Id<'classes'>,
  academicYearId: Id<'academicYears'>,
  opts: { isDeleted?: boolean } = {},
): Promise<Id<'classYears'>> {
  return ctx.db.insert('classYears', {
    classId,
    academicYearId,
    isDeleted: opts.isDeleted ?? false,
  })
}

function makeBranchHead(
  ctx: any,
  catechistId: Id<'catechists'>,
  academicYearId: Id<'academicYears'>,
  branchId: Id<'branches'>,
): Promise<Id<'branchAssignments'>> {
  return ctx.db.insert('branchAssignments', {
    academicYearId,
    catechistId,
    branchId,
    isDeleted: false,
  })
}

function makeClassCatechist(
  ctx: any,
  catechistId: Id<'catechists'>,
  classYearId: Id<'classYears'>,
  academicYearId: Id<'academicYears'>,
  role: 'homeroom' | 'co_teacher' = 'homeroom',
): Promise<Id<'classCatechists'>> {
  return ctx.db.insert('classCatechists', {
    catechistId,
    classYearId,
    academicYearId,
    role,
    isDeleted: false,
  })
}

// Common fixture: an active year with a branch and a class year under it.
async function seedYearBranchClass(ctx: any) {
  const yearId = await seedActiveYear(ctx)
  const branchId = await seedBranch(ctx, 'Ấu Nhi', 1)
  const classId = await seedClass(ctx, branchId, 'Lớp Ấu Nhi 1A')
  const classYearId = await seedClassYear(ctx, classId, yearId)
  return { yearId, branchId, classYearId }
}

const baseEventFields = {
  date: '2024-12-25',
  description: 'Serialized Tiptap JSON',
  severity: 'medium' as const,
}

// ─── create ────────────────────────────────────────────────────────────────

describe('create', () => {
  test('admin creates a board-scoped event', async () => {
    const t = convexTest(schema, modules)

    const { adminId, yearId } = await t.run(async (ctx) => {
      const adminId = await seedAdmin(ctx)
      const yearId = await seedActiveYear(ctx)
      return { adminId, yearId }
    })

    const eventId = await t.mutation(api.calendarEvents.create, {
      requesterId: adminId,
      academicYearId: yearId,
      scope: 'board',
      ...baseEventFields,
    })

    const event = await t.run(async (ctx) =>
      ctx.db.get('calendarEvents', eventId),
    )
    expect(event?.scope).toBe('board')
    expect(event?.createdBy).toBe(adminId)
    expect(event?.isDeleted).toBe(false)
    expect(event?.branchId).toBeUndefined()
    expect(event?.classYearId).toBeUndefined()
  })

  test('branch head creates a branch-scoped event for their own branch', async () => {
    const t = convexTest(schema, modules)

    const { catechistId, yearId, branchId } = await t.run(async (ctx) => {
      const catechistId = await seedCatechist(ctx, 'GLV01', 'Branch Head')
      const { yearId, branchId } = await seedYearBranchClass(ctx)
      await makeBranchHead(ctx, catechistId, yearId, branchId)
      return { catechistId, yearId, branchId }
    })

    const eventId = await t.mutation(api.calendarEvents.create, {
      requesterId: catechistId,
      academicYearId: yearId,
      scope: 'branch',
      branchId,
      ...baseEventFields,
    })

    const event = await t.run(async (ctx) =>
      ctx.db.get('calendarEvents', eventId),
    )
    expect(event?.scope).toBe('branch')
    expect(event?.branchId).toBe(branchId)
  })

  test('class catechist creates a class-scoped event for their own class', async () => {
    const t = convexTest(schema, modules)

    const { catechistId, yearId, classYearId } = await t.run(async (ctx) => {
      const catechistId = await seedCatechist(ctx, 'GLV02', 'Class Catechist')
      const { yearId, classYearId } = await seedYearBranchClass(ctx)
      await makeClassCatechist(ctx, catechistId, classYearId, yearId)
      return { catechistId, yearId, classYearId }
    })

    const eventId = await t.mutation(api.calendarEvents.create, {
      requesterId: catechistId,
      academicYearId: yearId,
      scope: 'class',
      classYearId,
      ...baseEventFields,
    })

    const event = await t.run(async (ctx) =>
      ctx.db.get('calendarEvents', eventId),
    )
    expect(event?.scope).toBe('class')
    expect(event?.classYearId).toBe(classYearId)
  })

  test('rejects catechist with zero assignments (NOT_ASSIGNED)', async () => {
    const t = convexTest(schema, modules)

    const { catechistId, yearId } = await t.run(async (ctx) => {
      const catechistId = await seedCatechist(ctx, 'GLV03', 'No Assignment')
      const yearId = await seedActiveYear(ctx)
      return { catechistId, yearId }
    })

    await expect(
      t.mutation(api.calendarEvents.create, {
        requesterId: catechistId,
        academicYearId: yearId,
        scope: 'board',
        ...baseEventFields,
      }),
    ).rejects.toThrow('CALENDAR_EVENT_NOT_ASSIGNED')
  })

  test('rejects catechist with an assignment at the wrong scope (UNAUTHORIZED)', async () => {
    const t = convexTest(schema, modules)

    const { catechistId, yearId } = await t.run(async (ctx) => {
      const catechistId = await seedCatechist(ctx, 'GLV04', 'Branch Head Only')
      const { yearId, branchId } = await seedYearBranchClass(ctx)
      await makeBranchHead(ctx, catechistId, yearId, branchId)
      return { catechistId, yearId, branchId }
    })

    // Branch head tries to create a board-scoped event
    await expect(
      t.mutation(api.calendarEvents.create, {
        requesterId: catechistId,
        academicYearId: yearId,
        scope: 'board',
        ...baseEventFields,
      }),
    ).rejects.toThrow('CALENDAR_EVENT_UNAUTHORIZED')
  })

  test('rejects branch head creating an event for a different branch', async () => {
    const t = convexTest(schema, modules)

    const { catechistId, yearId, otherBranchId } = await t.run(async (ctx) => {
      const catechistId = await seedCatechist(ctx, 'GLV05', 'Branch Head')
      const { yearId, branchId } = await seedYearBranchClass(ctx)
      await makeBranchHead(ctx, catechistId, yearId, branchId)
      const otherBranchId = await seedBranch(ctx, 'Thiếu Nhi', 2)
      return { catechistId, yearId, otherBranchId }
    })

    await expect(
      t.mutation(api.calendarEvents.create, {
        requesterId: catechistId,
        academicYearId: yearId,
        scope: 'branch',
        branchId: otherBranchId,
        ...baseEventFields,
      }),
    ).rejects.toThrow('CALENDAR_EVENT_UNAUTHORIZED')
  })

  test('rejects creation when the academic year does not exist', async () => {
    const t = convexTest(schema, modules)

    const { adminId, missingYearId } = await t.run(async (ctx) => {
      const adminId = await seedAdmin(ctx)
      const id = await ctx.db.insert('academicYears', {
        name: 'Ghost',
        startDate: '2020-01-01',
        endDate: '2020-12-31',
        timezone: 'UTC',
        isActive: true,
        isDeleted: false,
      })
      await ctx.db.delete('academicYears', id)
      return { adminId, missingYearId: id }
    })

    await expect(
      t.mutation(api.calendarEvents.create, {
        requesterId: adminId,
        academicYearId: missingYearId,
        scope: 'board',
        ...baseEventFields,
      }),
    ).rejects.toThrow(ACADEMIC_YEAR_ERRORS.NOT_FOUND)
  })

  test('rejects creation on an inactive academic year', async () => {
    const t = convexTest(schema, modules)

    const { adminId, yearId } = await t.run(async (ctx) => {
      const adminId = await seedAdmin(ctx)
      const yearId = await seedInactiveYear(ctx)
      return { adminId, yearId }
    })

    await expect(
      t.mutation(api.calendarEvents.create, {
        requesterId: adminId,
        academicYearId: yearId,
        scope: 'board',
        ...baseEventFields,
      }),
    ).rejects.toThrow('CALENDAR_EVENT_INACTIVE_ACADEMIC_YEAR')
  })

  test('rejects branch scope missing branchId (INVALID_SCOPE)', async () => {
    const t = convexTest(schema, modules)

    const { adminId, yearId } = await t.run(async (ctx) => {
      const adminId = await seedAdmin(ctx)
      const yearId = await seedActiveYear(ctx)
      return { adminId, yearId }
    })

    await expect(
      t.mutation(api.calendarEvents.create, {
        requesterId: adminId,
        academicYearId: yearId,
        scope: 'branch',
        ...baseEventFields,
      }),
    ).rejects.toThrow('CALENDAR_EVENT_INVALID_SCOPE')
  })

  test('rejects branch scope with classYearId also set (INVALID_SCOPE)', async () => {
    const t = convexTest(schema, modules)

    const { adminId, yearId, branchId, classYearId } = await t.run(
      async (ctx) => {
        const adminId = await seedAdmin(ctx)
        const { yearId, branchId, classYearId } = await seedYearBranchClass(ctx)
        return { adminId, yearId, branchId, classYearId }
      },
    )

    await expect(
      t.mutation(api.calendarEvents.create, {
        requesterId: adminId,
        academicYearId: yearId,
        scope: 'branch',
        branchId,
        classYearId,
        ...baseEventFields,
      }),
    ).rejects.toThrow('CALENDAR_EVENT_INVALID_SCOPE')
  })

  test('rejects class scope missing classYearId (INVALID_SCOPE)', async () => {
    const t = convexTest(schema, modules)

    const { adminId, yearId } = await t.run(async (ctx) => {
      const adminId = await seedAdmin(ctx)
      const yearId = await seedActiveYear(ctx)
      return { adminId, yearId }
    })

    await expect(
      t.mutation(api.calendarEvents.create, {
        requesterId: adminId,
        academicYearId: yearId,
        scope: 'class',
        ...baseEventFields,
      }),
    ).rejects.toThrow('CALENDAR_EVENT_INVALID_SCOPE')
  })

  test('rejects board scope with branchId set (INVALID_SCOPE)', async () => {
    const t = convexTest(schema, modules)

    const { adminId, yearId, branchId } = await t.run(async (ctx) => {
      const adminId = await seedAdmin(ctx)
      const { yearId, branchId } = await seedYearBranchClass(ctx)
      return { adminId, yearId, branchId }
    })

    await expect(
      t.mutation(api.calendarEvents.create, {
        requesterId: adminId,
        academicYearId: yearId,
        scope: 'board',
        branchId,
        ...baseEventFields,
      }),
    ).rejects.toThrow('CALENDAR_EVENT_INVALID_SCOPE')
  })

  test('rejects when branch does not exist (BRANCH_NOT_FOUND)', async () => {
    const t = convexTest(schema, modules)

    const { adminId, yearId, missingBranchId } = await t.run(async (ctx) => {
      const adminId = await seedAdmin(ctx)
      const yearId = await seedActiveYear(ctx)
      const id = await seedBranch(ctx, 'Ghost', 99)
      await ctx.db.delete('branches', id)
      return { adminId, yearId, missingBranchId: id }
    })

    await expect(
      t.mutation(api.calendarEvents.create, {
        requesterId: adminId,
        academicYearId: yearId,
        scope: 'branch',
        branchId: missingBranchId,
        ...baseEventFields,
      }),
    ).rejects.toThrow('CALENDAR_EVENT_BRANCH_NOT_FOUND')
  })

  test('rejects when branch is soft-deleted (BRANCH_NOT_FOUND)', async () => {
    const t = convexTest(schema, modules)

    const { adminId, yearId, deletedBranchId } = await t.run(async (ctx) => {
      const adminId = await seedAdmin(ctx)
      const yearId = await seedActiveYear(ctx)
      const deletedBranchId = await seedBranch(ctx, 'Deleted', 1, {
        isDeleted: true,
      })
      return { adminId, yearId, deletedBranchId }
    })

    await expect(
      t.mutation(api.calendarEvents.create, {
        requesterId: adminId,
        academicYearId: yearId,
        scope: 'branch',
        branchId: deletedBranchId,
        ...baseEventFields,
      }),
    ).rejects.toThrow('CALENDAR_EVENT_BRANCH_NOT_FOUND')
  })

  test('rejects when class year does not exist (CLASS_YEAR_NOT_FOUND)', async () => {
    const t = convexTest(schema, modules)

    const { adminId, yearId, missingClassYearId } = await t.run(async (ctx) => {
      const adminId = await seedAdmin(ctx)
      const { yearId } = await seedYearBranchClass(ctx)
      const branchId = await seedBranch(ctx, 'Ghost Branch', 50)
      const classId = await seedClass(ctx, branchId, 'Ghost Class')
      const id = await seedClassYear(ctx, classId, yearId)
      await ctx.db.delete('classYears', id)
      return { adminId, yearId, missingClassYearId: id }
    })

    await expect(
      t.mutation(api.calendarEvents.create, {
        requesterId: adminId,
        academicYearId: yearId,
        scope: 'class',
        classYearId: missingClassYearId,
        ...baseEventFields,
      }),
    ).rejects.toThrow('CALENDAR_EVENT_CLASS_YEAR_NOT_FOUND')
  })

  test('rejects when class year belongs to a different academic year (CLASS_YEAR_NOT_FOUND)', async () => {
    const t = convexTest(schema, modules)

    const { adminId, activeYearId, classYearId } = await t.run(async (ctx) => {
      const adminId = await seedAdmin(ctx)
      const activeYearId = await seedActiveYear(ctx, '2024-2025')
      const otherYearId = await seedInactiveYear(ctx, '2023-2024')
      const branchId = await seedBranch(ctx, 'Test', 1)
      const classId = await seedClass(ctx, branchId, 'Lớp Mismatched')
      const classYearId = await seedClassYear(ctx, classId, otherYearId)
      return { adminId, activeYearId, classYearId }
    })

    await expect(
      t.mutation(api.calendarEvents.create, {
        requesterId: adminId,
        academicYearId: activeYearId,
        scope: 'class',
        classYearId,
        ...baseEventFields,
      }),
    ).rejects.toThrow('CALENDAR_EVENT_CLASS_YEAR_NOT_FOUND')
  })
})

// ─── update ────────────────────────────────────────────────────────────────

describe('update', () => {
  test('admin can update any event', async () => {
    const t = convexTest(schema, modules)

    const { adminId, eventId } = await t.run(async (ctx) => {
      const adminId = await seedAdmin(ctx)
      const otherId = await seedCatechist(ctx, 'GLV10', 'Owner')
      const yearId = await seedActiveYear(ctx)
      const eventId = await ctx.db.insert('calendarEvents', {
        academicYearId: yearId,
        scope: 'board',
        createdBy: otherId,
        createdAt: Date.now(),
        isDeleted: false,
        ...baseEventFields,
      })
      return { adminId, yearId, eventId }
    })

    await t.mutation(api.calendarEvents.update, {
      requesterId: adminId,
      id: eventId,
      description: 'Updated description',
    })

    const event = await t.run(async (ctx) =>
      ctx.db.get('calendarEvents', eventId),
    )
    expect(event?.description).toBe('Updated description')
    expect(event?.updatedBy).toBe(adminId)
    expect(event?.updatedAt).toBeDefined()
  })

  test('owner can update even without a current matching assignment', async () => {
    const t = convexTest(schema, modules)

    const { ownerId, eventId } = await t.run(async (ctx) => {
      const ownerId = await seedCatechist(ctx, 'GLV11', 'Owner')
      const { yearId, branchId } = await seedYearBranchClass(ctx)
      // Owner created the event as branch head, but assignment was later removed
      const eventId = await ctx.db.insert('calendarEvents', {
        academicYearId: yearId,
        scope: 'branch',
        branchId,
        createdBy: ownerId,
        createdAt: Date.now(),
        isDeleted: false,
        ...baseEventFields,
      })
      return { ownerId, eventId }
    })

    await t.mutation(api.calendarEvents.update, {
      requesterId: ownerId,
      id: eventId,
      description: 'Owner edit without assignment',
    })

    const event = await t.run(async (ctx) =>
      ctx.db.get('calendarEvents', eventId),
    )
    expect(event?.description).toBe('Owner edit without assignment')
  })

  test('peer holding the same-scope assignment can update', async () => {
    const t = convexTest(schema, modules)

    const { peerId, eventId } = await t.run(async (ctx) => {
      const ownerId = await seedCatechist(ctx, 'GLV12', 'Owner')
      const peerId = await seedCatechist(ctx, 'GLV13', 'Peer')
      const { yearId, branchId } = await seedYearBranchClass(ctx)
      await makeBranchHead(ctx, ownerId, yearId, branchId)
      await makeBranchHead(ctx, peerId, yearId, branchId)
      const eventId = await ctx.db.insert('calendarEvents', {
        academicYearId: yearId,
        scope: 'branch',
        branchId,
        createdBy: ownerId,
        createdAt: Date.now(),
        isDeleted: false,
        ...baseEventFields,
      })
      return { peerId, eventId }
    })

    await t.mutation(api.calendarEvents.update, {
      requesterId: peerId,
      id: eventId,
      description: 'Peer edit',
    })

    const event = await t.run(async (ctx) =>
      ctx.db.get('calendarEvents', eventId),
    )
    expect(event?.description).toBe('Peer edit')
  })

  test('rejects a catechist without the matching scope assignment and not the owner', async () => {
    const t = convexTest(schema, modules)

    const { strangerId, eventId } = await t.run(async (ctx) => {
      const ownerId = await seedCatechist(ctx, 'GLV14', 'Owner')
      const strangerId = await seedCatechist(ctx, 'GLV15', 'Stranger')
      const { yearId, branchId } = await seedYearBranchClass(ctx)
      await makeBranchHead(ctx, ownerId, yearId, branchId)
      const eventId = await ctx.db.insert('calendarEvents', {
        academicYearId: yearId,
        scope: 'branch',
        branchId,
        createdBy: ownerId,
        createdAt: Date.now(),
        isDeleted: false,
        ...baseEventFields,
      })
      return { strangerId, eventId }
    })

    await expect(
      t.mutation(api.calendarEvents.update, {
        requesterId: strangerId,
        id: eventId,
        description: 'Should fail',
      }),
    ).rejects.toThrow('CALENDAR_EVENT_UNAUTHORIZED')
  })

  test('rejects update on an inactive academic year', async () => {
    const t = convexTest(schema, modules)

    const { adminId, eventId } = await t.run(async (ctx) => {
      const adminId = await seedAdmin(ctx)
      const yearId = await seedInactiveYear(ctx)
      const eventId = await ctx.db.insert('calendarEvents', {
        academicYearId: yearId,
        scope: 'board',
        createdBy: adminId,
        createdAt: Date.now(),
        isDeleted: false,
        ...baseEventFields,
      })
      return { adminId, eventId }
    })

    await expect(
      t.mutation(api.calendarEvents.update, {
        requesterId: adminId,
        id: eventId,
        description: 'Should fail',
      }),
    ).rejects.toThrow('CALENDAR_EVENT_INACTIVE_ACADEMIC_YEAR')
  })

  test('rejects updating a non-existent event (NOT_FOUND)', async () => {
    const t = convexTest(schema, modules)

    const { adminId, missingId } = await t.run(async (ctx) => {
      const adminId = await seedAdmin(ctx)
      const yearId = await seedActiveYear(ctx)
      const id = await ctx.db.insert('calendarEvents', {
        academicYearId: yearId,
        scope: 'board',
        createdBy: adminId,
        createdAt: Date.now(),
        isDeleted: false,
        ...baseEventFields,
      })
      await ctx.db.delete('calendarEvents', id)
      return { adminId, missingId: id }
    })

    await expect(
      t.mutation(api.calendarEvents.update, {
        requesterId: adminId,
        id: missingId,
        description: 'Should fail',
      }),
    ).rejects.toThrow('CALENDAR_EVENT_NOT_FOUND')
  })

  test('rejects updating an already soft-deleted event (NOT_FOUND)', async () => {
    const t = convexTest(schema, modules)

    const { adminId, eventId } = await t.run(async (ctx) => {
      const adminId = await seedAdmin(ctx)
      const yearId = await seedActiveYear(ctx)
      const eventId = await ctx.db.insert('calendarEvents', {
        academicYearId: yearId,
        scope: 'board',
        createdBy: adminId,
        createdAt: Date.now(),
        isDeleted: true,
        ...baseEventFields,
      })
      return { adminId, eventId }
    })

    await expect(
      t.mutation(api.calendarEvents.update, {
        requesterId: adminId,
        id: eventId,
        description: 'Should fail',
      }),
    ).rejects.toThrow('CALENDAR_EVENT_NOT_FOUND')
  })
})

// ─── remove ────────────────────────────────────────────────────────────────

describe('remove', () => {
  test('admin can soft-delete any event', async () => {
    const t = convexTest(schema, modules)

    const { adminId, eventId } = await t.run(async (ctx) => {
      const adminId = await seedAdmin(ctx)
      const otherId = await seedCatechist(ctx, 'GLV20', 'Owner')
      const yearId = await seedActiveYear(ctx)
      const eventId = await ctx.db.insert('calendarEvents', {
        academicYearId: yearId,
        scope: 'board',
        createdBy: otherId,
        createdAt: Date.now(),
        isDeleted: false,
        ...baseEventFields,
      })
      return { adminId, eventId }
    })

    await t.mutation(api.calendarEvents.remove, {
      requesterId: adminId,
      id: eventId,
    })

    const event = await t.run(async (ctx) =>
      ctx.db.get('calendarEvents', eventId),
    )
    expect(event?.isDeleted).toBe(true)
    expect(event?.updatedBy).toBe(adminId)
  })

  test('owner can remove their own event', async () => {
    const t = convexTest(schema, modules)

    const { ownerId, eventId } = await t.run(async (ctx) => {
      const ownerId = await seedCatechist(ctx, 'GLV21', 'Owner')
      const yearId = await seedActiveYear(ctx)
      const eventId = await ctx.db.insert('calendarEvents', {
        academicYearId: yearId,
        scope: 'board',
        createdBy: ownerId,
        createdAt: Date.now(),
        isDeleted: false,
        ...baseEventFields,
      })
      return { ownerId, eventId }
    })

    await t.mutation(api.calendarEvents.remove, {
      requesterId: ownerId,
      id: eventId,
    })

    const event = await t.run(async (ctx) =>
      ctx.db.get('calendarEvents', eventId),
    )
    expect(event?.isDeleted).toBe(true)
  })

  test('peer holding the same class-scope assignment can remove', async () => {
    const t = convexTest(schema, modules)

    const { peerId, eventId } = await t.run(async (ctx) => {
      const ownerId = await seedCatechist(ctx, 'GLV22', 'Owner')
      const peerId = await seedCatechist(ctx, 'GLV23', 'Peer')
      const { yearId, classYearId } = await seedYearBranchClass(ctx)
      await makeClassCatechist(ctx, ownerId, classYearId, yearId, 'homeroom')
      await makeClassCatechist(ctx, peerId, classYearId, yearId, 'co_teacher')
      const eventId = await ctx.db.insert('calendarEvents', {
        academicYearId: yearId,
        scope: 'class',
        classYearId,
        createdBy: ownerId,
        createdAt: Date.now(),
        isDeleted: false,
        ...baseEventFields,
      })
      return { peerId, eventId }
    })

    await t.mutation(api.calendarEvents.remove, {
      requesterId: peerId,
      id: eventId,
    })

    const event = await t.run(async (ctx) =>
      ctx.db.get('calendarEvents', eventId),
    )
    expect(event?.isDeleted).toBe(true)
  })

  test('rejects removal by a catechist with no matching scope and not the owner', async () => {
    const t = convexTest(schema, modules)

    const { strangerId, eventId } = await t.run(async (ctx) => {
      const ownerId = await seedCatechist(ctx, 'GLV24', 'Owner')
      const strangerId = await seedCatechist(ctx, 'GLV25', 'Stranger')
      const { yearId, classYearId } = await seedYearBranchClass(ctx)
      await makeClassCatechist(ctx, ownerId, classYearId, yearId, 'homeroom')
      const eventId = await ctx.db.insert('calendarEvents', {
        academicYearId: yearId,
        scope: 'class',
        classYearId,
        createdBy: ownerId,
        createdAt: Date.now(),
        isDeleted: false,
        ...baseEventFields,
      })
      return { strangerId, eventId }
    })

    await expect(
      t.mutation(api.calendarEvents.remove, {
        requesterId: strangerId,
        id: eventId,
      }),
    ).rejects.toThrow('CALENDAR_EVENT_UNAUTHORIZED')
  })

  test('rejects removal on an inactive academic year', async () => {
    const t = convexTest(schema, modules)

    const { adminId, eventId } = await t.run(async (ctx) => {
      const adminId = await seedAdmin(ctx)
      const yearId = await seedInactiveYear(ctx)
      const eventId = await ctx.db.insert('calendarEvents', {
        academicYearId: yearId,
        scope: 'board',
        createdBy: adminId,
        createdAt: Date.now(),
        isDeleted: false,
        ...baseEventFields,
      })
      return { adminId, eventId }
    })

    await expect(
      t.mutation(api.calendarEvents.remove, {
        requesterId: adminId,
        id: eventId,
      }),
    ).rejects.toThrow('CALENDAR_EVENT_INACTIVE_ACADEMIC_YEAR')
  })

  test('rejects removing a non-existent event (NOT_FOUND)', async () => {
    const t = convexTest(schema, modules)

    const { adminId, missingId } = await t.run(async (ctx) => {
      const adminId = await seedAdmin(ctx)
      const yearId = await seedActiveYear(ctx)
      const id = await ctx.db.insert('calendarEvents', {
        academicYearId: yearId,
        scope: 'board',
        createdBy: adminId,
        createdAt: Date.now(),
        isDeleted: false,
        ...baseEventFields,
      })
      await ctx.db.delete('calendarEvents', id)
      return { adminId, missingId: id }
    })

    await expect(
      t.mutation(api.calendarEvents.remove, {
        requesterId: adminId,
        id: missingId,
      }),
    ).rejects.toThrow('CALENDAR_EVENT_NOT_FOUND')
  })

  test('rejects removing an already soft-deleted event (NOT_FOUND)', async () => {
    const t = convexTest(schema, modules)

    const { adminId, eventId } = await t.run(async (ctx) => {
      const adminId = await seedAdmin(ctx)
      const yearId = await seedActiveYear(ctx)
      const eventId = await ctx.db.insert('calendarEvents', {
        academicYearId: yearId,
        scope: 'board',
        createdBy: adminId,
        createdAt: Date.now(),
        isDeleted: true,
        ...baseEventFields,
      })
      return { adminId, eventId }
    })

    await expect(
      t.mutation(api.calendarEvents.remove, {
        requesterId: adminId,
        id: eventId,
      }),
    ).rejects.toThrow('CALENDAR_EVENT_NOT_FOUND')
  })
})

// ─── list ──────────────────────────────────────────────────────────────────

describe('list', () => {
  test('board events are visible to everyone', async () => {
    const t = convexTest(schema, modules)

    const { requesterId, yearId } = await t.run(async (ctx) => {
      const requesterId = await seedCatechist(ctx, 'GLV30', 'No Assignment')
      const yearId = await seedActiveYear(ctx)
      const adminId = await seedAdmin(ctx)
      await ctx.db.insert('calendarEvents', {
        academicYearId: yearId,
        scope: 'board',
        createdBy: adminId,
        createdAt: Date.now(),
        isDeleted: false,
        ...baseEventFields,
      })
      return { requesterId, yearId }
    })

    const result = await t.query(api.calendarEvents.list, {
      requesterId,
      academicYearId: yearId,
      dateFrom: '2024-01-01',
      dateTo: '2024-12-31',
    })

    expect(result).toHaveLength(1)
    expect(result[0].scope).toBe('board')
  })

  test('branch events are only visible to catechists assigned to that branch', async () => {
    const t = convexTest(schema, modules)

    const { assignedId, unassignedId, yearId } = await t.run(async (ctx) => {
      const assignedId = await seedCatechist(ctx, 'GLV31', 'Branch Head')
      const unassignedId = await seedCatechist(ctx, 'GLV32', 'Other')
      const adminId = await seedAdmin(ctx)
      const { yearId, branchId } = await seedYearBranchClass(ctx)
      await makeBranchHead(ctx, assignedId, yearId, branchId)
      await ctx.db.insert('calendarEvents', {
        academicYearId: yearId,
        scope: 'branch',
        branchId,
        createdBy: adminId,
        createdAt: Date.now(),
        isDeleted: false,
        ...baseEventFields,
      })
      return { assignedId, unassignedId, yearId }
    })

    const assignedResult = await t.query(api.calendarEvents.list, {
      requesterId: assignedId,
      academicYearId: yearId,
      dateFrom: '2024-01-01',
      dateTo: '2024-12-31',
    })
    expect(assignedResult).toHaveLength(1)

    const unassignedResult = await t.query(api.calendarEvents.list, {
      requesterId: unassignedId,
      academicYearId: yearId,
      dateFrom: '2024-01-01',
      dateTo: '2024-12-31',
    })
    expect(unassignedResult).toHaveLength(0)
  })

  test('class events are only visible to catechists assigned to that class', async () => {
    const t = convexTest(schema, modules)

    const { assignedId, unassignedId, yearId } = await t.run(async (ctx) => {
      const assignedId = await seedCatechist(ctx, 'GLV33', 'Class Catechist')
      const unassignedId = await seedCatechist(ctx, 'GLV34', 'Other')
      const adminId = await seedAdmin(ctx)
      const { yearId, classYearId } = await seedYearBranchClass(ctx)
      await makeClassCatechist(ctx, assignedId, classYearId, yearId)
      await ctx.db.insert('calendarEvents', {
        academicYearId: yearId,
        scope: 'class',
        classYearId,
        createdBy: adminId,
        createdAt: Date.now(),
        isDeleted: false,
        ...baseEventFields,
      })
      return { assignedId, unassignedId, yearId }
    })

    const assignedResult = await t.query(api.calendarEvents.list, {
      requesterId: assignedId,
      academicYearId: yearId,
      dateFrom: '2024-01-01',
      dateTo: '2024-12-31',
    })
    expect(assignedResult).toHaveLength(1)

    const unassignedResult = await t.query(api.calendarEvents.list, {
      requesterId: unassignedId,
      academicYearId: yearId,
      dateFrom: '2024-01-01',
      dateTo: '2024-12-31',
    })
    expect(unassignedResult).toHaveLength(0)
  })

  test('admin sees all events regardless of scope', async () => {
    const t = convexTest(schema, modules)

    const { adminId, yearId } = await t.run(async (ctx) => {
      const adminId = await seedAdmin(ctx)
      const { yearId, branchId, classYearId } = await seedYearBranchClass(ctx)

      await ctx.db.insert('calendarEvents', {
        academicYearId: yearId,
        scope: 'board',
        createdBy: adminId,
        createdAt: Date.now(),
        isDeleted: false,
        ...baseEventFields,
      })
      await ctx.db.insert('calendarEvents', {
        academicYearId: yearId,
        scope: 'branch',
        branchId,
        createdBy: adminId,
        createdAt: Date.now(),
        isDeleted: false,
        ...baseEventFields,
      })
      await ctx.db.insert('calendarEvents', {
        academicYearId: yearId,
        scope: 'class',
        classYearId,
        createdBy: adminId,
        createdAt: Date.now(),
        isDeleted: false,
        ...baseEventFields,
      })

      return { adminId, yearId }
    })

    const result = await t.query(api.calendarEvents.list, {
      requesterId: adminId,
      academicYearId: yearId,
      dateFrom: '2024-01-01',
      dateTo: '2024-12-31',
    })

    expect(result).toHaveLength(3)
  })

  test('excludes soft-deleted events', async () => {
    const t = convexTest(schema, modules)

    const { adminId, yearId } = await t.run(async (ctx) => {
      const adminId = await seedAdmin(ctx)
      const yearId = await seedActiveYear(ctx)
      await ctx.db.insert('calendarEvents', {
        academicYearId: yearId,
        scope: 'board',
        createdBy: adminId,
        createdAt: Date.now(),
        isDeleted: true,
        ...baseEventFields,
      })
      return { adminId, yearId }
    })

    const result = await t.query(api.calendarEvents.list, {
      requesterId: adminId,
      academicYearId: yearId,
      dateFrom: '2024-01-01',
      dateTo: '2024-12-31',
    })

    expect(result).toHaveLength(0)
  })

  test('excludes events outside the requested date range', async () => {
    const t = convexTest(schema, modules)

    const { adminId, yearId } = await t.run(async (ctx) => {
      const adminId = await seedAdmin(ctx)
      const yearId = await seedActiveYear(ctx)
      await ctx.db.insert('calendarEvents', {
        academicYearId: yearId,
        scope: 'board',
        createdBy: adminId,
        createdAt: Date.now(),
        isDeleted: false,
        date: '2023-01-01',
        description: baseEventFields.description,
        severity: baseEventFields.severity,
      })
      return { adminId, yearId }
    })

    const result = await t.query(api.calendarEvents.list, {
      requesterId: adminId,
      academicYearId: yearId,
      dateFrom: '2024-01-01',
      dateTo: '2024-12-31',
    })

    expect(result).toHaveLength(0)
  })

  test('board event has null branchName and null className, plus createdByName', async () => {
    const t = convexTest(schema, modules)

    const { adminId, yearId } = await t.run(async (ctx) => {
      const adminId = await seedAdmin(ctx)
      const yearId = await seedActiveYear(ctx)
      await ctx.db.insert('calendarEvents', {
        academicYearId: yearId,
        scope: 'board',
        createdBy: adminId,
        createdAt: Date.now(),
        isDeleted: false,
        ...baseEventFields,
      })
      return { adminId, yearId }
    })

    const result = await t.query(api.calendarEvents.list, {
      requesterId: adminId,
      academicYearId: yearId,
      dateFrom: '2024-01-01',
      dateTo: '2024-12-31',
    })

    expect(result).toHaveLength(1)
    expect(result[0].branchName).toBeNull()
    expect(result[0].className).toBeNull()
    expect(result[0].createdByName).toBe('Admin User')
    expect(result[0].updatedByName).toBeNull()
  })

  test('branch event has branchName set and className null', async () => {
    const t = convexTest(schema, modules)

    const { adminId, yearId } = await t.run(async (ctx) => {
      const adminId = await seedAdmin(ctx)
      const { yearId, branchId } = await seedYearBranchClass(ctx)
      await ctx.db.insert('calendarEvents', {
        academicYearId: yearId,
        scope: 'branch',
        branchId,
        createdBy: adminId,
        createdAt: Date.now(),
        isDeleted: false,
        ...baseEventFields,
      })
      return { adminId, yearId }
    })

    const result = await t.query(api.calendarEvents.list, {
      requesterId: adminId,
      academicYearId: yearId,
      dateFrom: '2024-01-01',
      dateTo: '2024-12-31',
    })

    expect(result).toHaveLength(1)
    expect(result[0].branchName).toBe('Ấu Nhi')
    expect(result[0].className).toBeNull()
  })

  test('class event has className set and branchName null', async () => {
    const t = convexTest(schema, modules)

    const { adminId, yearId } = await t.run(async (ctx) => {
      const adminId = await seedAdmin(ctx)
      const { yearId, classYearId } = await seedYearBranchClass(ctx)
      await ctx.db.insert('calendarEvents', {
        academicYearId: yearId,
        scope: 'class',
        classYearId,
        createdBy: adminId,
        createdAt: Date.now(),
        isDeleted: false,
        ...baseEventFields,
      })
      return { adminId, yearId }
    })

    const result = await t.query(api.calendarEvents.list, {
      requesterId: adminId,
      academicYearId: yearId,
      dateFrom: '2024-01-01',
      dateTo: '2024-12-31',
    })

    expect(result).toHaveLength(1)
    expect(result[0].className).toBe('Lớp Ấu Nhi 1A')
    expect(result[0].branchName).toBeNull()
  })

  test('updatedByName is set after an update and null before', async () => {
    const t = convexTest(schema, modules)

    const { adminId, editorId, yearId, eventId } = await t.run(async (ctx) => {
      const adminId = await seedAdmin(ctx)
      const editorId = await seedCatechist(ctx, 'GLV50', 'Editor')
      const yearId = await seedActiveYear(ctx)
      const eventId = await ctx.db.insert('calendarEvents', {
        academicYearId: yearId,
        scope: 'board',
        createdBy: adminId,
        createdAt: Date.now(),
        isDeleted: false,
        ...baseEventFields,
      })
      return { adminId, editorId, yearId, eventId }
    })

    const before = await t.query(api.calendarEvents.list, {
      requesterId: adminId,
      academicYearId: yearId,
      dateFrom: '2024-01-01',
      dateTo: '2024-12-31',
    })
    expect(before[0].updatedByName).toBeNull()

    await t.run(async (ctx) => {
      await ctx.db.patch('calendarEvents', eventId, {
        updatedBy: editorId,
        updatedAt: Date.now(),
      })
    })

    const after = await t.query(api.calendarEvents.list, {
      requesterId: adminId,
      academicYearId: yearId,
      dateFrom: '2024-01-01',
      dateTo: '2024-12-31',
    })
    expect(after[0].updatedByName).toBe('Editor')
  })

  test('gracefully falls back when referenced branch, class, or catechist docs are missing', async () => {
    const t = convexTest(schema, modules)

    const { adminId, yearId } = await t.run(async (ctx) => {
      const adminId = await seedAdmin(ctx)
      const yearId = await seedActiveYear(ctx)

      const ghostBranchId = await seedBranch(ctx, 'Ghost Branch', 99)
      await ctx.db.delete('branches', ghostBranchId)

      const branchId = await seedBranch(ctx, 'Real Branch', 1)
      const classId = await seedClass(ctx, branchId, 'Ghost Class')
      const ghostClassYearId = await seedClassYear(ctx, classId, yearId)
      await ctx.db.delete('classYears', ghostClassYearId)

      const ghostCatechistId = await seedCatechist(ctx, 'GLV60', 'Ghost')
      await ctx.db.delete('catechists', ghostCatechistId)

      await ctx.db.insert('calendarEvents', {
        academicYearId: yearId,
        scope: 'branch',
        branchId: ghostBranchId,
        createdBy: ghostCatechistId,
        createdAt: Date.now(),
        isDeleted: false,
        ...baseEventFields,
      })
      await ctx.db.insert('calendarEvents', {
        academicYearId: yearId,
        scope: 'class',
        classYearId: ghostClassYearId,
        createdBy: adminId,
        createdAt: Date.now(),
        isDeleted: false,
        ...baseEventFields,
      })

      return { adminId, yearId }
    })

    const result = await t.query(api.calendarEvents.list, {
      requesterId: adminId,
      academicYearId: yearId,
      dateFrom: '2024-01-01',
      dateTo: '2024-12-31',
    })

    expect(result).toHaveLength(2)
    const branchEvent = result.find((e) => e.scope === 'branch')
    const classEvent = result.find((e) => e.scope === 'class')
    expect(branchEvent?.branchName).toBeNull()
    expect(branchEvent?.createdByName).toBe('')
    expect(classEvent?.className).toBeNull()
  })

  test('falls back to null className when class doc is missing, and null updatedByName when updater doc is missing', async () => {
    const t = convexTest(schema, modules)

    const { adminId, yearId } = await t.run(async (ctx) => {
      const adminId = await seedAdmin(ctx)
      const yearId = await seedActiveYear(ctx)

      const branchId = await seedBranch(ctx, 'Branch', 1)
      const ghostClassId = await seedClass(ctx, branchId, 'Ghost Class')
      const classYearId = await seedClassYear(ctx, ghostClassId, yearId)
      await ctx.db.delete('classes', ghostClassId)

      const ghostUpdaterId = await seedCatechist(ctx, 'GLV61', 'Ghost Updater')
      await ctx.db.delete('catechists', ghostUpdaterId)

      await ctx.db.insert('calendarEvents', {
        academicYearId: yearId,
        scope: 'class',
        classYearId,
        createdBy: adminId,
        createdAt: Date.now(),
        updatedBy: ghostUpdaterId,
        updatedAt: Date.now(),
        isDeleted: false,
        ...baseEventFields,
      })

      return { adminId, yearId }
    })

    const result = await t.query(api.calendarEvents.list, {
      requesterId: adminId,
      academicYearId: yearId,
      dateFrom: '2024-01-01',
      dateTo: '2024-12-31',
    })

    expect(result).toHaveLength(1)
    expect(result[0].className).toBeNull()
    expect(result[0].updatedByName).toBeNull()
  })
})

// ─── get ───────────────────────────────────────────────────────────────────

describe('get', () => {
  test('returns a board event for any requester', async () => {
    const t = convexTest(schema, modules)

    const { requesterId, eventId } = await t.run(async (ctx) => {
      const requesterId = await seedCatechist(ctx, 'GLV40', 'No Assignment')
      const adminId = await seedAdmin(ctx)
      const yearId = await seedActiveYear(ctx)
      const eventId = await ctx.db.insert('calendarEvents', {
        academicYearId: yearId,
        scope: 'board',
        createdBy: adminId,
        createdAt: Date.now(),
        isDeleted: false,
        ...baseEventFields,
      })
      return { requesterId, eventId }
    })

    const result = await t.query(api.calendarEvents.get, {
      requesterId,
      id: eventId,
    })

    expect(result?._id).toBe(eventId)
  })

  test('returns null for a non-existent event', async () => {
    const t = convexTest(schema, modules)

    const { requesterId, missingId } = await t.run(async (ctx) => {
      const requesterId = await seedAdmin(ctx)
      const yearId = await seedActiveYear(ctx)
      const id = await ctx.db.insert('calendarEvents', {
        academicYearId: yearId,
        scope: 'board',
        createdBy: requesterId,
        createdAt: Date.now(),
        isDeleted: false,
        ...baseEventFields,
      })
      await ctx.db.delete('calendarEvents', id)
      return { requesterId, missingId: id }
    })

    const result = await t.query(api.calendarEvents.get, {
      requesterId,
      id: missingId,
    })

    expect(result).toBeNull()
  })

  test('returns null for a soft-deleted event', async () => {
    const t = convexTest(schema, modules)

    const { requesterId, eventId } = await t.run(async (ctx) => {
      const requesterId = await seedAdmin(ctx)
      const yearId = await seedActiveYear(ctx)
      const eventId = await ctx.db.insert('calendarEvents', {
        academicYearId: yearId,
        scope: 'board',
        createdBy: requesterId,
        createdAt: Date.now(),
        isDeleted: true,
        ...baseEventFields,
      })
      return { requesterId, eventId }
    })

    const result = await t.query(api.calendarEvents.get, {
      requesterId,
      id: eventId,
    })

    expect(result).toBeNull()
  })

  test('returns null for a branch event the requester cannot see', async () => {
    const t = convexTest(schema, modules)

    const { requesterId, eventId } = await t.run(async (ctx) => {
      const requesterId = await seedCatechist(ctx, 'GLV41', 'Unassigned')
      const adminId = await seedAdmin(ctx)
      const { yearId, branchId } = await seedYearBranchClass(ctx)
      const eventId = await ctx.db.insert('calendarEvents', {
        academicYearId: yearId,
        scope: 'branch',
        branchId,
        createdBy: adminId,
        createdAt: Date.now(),
        isDeleted: false,
        ...baseEventFields,
      })
      return { requesterId, eventId }
    })

    const result = await t.query(api.calendarEvents.get, {
      requesterId,
      id: eventId,
    })

    expect(result).toBeNull()
  })

  test('returns a branch event for a catechist assigned to that branch', async () => {
    const t = convexTest(schema, modules)

    const { requesterId, eventId } = await t.run(async (ctx) => {
      const requesterId = await seedCatechist(ctx, 'GLV42', 'Branch Head')
      const adminId = await seedAdmin(ctx)
      const { yearId, branchId } = await seedYearBranchClass(ctx)
      await makeBranchHead(ctx, requesterId, yearId, branchId)
      const eventId = await ctx.db.insert('calendarEvents', {
        academicYearId: yearId,
        scope: 'branch',
        branchId,
        createdBy: adminId,
        createdAt: Date.now(),
        isDeleted: false,
        ...baseEventFields,
      })
      return { requesterId, eventId }
    })

    const result = await t.query(api.calendarEvents.get, {
      requesterId,
      id: eventId,
    })

    expect(result?._id).toBe(eventId)
  })

  test('returns a class event for a catechist assigned to that class', async () => {
    const t = convexTest(schema, modules)

    const { requesterId, eventId } = await t.run(async (ctx) => {
      const requesterId = await seedCatechist(ctx, 'GLV43', 'Class Catechist')
      const adminId = await seedAdmin(ctx)
      const { yearId, classYearId } = await seedYearBranchClass(ctx)
      await makeClassCatechist(ctx, requesterId, classYearId, yearId)
      const eventId = await ctx.db.insert('calendarEvents', {
        academicYearId: yearId,
        scope: 'class',
        classYearId,
        createdBy: adminId,
        createdAt: Date.now(),
        isDeleted: false,
        ...baseEventFields,
      })
      return { requesterId, eventId }
    })

    const result = await t.query(api.calendarEvents.get, {
      requesterId,
      id: eventId,
    })

    expect(result?._id).toBe(eventId)
  })

  test('admin can see any event regardless of scope', async () => {
    const t = convexTest(schema, modules)

    const { adminId, eventId } = await t.run(async (ctx) => {
      const adminId = await seedAdmin(ctx)
      const { yearId, classYearId } = await seedYearBranchClass(ctx)
      const eventId = await ctx.db.insert('calendarEvents', {
        academicYearId: yearId,
        scope: 'class',
        classYearId,
        createdBy: adminId,
        createdAt: Date.now(),
        isDeleted: false,
        ...baseEventFields,
      })
      return { adminId, eventId }
    })

    const result = await t.query(api.calendarEvents.get, {
      requesterId: adminId,
      id: eventId,
    })

    expect(result?._id).toBe(eventId)
  })
})

// ─── myScopes ──────────────────────────────────────────────────────────────

describe('myScopes', () => {
  test('admin gets isAdmin true with board true and null branch/class ids', async () => {
    const t = convexTest(schema, modules)

    const { adminId, yearId } = await t.run(async (ctx) => {
      const adminId = await seedAdmin(ctx)
      const yearId = await seedActiveYear(ctx)
      return { adminId, yearId }
    })

    const result = await t.query(api.calendarEvents.myScopes, {
      requesterId: adminId,
      academicYearId: yearId,
    })

    expect(result).toEqual({
      isAdmin: true,
      board: true,
      branchIds: null,
      classYearIds: null,
    })
  })

  test('non-admin board member gets board true with empty branch/class ids', async () => {
    const t = convexTest(schema, modules)

    const { catechistId, yearId } = await t.run(async (ctx) => {
      const catechistId = await seedCatechist(ctx, 'GLV70', 'Board Member')
      const yearId = await seedActiveYear(ctx)
      await ctx.db.insert('academicYearAssignments', {
        academicYearId: yearId,
        catechistId,
        assignmentType: 'board_member',
        isDeleted: false,
      })
      return { catechistId, yearId }
    })

    const result = await t.query(api.calendarEvents.myScopes, {
      requesterId: catechistId,
      academicYearId: yearId,
    })

    expect(result).toEqual({
      isAdmin: false,
      board: true,
      branchIds: [],
      classYearIds: [],
    })
  })

  test('non-admin branch head gets their branchIds', async () => {
    const t = convexTest(schema, modules)

    const { catechistId, yearId, branchId } = await t.run(async (ctx) => {
      const catechistId = await seedCatechist(ctx, 'GLV71', 'Branch Head')
      const { yearId, branchId } = await seedYearBranchClass(ctx)
      await makeBranchHead(ctx, catechistId, yearId, branchId)
      return { catechistId, yearId, branchId }
    })

    const result = await t.query(api.calendarEvents.myScopes, {
      requesterId: catechistId,
      academicYearId: yearId,
    })

    expect(result).toEqual({
      isAdmin: false,
      board: false,
      branchIds: [branchId],
      classYearIds: [],
    })
  })

  test('non-admin class-assigned catechist gets their classYearIds', async () => {
    const t = convexTest(schema, modules)

    const { catechistId, yearId, classYearId } = await t.run(async (ctx) => {
      const catechistId = await seedCatechist(ctx, 'GLV72', 'Class Catechist')
      const { yearId, classYearId } = await seedYearBranchClass(ctx)
      await makeClassCatechist(ctx, catechistId, classYearId, yearId)
      return { catechistId, yearId, classYearId }
    })

    const result = await t.query(api.calendarEvents.myScopes, {
      requesterId: catechistId,
      academicYearId: yearId,
    })

    expect(result).toEqual({
      isAdmin: false,
      board: false,
      branchIds: [],
      classYearIds: [classYearId],
    })
  })

  test('requester with no assignment gets all-false/empty', async () => {
    const t = convexTest(schema, modules)

    const { catechistId, yearId } = await t.run(async (ctx) => {
      const catechistId = await seedCatechist(ctx, 'GLV73', 'No Assignment')
      const yearId = await seedActiveYear(ctx)
      return { catechistId, yearId }
    })

    const result = await t.query(api.calendarEvents.myScopes, {
      requesterId: catechistId,
      academicYearId: yearId,
    })

    expect(result).toEqual({
      isAdmin: false,
      board: false,
      branchIds: [],
      classYearIds: [],
    })
  })
})
