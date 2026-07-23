/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { afterEach, describe, expect, test } from 'vitest'
import { internal } from './_generated/api'
import schema from './schema'
import { verifyPassword } from './lib/password'
import type { Id, TableNames } from './_generated/dataModel'

const modules = import.meta.glob('./**/*.ts')

const originalDemoApp = process.env.DEMO_APP

afterEach(() => {
  if (originalDemoApp === undefined) {
    delete process.env.DEMO_APP
  } else {
    process.env.DEMO_APP = originalDemoApp
  }
})

describe('seed: env-gate', () => {
  test('resetDemoData no-ops when DEMO_APP is not "true"', async () => {
    const t = convexTest(schema, modules)
    process.env.DEMO_APP = 'false'

    const result = await t.action(internal.seed.resetDemoData, {})
    expect(result).toEqual({ skipped: true })

    const branches = await t.run(async (ctx) =>
      ctx.db.query('branches').collect(),
    )
    expect(branches).toHaveLength(0)
  })

  test('resetDemoData no-ops when DEMO_APP is undefined', async () => {
    const t = convexTest(schema, modules)
    delete process.env.DEMO_APP

    const result = await t.action(internal.seed.resetDemoData, {})
    expect(result).toEqual({ skipped: true })
  })
})

describe('seed: wipe helpers', () => {
  test('wipeCoreEntitiesAndConfig empties appConfig and counters', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await ctx.db.insert('appConfig', {
        parishName: 'Old Parish',
        dioceseName: 'Old Diocese',
        nameFormat: 'firstName_lastName',
      })
      await ctx.db.insert('counters', { name: 'catechist', value: 99 })
    })

    await t.mutation(internal.seed.wipeCoreEntitiesAndConfig, {})

    const appConfigs = await t.run(async (ctx) =>
      ctx.db.query('appConfig').collect(),
    )
    const counters = await t.run(async (ctx) =>
      ctx.db.query('counters').collect(),
    )
    expect(appConfigs).toHaveLength(0)
    expect(counters).toHaveLength(0)
  })

  test('continueWipeTable clears remaining rows for a given table', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await ctx.db.insert('branches', {
        name: 'Test',
        sortOrder: 1,
        isDeleted: false,
      })
    })

    await t.mutation(internal.seed.continueWipeTable, { table: 'branches' })

    const branches = await t.run(async (ctx) =>
      ctx.db.query('branches').collect(),
    )
    expect(branches).toHaveLength(0)
  })
})

