import { v } from 'convex/values'
import { internalMutation, mutation } from './_generated/server'
import { assertAdminRole } from './lib/authz'
import { nextCounter } from './lib/counter'
import { hashPassword } from './lib/password'
import type { Id } from './_generated/dataModel'

const BRANCHES = [
  { name: 'Chiên Con', sortOrder: 1 },
  { name: 'Ấu Nhi', sortOrder: 2 },
  { name: 'Thiếu Nhi', sortOrder: 3 },
  { name: 'Nghĩa Sĩ', sortOrder: 4 },
  { name: 'Hiệp Sĩ', sortOrder: 5 },
  { name: 'Dự Trưởng', sortOrder: 6 },
]

export const runSeed = internalMutation({
  args: {},
  handler: async (ctx) => {
    // ── 1. Seed branches ──────────────────────────────────────────────────────
    const existingBranch = await ctx.db.query('branches').take(1)
    if (existingBranch.length === 0) {
      for (const branch of BRANCHES) {
        await ctx.db.insert('branches', { ...branch, isDeleted: false })
      }
    }

    // ── 2. Guard: skip if a board-level catechist already exists ──────────────
    const existingAdmin = await ctx.db
      .query('catechists')
      // eslint-disable-next-line @convex-dev/no-filter-in-query
      .filter((q) => q.eq(q.field('role'), 'admin'))
      .take(1)

    if (existingAdmin.length > 0) {
      return { skipped: true }
    }

    // ── 3. Get next auto-increment memberId from counter ──────────────────────
    const memberIdNum = await nextCounter(ctx, 'catechist')
    const memberId = memberIdNum.toString()

    // ── 4. Insert the admin catechist ─────────────────────────────────────────
    const catechistId = await ctx.db.insert('catechists', {
      memberId,
      fullName: 'Admin',
      role: 'admin',
      isActive: true,
      isDeleted: false,
    })

    // ── 5. Create the account ─────────────────────────────────────────────────
    const passwordHash = await hashPassword('admin123')

    await ctx.db.insert('accounts', {
      loginId: memberId,
      passwordHash,
      accountType: 'catechist',
      userRefId: catechistId,
      isActive: true,
      createdAt: Date.now(),
      isDeleted: false,
    })

    return { skipped: false, catechistId, memberId }
  },
})

export const seedCatechistAssignments = mutation({
  args: { requesterId: v.id('catechists') },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx, args.requesterId)

    // 1. Ensure two academic years exist
    const ensureYear = async (name: string, start: string, end: string) => {
      const existing = await ctx.db
        .query('academicYears')
        .withIndex('by_name', (q) => q.eq('name', name))
        .unique()
      if (existing) return existing
      const id = await ctx.db.insert('academicYears', {
        name,
        startDate: start,
        endDate: end,
        timezone: 'Asia/Ho_Chi_Minh',
        isActive: name === '2024-2025',
        isDeleted: false,
      })
      return (await ctx.db.get('academicYears', id))!
    }

    const year2425 = await ensureYear('2024-2025', '2024-09-01', '2025-05-31')
    const year2324 = await ensureYear('2023-2024', '2023-09-01', '2024-05-31')

    // 2. Ensure two branches
    const ensureBranch = async (name: string, sortOrder: number) => {
      const existing = await ctx.db
        .query('branches')
        .withIndex('by_is_deleted', (q) => q.eq('isDeleted', false))
        // eslint-disable-next-line @convex-dev/no-filter-in-query
        .filter((q) => q.eq(q.field('name'), name))
        .first()
      if (existing) return existing
      const id = await ctx.db.insert('branches', {
        name,
        sortOrder,
        isDeleted: false,
      })
      return (await ctx.db.get('branches', id))!
    }

    const branchAuNhi = await ensureBranch('Ấu Nhi', 2)
    const branchThieuNhi = await ensureBranch('Thiếu Nhi', 3)

    // 3. Ensure three classes
    const ensureClass = async (name: string, branchId: Id<'branches'>) => {
      const existing = await ctx.db
        .query('classes')
        .withIndex('by_is_deleted', (q) => q.eq('isDeleted', false))
        // eslint-disable-next-line @convex-dev/no-filter-in-query
        .filter((q) => q.eq(q.field('name'), name))
        .first()
      if (existing) return existing
      const id = await ctx.db.insert('classes', {
        name,
        branchId,
        isDeleted: false,
      })
      return (await ctx.db.get('classes', id))!
    }

    const classA1 = await ensureClass('Ấu Nhi 1', branchAuNhi._id)
    const classA2 = await ensureClass('Ấu Nhi 2', branchAuNhi._id)
    const classT1 = await ensureClass('Thiếu Nhi 1', branchThieuNhi._id)

    // 4. Ensure classYears
    const ensureClassYear = async (
      classId: Id<'classes'>,
      academicYearId: Id<'academicYears'>,
    ) => {
      const existing = await ctx.db
        .query('classYears')
        .withIndex('by_class_id_and_academic_year_id', (q) =>
          q.eq('classId', classId).eq('academicYearId', academicYearId),
        )
        .unique()
      if (existing) return existing
      const id = await ctx.db.insert('classYears', {
        classId,
        academicYearId,
        isDeleted: false,
      })
      return (await ctx.db.get('classYears', id))!
    }

    const cyA1_2425 = await ensureClassYear(classA1._id, year2425._id)
    const cyA2_2425 = await ensureClassYear(classA2._id, year2425._id)
    const cyT1_2324 = await ensureClassYear(classT1._id, year2324._id)

    // 5. Create a test catechist
    const memberIdNum = await nextCounter(ctx, 'catechist')
    const memberId = memberIdNum.toString()
    const catechistId = await ctx.db.insert('catechists', {
      memberId,
      fullName: 'Nguyễn Thị Giáo Lý',
      saintName: 'Maria',
      role: 'user',
      isActive: true,
      isDeleted: false,
    })

    // 6. Assign catechist to classes
    await ctx.db.insert('classCatechists', {
      catechistId,
      classYearId: cyA1_2425._id,
      academicYearId: year2425._id,
      role: 'homeroom',
      isDeleted: false,
    })
    await ctx.db.insert('classCatechists', {
      catechistId,
      classYearId: cyA2_2425._id,
      academicYearId: year2425._id,
      role: 'co_teacher',
      isDeleted: false,
    })
    await ctx.db.insert('classCatechists', {
      catechistId,
      classYearId: cyT1_2324._id,
      academicYearId: year2324._id,
      role: 'homeroom',
      isDeleted: false,
    })

    return { catechistId, memberId }
  },
})

