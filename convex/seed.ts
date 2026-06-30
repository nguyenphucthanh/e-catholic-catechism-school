import { internalMutation } from './_generated/server'
import { nextCounter } from './lib/counter'
import { hashPassword } from './lib/password'

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
    const existingBoard = await ctx.db
      .query('catechists')
      // eslint-disable-next-line @convex-dev/no-filter-in-query
      .filter((q) => q.eq(q.field('role'), 'board'))
      .take(1)

    if (existingBoard.length > 0) {
      return { skipped: true }
    }

    // ── 3. Get next auto-increment memberId from counter ──────────────────────
    const memberIdNum = await nextCounter(ctx, 'catechist')
    const memberId = memberIdNum.toString()

    // ── 4. Insert the admin catechist ─────────────────────────────────────────
    const catechistId = await ctx.db.insert('catechists', {
      memberId,
      fullName: 'Admin',
      role: 'board',
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
