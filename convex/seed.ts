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

    // ── 2. Seed app config ────────────────────────────────────────────────────
    const existingConfig = await ctx.db.query('appConfig').first()
    if (!existingConfig) {
      await ctx.db.insert('appConfig', {
        parishName: 'Giáo xứ Mẫu',
        dioceseName: 'Tổng Giáo phận Sài Gòn',
        nameFormat: 'firstName_lastName',
      })
    }

    // ── 3. Guard: skip if a board-level catechist already exists ──────────────
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

export const seedFiftyStudents = mutation({
  args: {
    requesterId: v.optional(v.id('catechists')),
  },
  handler: async (ctx, args) => {
    if (args.requesterId !== undefined) {
      await assertAdminRole(ctx, args.requesterId)
    }

    // 1. Get or create a sample academic year (active if possible, or any, or create)
    let academicYear = await ctx.db
      .query('academicYears')
      .withIndex('by_is_deleted', (q) => q.eq('isDeleted', false))
      // eslint-disable-next-line @convex-dev/no-filter-in-query
      .filter((q) => q.eq(q.field('isActive'), true))
      .first()

    if (!academicYear) {
      academicYear = await ctx.db
        .query('academicYears')
        .withIndex('by_is_deleted', (q) => q.eq('isDeleted', false))
        .first()
    }

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

    // 2. Ensure branches exist
    const branches = await ctx.db
      .query('branches')
      .withIndex('by_is_deleted', (q) => q.eq('isDeleted', false))
      .collect()

    const branchMap = new Map<string, Id<'branches'>>()
    if (branches.length === 0) {
      for (const branch of BRANCHES) {
        const id = await ctx.db.insert('branches', {
          ...branch,
          isDeleted: false,
        })
        branchMap.set(branch.name, id)
      }
    } else {
      for (const b of branches) {
        branchMap.set(b.name, b._id)
      }
    }

    // 3. Ensure we have classYears for standard classes in this academic year
    const classesToEnsure = [
      { name: 'Chiên Con 1', branch: 'Chiên Con' },
      { name: 'Ấu Nhi 1', branch: 'Ấu Nhi' },
      { name: 'Thiếu Nhi 1', branch: 'Thiếu Nhi' },
      { name: 'Nghĩa Sĩ 1', branch: 'Nghĩa Sĩ' },
      { name: 'Hiệp Sĩ 1', branch: 'Hiệp Sĩ' },
      { name: 'Dự Trưởng 1', branch: 'Dự Trưởng' },
    ]

    const classYearMap = new Map<string, Id<'classYears'>>()
    for (const item of classesToEnsure) {
      const branchId = branchMap.get(item.branch)
      if (!branchId) continue

      let classRecord = await ctx.db
        .query('classes')
        .withIndex('by_is_deleted', (q) => q.eq('isDeleted', false))
        // eslint-disable-next-line @convex-dev/no-filter-in-query
        .filter((q) => q.eq(q.field('name'), item.name))
        .first()

      if (!classRecord) {
        const id = await ctx.db.insert('classes', {
          branchId,
          name: item.name,
          description: `Lớp ${item.name}`,
          isDeleted: false,
        })
        classRecord = (await ctx.db.get('classes', id))!
      }

      let classYear = await ctx.db
        .query('classYears')
        .withIndex('by_class_id_and_academic_year_id', (q) =>
          q
            .eq('classId', classRecord._id)
            .eq('academicYearId', academicYear._id),
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

      classYearMap.set(item.branch, classYear._id)
    }

    // 4. Seeding resources (realistic name components, etc.)
    const LAST_NAMES = [
      'Nguyễn',
      'Trần',
      'Lê',
      'Phạm',
      'Huỳnh',
      'Phan',
      'Vũ',
      'Võ',
      'Đặng',
      'Bùi',
      'Đỗ',
      'Hồ',
      'Ngô',
      'Dương',
      'Lý',
    ]

    const BOY_MIDDLE_NAMES = [
      'Văn',
      'Hữu',
      'Minh',
      'Đức',
      'Quốc',
      'Gia',
      'Anh',
      'Thanh',
      'Xuân',
      'Duy',
      'Khánh',
      'Hoàng',
      'Tuấn',
      'Ngọc',
    ]
    const GIRL_MIDDLE_NAMES = [
      'Thị',
      'Ngọc',
      'Quỳnh',
      'Thu',
      'Thanh',
      'Kiều',
      'Trúc',
      'Cát',
      'Tuyết',
      'Bạch',
      'Ánh',
      'Phương',
      'Mai',
      'Hồng',
    ]

    const BOY_FIRST_NAMES = [
      'Anh',
      'Bảo',
      'Cường',
      'Dũng',
      'Đông',
      'Đạt',
      'Duy',
      'Gia',
      'Hải',
      'Huy',
      'Hoàng',
      'Hùng',
      'Khang',
      'Lâm',
      'Long',
      'Minh',
      'Nam',
      'Nhân',
      'Phúc',
      'Phong',
      'Quân',
      'Quang',
      'Sơn',
      'Tâm',
      'Thắng',
      'Thịnh',
      'Trung',
      'Tuấn',
      'Việt',
      'Vy',
    ]
    const GIRL_FIRST_NAMES = [
      'Anh',
      'Bích',
      'Chi',
      'Cúc',
      'Diệp',
      'Đào',
      'Dung',
      'Giang',
      'Hương',
      'Hạnh',
      'Hoa',
      'Hằng',
      'Khánh',
      'Lan',
      'Linh',
      'Lê',
      'Mai',
      'Minh',
      'Ngọc',
      'Nga',
      'Oanh',
      'Phương',
      'Phượng',
      'Quỳnh',
      'Trang',
      'Tuyết',
      'Trinh',
      'Thảo',
      'Vân',
      'Vy',
      'Yến',
    ]

    const BOY_SAINT_NAMES = [
      'Giuse',
      'Phêrô',
      'Phaoô',
      'Gioan',
      'Tôma',
      'Antôn',
      'Matthêu',
      'Luca',
      'Máccô',
      'Phanxicô',
      'Đaminh',
      'Augustinô',
      'Stêphanô',
      'Micae',
      'Giacôbê',
      'Nicôla',
    ]
    const GIRL_SAINT_NAMES = [
      'Maria',
      'Anna',
      'Teresa',
      'Cecilia',
      'Rosa',
      'Lucia',
      'Agatha',
      'Clara',
      'Mônica',
      'Têrêxa',
      'Êlisabét',
      'Anê',
      'Marta',
      'Cataria',
    ]

    const STREET_NAMES = [
      'Hai Bà Trưng',
      'Lê Lợi',
      'Nguyễn Huệ',
      'Cách Mạng Tháng Tám',
      'Lê Hồng Phong',
      'Nam Kỳ Khởi Nghĩa',
      'Võ Thị Sáu',
      'Điện Biên Phủ',
      'Ba Tháng Hai',
      'Phạm Văn Đồng',
      'Trần Hưng Đạo',
      'Nguyễn Trãi',
    ]
    const HAMLETS = [
      'Giáo họ Thánh Tâm',
      'Giáo họ Thánh Giuse',
      'Giáo họ Lộ Đức',
      'Giáo họ Thánh Gia',
      'Giáo họ Kitô Vua',
      'Giáo họ Fatima',
      'Giáo họ Mân Côi',
    ]
    const PARISHES = [
      'Giáo xứ Tân Định',
      'Giáo xứ Đức Bà',
      'Giáo xứ Bình Triệu',
      'Giáo xứ Vườn Xoài',
      'Giáo xứ Hạnh Thông Tây',
      'Giáo xứ Chợ Quán',
      'Giáo xứ Fatima Bình Triệu',
    ]

    const getRandomElement = <T>(arr: Array<T>): T =>
      arr[Math.floor(Math.random() * arr.length)]

    let studentsSeeded = 0
    let familiesSeeded = 0

    // 50 students total across 35 families:
    // - 20 families with 1 child
    // - 15 families with 2 children
    // Total children: 20 * 1 + 15 * 2 = 50.
    const familyConfigs = [...Array(20).fill(1), ...Array(15).fill(2)]

    for (const numChildren of familyConfigs) {
      familiesSeeded++
      const familyLastName = getRandomElement(LAST_NAMES)

      // Generate Father Guardian
      const fatherSaint = getRandomElement(BOY_SAINT_NAMES)
      const fatherFirstName = getRandomElement(BOY_FIRST_NAMES)
      const fatherMiddleName = getRandomElement(BOY_MIDDLE_NAMES)
      const fatherFullName = `${familyLastName} ${fatherMiddleName} ${fatherFirstName}`

      const fatherId = await ctx.db.insert('guardians', {
        fullName: fatherFullName,
        saintName: fatherSaint,
        notes: `Bố - Gia đình số ${familiesSeeded}`,
        isDeleted: false,
      })

      // Generate Mother Guardian
      const motherSaint = getRandomElement(GIRL_SAINT_NAMES)
      const motherFirstName = getRandomElement(GIRL_FIRST_NAMES)
      const motherMiddleName = getRandomElement(GIRL_MIDDLE_NAMES)
      const motherFullName = `${getRandomElement(LAST_NAMES)} ${motherMiddleName} ${motherFirstName}`

      const motherId = await ctx.db.insert('guardians', {
        fullName: motherFullName,
        saintName: motherSaint,
        notes: `Mẹ - Gia đình số ${familiesSeeded}`,
        isDeleted: false,
      })

      // Add contacts for Father
      const fatherPhone = `+849${Math.floor(10000000 + Math.random() * 90000000)}`
      await ctx.db.insert('guardianContacts', {
        guardianId: fatherId,
        contactType: 'phone',
        value: fatherPhone,
        isPrimary: true,
        notes: 'Số điện thoại chính',
        isDeleted: false,
      })

      // Add contacts for Mother
      const motherPhone = `+849${Math.floor(10000000 + Math.random() * 90000000)}`
      await ctx.db.insert('guardianContacts', {
        guardianId: motherId,
        contactType: 'phone',
        value: motherPhone,
        isPrimary: true,
        notes: 'Số điện thoại chính',
        isDeleted: false,
      })

      // Generate Shared Address
      const addressLine1 = `${Math.floor(10 + Math.random() * 500)} ${getRandomElement(STREET_NAMES)}`
      const hamlet = getRandomElement(HAMLETS)
      const subHamlet = `Xóm ${Math.floor(1 + Math.random() * 10)}`

      // Generate children (students) for this family
      for (let i = 0; i < numChildren; i++) {
        studentsSeeded++
        const gender = Math.random() > 0.5 ? 'male' : 'female'

        let childSaint = ''
        let childMiddle = ''
        let childFirst = ''
        if (gender === 'male') {
          childSaint = getRandomElement(BOY_SAINT_NAMES)
          childMiddle = getRandomElement(BOY_MIDDLE_NAMES)
          childFirst = getRandomElement(BOY_FIRST_NAMES)
        } else {
          childSaint = getRandomElement(GIRL_SAINT_NAMES)
          childMiddle = getRandomElement(GIRL_MIDDLE_NAMES)
          childFirst = getRandomElement(GIRL_FIRST_NAMES)
        }

        const childFullName = `${familyLastName} ${childMiddle} ${childFirst}`

        // Distribute children across branches based on student index
        let birthYear = 2015
        let branchName = 'Ấu Nhi'

        if (studentsSeeded <= 8) {
          birthYear = 2019 + Math.floor(Math.random() * 3) // 2019-2021 (Chiên Con: age 4-6)
          branchName = 'Chiên Con'
        } else if (studentsSeeded <= 18) {
          birthYear = 2016 + Math.floor(Math.random() * 3) // 2016-2018 (Ấu Nhi: age 7-9)
          branchName = 'Ấu Nhi'
        } else if (studentsSeeded <= 28) {
          birthYear = 2013 + Math.floor(Math.random() * 3) // 2013-2015 (Thiếu Nhi: age 10-12)
          branchName = 'Thiếu Nhi'
        } else if (studentsSeeded <= 38) {
          birthYear = 2010 + Math.floor(Math.random() * 3) // 2010-2012 (Nghĩa Sĩ: age 13-15)
          branchName = 'Nghĩa Sĩ'
        } else if (studentsSeeded <= 46) {
          birthYear = 2007 + Math.floor(Math.random() * 3) // 2007-2009 (Hiệp Sĩ: age 16-18)
          branchName = 'Hiệp Sĩ'
        } else {
          birthYear = 2003 + Math.floor(Math.random() * 4) // 2003-2006 (Dự Trưởng: age 19-22)
          branchName = 'Dự Trưởng'
        }

        const dobMonth = Math.floor(1 + Math.random() * 12)
          .toString()
          .padStart(2, '0')
        const dobDay = Math.floor(1 + Math.random() * 28)
          .toString()
          .padStart(2, '0')
        const dateOfBirth = `${birthYear}-${dobMonth}-${dobDay}`

        // Get student code
        const seq = await nextCounter(ctx, 'student')
        const studentCode = seq.toString()

        // Insert student
        const studentId = await ctx.db.insert('students', {
          studentCode,
          fullName: childFullName,
          saintName: childSaint,
          dateOfBirth,
          gender,
          previousParish: getRandomElement(PARISHES),
          previousDiocese: 'Tổng Giáo phận Sài Gòn',
          isActive: true,
          isDeleted: false,
          createdAt: Date.now(),
        })

        // Insert Student Address
        await ctx.db.insert('studentAddresses', {
          studentId,
          country: 'VN',
          city: 'Hồ Chí Minh',
          addressLine1,
          hamlet,
          subHamlet,
          isDeleted: false,
        })

        // Link student to Guardians
        await ctx.db.insert('studentGuardians', {
          studentId,
          guardianId: fatherId,
          relationship: 'Bố',
          contactPriority: 1,
          isDeleted: false,
        })

        await ctx.db.insert('studentGuardians', {
          studentId,
          guardianId: motherId,
          relationship: 'Mẹ',
          contactPriority: 2,
          isDeleted: false,
        })

        // Insert Sacraments
        // All have Baptism
        const baptYear = birthYear
        const baptMonth = Math.floor(1 + Math.random() * 12)
          .toString()
          .padStart(2, '0')
        const baptDay = Math.floor(1 + Math.random() * 28)
          .toString()
          .padStart(2, '0')
        await ctx.db.insert('studentSacraments', {
          studentId,
          sacramentType: 'baptism',
          receivedDate: `${baptYear}-${baptMonth}-${baptDay}`,
          receivedPlace: getRandomElement(PARISHES),
          notes: 'Cha sở rửa tội',
          isDeleted: false,
        })

        const currentAge = 2026 - birthYear
        // First Confession & Communion for kids age 8 or older
        if (currentAge >= 8) {
          const comYear = birthYear + 8
          const comMonth = '06'
          const comDay = '15'
          await ctx.db.insert('studentSacraments', {
            studentId,
            sacramentType: 'first_confession',
            receivedDate: `${comYear}-${comMonth}-${comDay}`,
            receivedPlace: getRandomElement(PARISHES),
            notes: 'Bí tích Hòa Giải lần đầu',
            isDeleted: false,
          })
          await ctx.db.insert('studentSacraments', {
            studentId,
            sacramentType: 'first_communion',
            receivedDate: `${comYear}-${comMonth}-${comDay}`,
            receivedPlace: getRandomElement(PARISHES),
            notes: 'Bí tích Thánh Thể lần đầu',
            isDeleted: false,
          })
        }

        // Confirmation for kids age 12 or older
        if (currentAge >= 12) {
          const confYear = birthYear + 12
          const confMonth = '07'
          const confDay = '10'
          await ctx.db.insert('studentSacraments', {
            studentId,
            sacramentType: 'confirmation',
            receivedDate: `${confYear}-${confMonth}-${confDay}`,
            receivedPlace: getRandomElement(PARISHES),
            notes: 'Bí tích Thêm Sức',
            isDeleted: false,
          })
        }

        // Enroll Student in classYear
        const classYearId = classYearMap.get(branchName)
        if (classYearId) {
          await ctx.db.insert('studentClasses', {
            studentId,
            classYearId,
            isPrimaryClass: true,
            enrolledDate: `${academicYear.startDate}`,
            status: 'active',
            isDeleted: false,
          })
        }
      }
    }

    return {
      message: `Successfully seeded ${studentsSeeded} students across ${familiesSeeded} families.`,
      studentsSeeded,
      familiesSeeded,
    }
  },
})

export const seedExamForTest = mutation({
  args: {
    requesterId: v.id('catechists'),
  },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx, args.requesterId)

    const classIdStr = 'mx7566ze3ysmnavbm1er9dqzcd89r26x'
    let classYearId: Id<'classYears'> | null = null

    // Check if it's a classYear ID
    const classYearDoc = await ctx.db.get(
      'classYears',
      classIdStr as Id<'classYears'>,
    )
    if (classYearDoc && !classYearDoc.isDeleted) {
      classYearId = classYearDoc._id
    } else {
      // Check if it's a class ID
      const classDoc = await ctx.db.get('classes', classIdStr as Id<'classes'>)
      if (classDoc && !classDoc.isDeleted) {
        // Find active academic year
        const activeYear = await ctx.db
          .query('academicYears')
          .withIndex('by_is_deleted', (q) => q.eq('isDeleted', false))
          // eslint-disable-next-line @convex-dev/no-filter-in-query
          .filter((q) => q.eq(q.field('isActive'), true))
          .first()

        if (!activeYear) {
          throw new Error('No active academic year found')
        }

        // Find or create classYear
        const existingClassYear = await ctx.db
          .query('classYears')
          .withIndex('by_class_id_and_academic_year_id', (q) =>
            q.eq('classId', classDoc._id).eq('academicYearId', activeYear._id),
          )
          .first()

        if (existingClassYear) {
          classYearId = existingClassYear._id
        } else {
          classYearId = await ctx.db.insert('classYears', {
            classId: classDoc._id,
            academicYearId: activeYear._id,
            isDeleted: false,
          })
        }
      }
    }

    if (!classYearId) {
      throw new Error(
        `Target class/classYear ID ${classIdStr} not found. Make sure it exists in your DB first.`,
      )
    }

    const cy = await ctx.db.get('classYears', classYearId)
    if (!cy) throw new Error('Class year not found')

    // Find active semester
    const semesters = await ctx.db
      .query('semesters')
      .withIndex('by_is_deleted', (q) => q.eq('isDeleted', false))
      .collect()
    const activeSemester = semesters.find(
      (s) => s.academicYearId === cy.academicYearId,
    )
    if (!activeSemester) {
      throw new Error('No semester found for academic year')
    }

    // Ensure we have active enrolled studentClasses
    let studentClasses = await ctx.db
      .query('studentClasses')
      .withIndex('by_class_year_id', (q) => q.eq('classYearId', classYearId))
      .collect()

    studentClasses = studentClasses.filter(
      (sc) => !sc.isDeleted && sc.status === 'active',
    )

    if (studentClasses.length === 0) {
      const studentId = await ctx.db.insert('students', {
        studentCode: 'HS' + Math.floor(1000 + Math.random() * 9000),
        fullName: 'Nguyễn Văn Seeding',
        saintName: 'Giuse',
        isActive: true,
        createdAt: Date.now(),
        isDeleted: false,
      })
      const scId = await ctx.db.insert('studentClasses', {
        studentId,
        classYearId,
        isPrimaryClass: true,
        enrolledDate: '2025-09-01',
        status: 'active',
        isDeleted: false,
      })
      studentClasses.push({
        _id: scId,
        studentId,
        classYearId,
        isPrimaryClass: true,
        enrolledDate: '2025-09-01',
        status: 'active',
        isDeleted: false,
      } as any)
    }

    // Seed ScoreColumn
    const columnName = 'Chúa nhật 15 - Điểm đầu năm'
    const column = await ctx.db
      .query('scoreColumns')
      .withIndex('by_class_year_id_and_semester_id', (q) =>
        q.eq('classYearId', classYearId).eq('semesterId', activeSemester._id),
      )
      .collect()

    let columnId = column.find(
      (c) => c.columnName === columnName && !c.isDeleted,
    )?._id

    if (!columnId) {
      columnId = await ctx.db.insert('scoreColumns', {
        classYearId,
        semesterId: activeSemester._id,
        columnName,
        columnType: 'short_quiz',
        scaleType: 'scale_10',
        sortOrder: 1,
        isDeleted: false,
      })
    }

    // Seed scores
    for (const sc of studentClasses) {
      const existingEntry = await ctx.db
        .query('scoreEntries')
        .withIndex('by_student_class_id_and_score_column_id', (q) =>
          q.eq('studentClassId', sc._id).eq('scoreColumnId', columnId),
        )
        .first()

      if (!existingEntry || existingEntry.isDeleted) {
        const scoresOptions = [7.0, 7.5, 8.0, 8.5, 9.0, 9.5, 10.0]
        const scoreValue =
          scoresOptions[Math.floor(Math.random() * scoresOptions.length)]

        if (existingEntry && existingEntry.isDeleted) {
          await ctx.db.patch('scoreEntries', existingEntry._id, {
            scoreValue,
            isDeleted: false,
          })
        } else {
          await ctx.db.insert('scoreEntries', {
            studentClassId: sc._id,
            scoreColumnId: columnId,
            scoreValue,
            enteredBy: args.requesterId,
            enteredAt: Date.now(),
            isDeleted: false,
          })
        }
      }
    }

    return { success: true, columnId }
  },
})