export const seedSampleStudents = mutation({
  args: {
    requesterId: v.id('catechists'),
  },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx, args.requesterId)
    // 1. Get or create a sample academic year
    let academicYear = await ctx.db
      .query('academicYears')
      .withIndex('by_name', (q) => q.eq('name', '2025-2026'))
      .unique()
    if (!academicYear) {
      const ayId = await ctx.db.insert('academicYears', {
        name: '2025-2026',
        startDate: '2025-09-01',
        endDate: '2026-05-31',
        timezone: 'Asia/Ho_Chi_Minh',
        isActive: true,
        isDeleted: false,
      })
      academicYear = (await ctx.db.get('academicYears', ayId))!
    }

    // 2. Get or create a branch (we can use 'Ấu Nhi' or first branch)
    let branch = await ctx.db
      .query('branches')
      .withIndex('by_is_deleted', (q) => q.eq('isDeleted', false))
      .first()
    if (!branch) {
      const bId = await ctx.db.insert('branches', {
        name: 'Ấu Nhi',
        sortOrder: 2,
        isDeleted: false,
      })
      branch = (await ctx.db.get('branches', bId))!
    }

    // 3. Get or create a class
    let classRecord = await ctx.db
      .query('classes')
      .withIndex('by_is_deleted', (q) => q.eq('isDeleted', false))
      // eslint-disable-next-line @convex-dev/no-filter-in-query
      .filter((q) => q.eq(q.field('name'), 'Ấu Nhi 1'))
      .first()
    if (!classRecord) {
      const cId = await ctx.db.insert('classes', {
        branchId: branch._id,
        name: 'Ấu Nhi 1',
        description: 'Lớp Ấu Nhi năm thứ nhất',
        isDeleted: false,
      })
      classRecord = (await ctx.db.get('classes', cId))!
    }

    // 4. Get or create a classYear
    let classYear = await ctx.db
      .query('classYears')
      .withIndex('by_class_id_and_academic_year_id', (q) =>
        q.eq('classId', classRecord._id).eq('academicYearId', academicYear._id),
      )
      .unique()
    if (!classYear) {
      const cyId = await ctx.db.insert('classYears', {
        classId: classRecord._id,
        academicYearId: academicYear._id,
        isDeleted: false,
      })
      classYear = (await ctx.db.get('classYears', cyId))!
    }

    // 5. Create a sample student
    const seq = await nextCounter(ctx, 'student')
    const studentCode = seq.toString()

    const studentId = await ctx.db.insert('students', {
      studentCode,
      fullName: 'Maria Nguyễn Thị Hương',
      saintName: 'Maria',
      dateOfBirth: '2014-08-15',
      gender: 'female',
      previousParish: 'Giáo xứ Tân Định',
      previousDiocese: 'Tổng Giáo phận Sài Gòn',
      isActive: true,
      isDeleted: false,
      createdAt: Date.now(),
    })

    // 6. Create student address
    await ctx.db.insert('studentAddresses', {
      studentId,
      country: 'VN',
      city: 'Hồ Chí Minh',
      addressLine1: '120 Hai Bà Trưng',
      hamlet: 'Giáo họ Thánh Tâm',
      subHamlet: 'Giáo xóm Kitô Vua',
      isDeleted: false,
    })

    // 7. Create sacraments
    await ctx.db.insert('studentSacraments', {
      studentId,
      sacramentType: 'baptism',
      receivedDate: '2014-08-25',
      receivedPlace: 'Giáo xứ Tân Định',
      notes: 'Cha sở rửa tội',
      isDeleted: false,
    })

    await ctx.db.insert('studentSacraments', {
      studentId,
      sacramentType: 'first_communion',
      receivedDate: '2022-06-12',
      receivedPlace: 'Giáo xứ Tân Định',
      notes: 'Rước lễ lần đầu trọng thể',
      isDeleted: false,
    })

    // 8. Create enrollment (student class)
    await ctx.db.insert('studentClasses', {
      studentId,
      classYearId: classYear._id,
      isPrimaryClass: true,
      enrolledDate: '2025-09-01',
      status: 'active',
      isDeleted: false,
    })

    return { studentId, studentCode }
  },
})
