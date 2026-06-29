import { v } from 'convex/values'
import { mutation } from './_generated/server'
import type { Id } from './_generated/dataModel'

async function sha256Hex(plaintext: string): Promise<string> {
  const encoded = new TextEncoder().encode(plaintext)
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export const login = mutation({
  args: {
    loginId: v.string(),
    password: v.string(),
  },
  handler: async (ctx, { loginId, password }) => {
    const account = await ctx.db
      .query('accounts')
      .withIndex('by_login_id', (q) => q.eq('loginId', loginId))
      .unique()

    if (!account || !account.isActive) {
      throw new Error('Invalid credentials')
    }

    const passwordHash = await sha256Hex(password)
    if (passwordHash !== account.passwordHash) {
      throw new Error('Invalid credentials')
    }

    await ctx.db.patch('accounts', account._id, { lastLoginAt: Date.now() })

    if (account.accountType === 'catechist') {
      const catechist = await ctx.db.get(
        'catechists',
        account.userRefId as Id<'catechists'>,
      )
      if (!catechist) throw new Error('User not found')
      return {
        accountType: 'catechist' as const,
        userDocId: account.userRefId,
        memberId: catechist.memberId,
        fullName: catechist.fullName,
        role: catechist.role,
      }
    } else {
      const student = await ctx.db.get(
        'students',
        account.userRefId as Id<'students'>,
      )
      if (!student) throw new Error('User not found')
      return {
        accountType: 'student' as const,
        userDocId: account.userRefId,
        memberId: student.studentCode,
        fullName: student.fullName,
        role: null,
      }
    }
  },
})