describe('seed: enrollment continuity', () => {
  test('old Ấu Nhi -> current Thiếu Nhi, old Thiếu Nhi -> current Nghĩa Sĩ, old Nghĩa Sĩ has no continuation', async () => {
    const t = convexTest(schema, modules)

    const org = await t.mutation(internal.seed.seedOrgStructure, {})

    const makeStudent = async (bucket: string) =>
      t.run(async (ctx) => {
        const studentId = await ctx.db.insert('students', {
          studentCode: `test-${bucket}-${Math.random()}`,
          fullName: 'Test Student',
          isActive: true,
          isDeleted: false,
          createdAt: Date.now(),
        })
        return studentId
      })

    const oldBranch0Student = await makeStudent('oldBranch0')
    const oldBranch1Student = await makeStudent('oldBranch1')
    const oldBranch2Student = await makeStudent('oldBranch2')
    const currentBranch0Student = await makeStudent('currentBranch0')

    await t.mutation(internal.seed.seedEnrollments, {
      org,
      students: [
        {
          studentId: oldBranch0Student,
          studentCode: 'oldBranch0',
          bucket: 'oldBranch0',
        },
        {
          studentId: oldBranch1Student,
          studentCode: 'oldBranch1',
          bucket: 'oldBranch1',
        },
        {
          studentId: oldBranch2Student,
          studentCode: 'oldBranch2',
          bucket: 'oldBranch2',
        },
        {
          studentId: currentBranch0Student,
          studentCode: 'currentBranch0',
          bucket: 'currentBranch0',
        },
      ],
    })

    const enrollmentsFor = async (studentId: Id<'students'>) =>
      t.run(async (ctx) =>
        ctx.db
          .query('studentClasses')
          .withIndex('by_student_id', (q) => q.eq('studentId', studentId))
          .collect(),
      )

    const oldBranch0Enrollments = await enrollmentsFor(oldBranch0Student)
    expect(oldBranch0Enrollments).toHaveLength(2)
    expect(oldBranch0Enrollments.map((e) => e.classYearId).sort()).toEqual(
      [org.oldClassYearIds[0], org.currentClassYearIds[1]].sort(),
    )

    const oldBranch1Enrollments = await enrollmentsFor(oldBranch1Student)
    expect(oldBranch1Enrollments).toHaveLength(2)
    expect(oldBranch1Enrollments.map((e) => e.classYearId).sort()).toEqual(
      [org.oldClassYearIds[1], org.currentClassYearIds[2]].sort(),
    )

    const oldBranch2Enrollments = await enrollmentsFor(oldBranch2Student)
    expect(oldBranch2Enrollments).toHaveLength(1)
    expect(oldBranch2Enrollments[0].classYearId).toBe(org.oldClassYearIds[2])

    const currentBranch0Enrollments = await enrollmentsFor(
      currentBranch0Student,
    )
    expect(currentBranch0Enrollments).toHaveLength(1)
    expect(currentBranch0Enrollments[0].classYearId).toBe(
      org.currentClassYearIds[0],
    )

    // Every enrollment is primary (each classYearId is a distinct year for the student).
    for (const e of [
      ...oldBranch0Enrollments,
      ...oldBranch1Enrollments,
      ...oldBranch2Enrollments,
      ...currentBranch0Enrollments,
    ]) {
      expect(e.isPrimaryClass).toBe(true)
      expect(e.status).toBe('active')
    }
  })
})

describe('seed: username === password accounts', () => {
  test('catechist account password verifies against its own loginId', async () => {
    const t = convexTest(schema, modules)
    const { hashPassword } = await import('./lib/password')

    const catechistId = await t.run(async (ctx) =>
      ctx.db.insert('catechists', {
        memberId: '1',
        fullName: 'Admin',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      }),
    )

    const loginId = 'CAT-1'
    await t.mutation(internal.seed.seedCatechistAccounts, {
      accounts: [
        {
          userRefId: catechistId,
          loginId,
          passwordHash: hashPassword(loginId),
        },
      ],
    })

    const account = await t.run(async (ctx) =>
      ctx.db
        .query('accounts')
        .withIndex('by_login_id', (q) => q.eq('loginId', loginId))
        .unique(),
    )
    expect(account).not.toBeNull()
    expect(account!.accountType).toBe('catechist')
    const { valid } = await verifyPassword(loginId, account!.passwordHash)
    expect(valid).toBe(true)
  })

  test('student account password verifies against its own loginId', async () => {
    const t = convexTest(schema, modules)
    const { hashPassword } = await import('./lib/password')

    const studentId = await t.run(async (ctx) =>
      ctx.db.insert('students', {
        studentCode: '1',
        fullName: 'Test Student',
        isActive: true,
        isDeleted: false,
        createdAt: Date.now(),
      }),
    )

    const loginId = 'STD-1'
    await t.mutation(internal.seed.seedStudentAccounts, {
      accounts: [
        {
          userRefId: studentId,
          loginId,
          passwordHash: hashPassword(loginId),
        },
      ],
    })

    const account = await t.run(async (ctx) =>
      ctx.db
        .query('accounts')
        .withIndex('by_login_id', (q) => q.eq('loginId', loginId))
        .unique(),
    )
    expect(account).not.toBeNull()
    expect(account!.accountType).toBe('student')
    const { valid } = await verifyPassword(loginId, account!.passwordHash)
    expect(valid).toBe(true)
  })
})

