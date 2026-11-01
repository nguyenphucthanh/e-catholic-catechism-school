/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { internal } from './_generated/api'
import schema from './schema'

const modules = import.meta.glob('./**/*.ts')

describe('withdrawDeletedStudentEnrollments', () => {
  test('withdraws non-withdrawn enrollments of deleted students only', async () => {
    const t = convexTest(schema, modules)

    const ids = await t.run(async (ctx) => {
      const branchId = await ctx.db.insert('branches', {
        name: 'Branch',
        sortOrder: 1,
        isDeleted: false,
      })
      const classId = await ctx.db.insert('classes', {
        branchId,
        name: 'Class',
        isDeleted: false,
      })
      const academicYearId = await ctx.db.insert('academicYears', {
        name: '2024-2025',
        startDate: '2024-09-01',
        endDate: '2025-05-31',
        timezone: 'Asia/Ho_Chi_Minh',
        isActive: true,
        isDeleted: false,
      })
      const classYearId = await ctx.db.insert('classYears', {
        classId,
        academicYearId,
        isDeleted: false,
      })
      const enroll = async (
        studentCode: string,
        studentDeleted: boolean,
        status: 'active' | 'on_leave' | 'withdrawn',
      ) => {
        const studentId = await ctx.db.insert('students', {
          fullName: studentCode,
          studentCode,
          isActive: true,
          createdAt: Date.now(),
          isDeleted: studentDeleted,
        })
        return await ctx.db.insert('studentClasses', {
          studentId,
          classYearId,
          enrolledDate: '2024-09-01',
          isPrimaryClass: true,
          status,
          isDeleted: false,
        })
      }
      return {
        deletedOnLeave: await enroll('HS001', true, 'on_leave'),
        deletedWithdrawn: await enroll('HS002', true, 'withdrawn'),
        liveOnLeave: await enroll('HS003', false, 'on_leave'),
      }
    })

    const result = await t.mutation(
      internal.withdrawDeletedStudentEnrollments
        .withdrawDeletedStudentEnrollments,
      {},
    )
    expect(result).toEqual({ deletedStudentCount: 2, withdrawnCount: 1 })

    const rows = await t.run(async (ctx) => ({
      deletedOnLeave: await ctx.db.get('studentClasses', ids.deletedOnLeave),
      deletedWithdrawn: await ctx.db.get(
        'studentClasses',
        ids.deletedWithdrawn,
      ),
      liveOnLeave: await ctx.db.get('studentClasses', ids.liveOnLeave),
    }))
    expect(rows.deletedOnLeave?.status).toBe('withdrawn')
    expect(rows.deletedOnLeave?.leftDate).toBeDefined()
    expect(rows.deletedWithdrawn?.leftDate).toBeUndefined()
    expect(rows.liveOnLeave?.status).toBe('on_leave')
  })
})
