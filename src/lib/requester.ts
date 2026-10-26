import type { AuthUser } from '~/lib/auth'
import type { Id } from '../../convex/_generated/dataModel'
import { useAuth } from '~/lib/auth'

// Shape expected by endpoints shared by catechists and students.
export type Requester =
  | { accountType: 'catechist'; requesterId: Id<'catechists'> }
  | { accountType: 'student'; requesterId: Id<'students'> }

export function toRequester(user: AuthUser): Requester {
  return user.accountType === 'student'
    ? { accountType: 'student', requesterId: user.userDocId as Id<'students'> }
    : {
        accountType: 'catechist',
        requesterId: user.userDocId as Id<'catechists'>,
      }
}

export function useRequester(): Requester | undefined {
  const { user } = useAuth()
  return user ? toRequester(user) : undefined
}