describe('seed: full resetDemoData integration', () => {
  test('seeds the full expected dataset and is idempotent (wipe-then-reseed) on repeat', async () => {
    const t = convexTest(schema, modules)
    process.env.DEMO_APP = 'true'

    const result = await t.action(internal.seed.resetDemoData, {})
    if (result.skipped) throw new Error('expected resetDemoData to run')

    expect(result.catechistCount).toBe(21)
    expect(result.studentCount).toBe(40)
    expect(result.enrollmentCount).toBe(60)
    expect(result.sessionCount).toBe(48)
    expect(result.attendanceRecordCount).toBe(480)
    expect(result.scoreColumnCount).toBe(36)
    expect(result.scoreEntryCount).toBe(360)
    expect(result.calendarEventCount).toBe(20)
    expect(result.extracurricularProgramCount).toBe(3)

    const countOf = async (table: TableNames) =>
      t.run(async (ctx) => (await ctx.db.query(table).collect()).length)

    expect(await countOf('branches')).toBe(3)
    expect(await countOf('academicYears')).toBe(2)
    expect(await countOf('semesters')).toBe(4)
    expect(await countOf('classes')).toBe(3)
    expect(await countOf('classYears')).toBe(6)
    expect(await countOf('catechists')).toBe(21)
    expect(await countOf('students')).toBe(40)
    expect(await countOf('studentAddresses')).toBe(40)
    expect(await countOf('guardians')).toBe(40)
    expect(await countOf('guardianContacts')).toBe(40)
    expect(await countOf('studentGuardians')).toBe(40)
    expect(await countOf('studentClasses')).toBe(60)
    expect(await countOf('academicYearAssignments')).toBe(6)
    expect(await countOf('branchAssignments')).toBe(6)
    expect(await countOf('appConfig')).toBe(1)

    const accounts = await t.run(async (ctx) =>
      ctx.db.query('accounts').collect(),
    )
    expect(accounts.filter((a) => a.accountType === 'catechist')).toHaveLength(
      21,
    )
    expect(accounts.filter((a) => a.accountType === 'student')).toHaveLength(40)

    // counters reflect only this run's totals (wiped before reseed, not accumulated)
    const catechistCounter = await t.run(async (ctx) =>
      ctx.db
        .query('counters')
        .withIndex('by_name', (q) => q.eq('name', 'catechist'))
        .unique(),
    )
    const studentCounter = await t.run(async (ctx) =>
      ctx.db
        .query('counters')
        .withIndex('by_name', (q) => q.eq('name', 'student'))
        .unique(),
    )
    expect(catechistCounter?.value).toBe(21)
    expect(studentCounter?.value).toBe(40)

    // username === password for a sampled catechist account
    const catechistAccount = accounts.find(
      (a) => a.accountType === 'catechist',
    )!
    const catechistDoc = await t.run(async (ctx) =>
      ctx.db.get('catechists', catechistAccount.userRefId as Id<'catechists'>),
    )
    expect(catechistAccount.loginId).toBe(`CAT-${catechistDoc!.memberId}`)
    const catechistVerify = await verifyPassword(
      catechistAccount.loginId,
      catechistAccount.passwordHash,
    )
    expect(catechistVerify.valid).toBe(true)

    // username === password for a sampled student account
    const studentAccount = accounts.find((a) => a.accountType === 'student')!
    const studentDoc = await t.run(async (ctx) =>
      ctx.db.get('students', studentAccount.userRefId as Id<'students'>),
    )
    expect(studentAccount.loginId).toBe(`STD-${studentDoc!.studentCode}`)
    const studentVerify = await verifyPassword(
      studentAccount.loginId,
      studentAccount.passwordHash,
    )
    expect(studentVerify.valid).toBe(true)

    // continuity: every student enrolled in old Ấu Nhi 1 must also be
    // enrolled in current Thiếu Nhi 1, and old Nghĩa Sĩ 1 must have no
    // continuation into any current classYear.
    const org = await t.run(async (ctx) => {
      const branches = await ctx.db
        .query('branches')
        .withIndex('by_is_deleted', (q) => q.eq('isDeleted', false))
        .collect()
      const years = await ctx.db
        .query('academicYears')
        .withIndex('by_is_deleted', (q) => q.eq('isDeleted', false))
        .collect()
      const oldYear = years.find((y) => y.name === '2024-2025')!
      const currentYear = years.find((y) => y.name === '2025-2026')!
      const classYears = await ctx.db
        .query('classYears')
        .withIndex('by_is_deleted', (q) => q.eq('isDeleted', false))
        .collect()
      const classes = await ctx.db
        .query('classes')
        .withIndex('by_is_deleted', (q) => q.eq('isDeleted', false))
        .collect()
      const classIdToBranchId = new Map(classes.map((c) => [c._id, c.branchId]))
      const branchNameById = new Map(branches.map((b) => [b._id, b.name]))

      const findClassYear = (yearId: typeof oldYear._id, branchName: string) =>
        classYears.find(
          (cy) =>
            cy.academicYearId === yearId &&
            branchNameById.get(classIdToBranchId.get(cy.classId)!) ===
              branchName,
        )!

      return {
        oldAuNhi: findClassYear(oldYear._id, 'Ấu Nhi'),
        oldNghiaSi: findClassYear(oldYear._id, 'Nghĩa Sĩ'),
        currentThieuNhi: findClassYear(currentYear._id, 'Thiếu Nhi'),
      }
    })

    const oldAuNhiEnrollments = await t.run(async (ctx) =>
      ctx.db
        .query('studentClasses')
        .withIndex('by_class_year_id', (q) =>
          q.eq('classYearId', org.oldAuNhi._id),
        )
        .collect(),
    )
    expect(oldAuNhiEnrollments).toHaveLength(10)

    const currentThieuNhiStudentIds = new Set(
      (
        await t.run(async (ctx) =>
          ctx.db
            .query('studentClasses')
            .withIndex('by_class_year_id', (q) =>
              q.eq('classYearId', org.currentThieuNhi._id),
            )
            .collect(),
        )
      ).map((sc) => sc.studentId),
    )
    for (const enrollment of oldAuNhiEnrollments) {
      expect(currentThieuNhiStudentIds.has(enrollment.studentId)).toBe(true)
    }

    const oldNghiaSiEnrollments = await t.run(async (ctx) =>
      ctx.db
        .query('studentClasses')
        .withIndex('by_class_year_id', (q) =>
          q.eq('classYearId', org.oldNghiaSi._id),
        )
        .collect(),
    )
    expect(oldNghiaSiEnrollments).toHaveLength(10)
    const allCurrentEnrollments = await t.run(async (ctx) => {
      const all = await ctx.db.query('studentClasses').collect()
      const classYears = await ctx.db.query('classYears').collect()
      const currentYearIds = new Set(
        classYears
          .filter(
            (cy) =>
              cy._id !== org.oldAuNhi._id && cy._id !== org.oldNghiaSi._id,
          )
          .map((cy) => cy._id),
      )
      return all.filter((sc) => currentYearIds.has(sc.classYearId))
    })
    const oldNghiaSiStudentIds = new Set(
      oldNghiaSiEnrollments.map((sc) => sc.studentId),
    )
    const continuedGraduates = allCurrentEnrollments.filter((sc) =>
      oldNghiaSiStudentIds.has(sc.studentId),
    )
    expect(continuedGraduates).toHaveLength(0)

    // ── Second run: wipe-then-reseed must not double up documents ──
    const secondResult = await t.action(internal.seed.resetDemoData, {})
    if (secondResult.skipped) throw new Error('expected second run to run')

    expect(secondResult.catechistCount).toBe(21)
    expect(secondResult.studentCount).toBe(40)
    expect(await countOf('branches')).toBe(3)
    expect(await countOf('academicYears')).toBe(2)
    expect(await countOf('catechists')).toBe(21)
    expect(await countOf('students')).toBe(40)
    expect(await countOf('studentClasses')).toBe(60)
    expect(await countOf('attendanceRecords')).toBe(480)
    expect(await countOf('scoreEntries')).toBe(360)
    expect(await countOf('calendarEvents')).toBe(20)
    expect(await countOf('appConfig')).toBe(1)
    expect(await countOf('extracurricularPrograms')).toBe(3)
  }, 60000)
})
