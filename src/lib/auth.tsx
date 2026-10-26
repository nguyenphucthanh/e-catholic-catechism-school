import * as React from 'react'
import { useConvex } from 'convex/react'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

const AUTH_KEY = 'giaoly_auth'
const IMPERSONATOR_KEY = 'giaoly_impersonator'

export type AuthUser = {
  userDocId: string
  loginId: string
  memberId: string
  fullName: string
  accountType: 'catechist' | 'student'
  role: 'admin' | 'user' | null
  mustChangePassword?: boolean
  // Server session; exchanged for short-lived JWTs via auth.issueToken.
  sessionId: string
  sessionSecret: string
}

type AuthContextValue = {
  user: AuthUser | null
  isHydrated?: boolean
  impersonatorAdmin?: AuthUser | null
  login: (user: AuthUser) => void
  logout: () => void
  loginAs?: (target: AuthUser) => void
  returnToAdmin?: () => void
  markPasswordChanged?: () => void
}

const AuthContext = React.createContext<AuthContextValue | null>(null)

function isValidStoredUser(value: unknown): value is AuthUser {
  if (typeof value !== 'object' || value === null) return false
  const u = value as Record<string, unknown>
  return (
    typeof u.userDocId === 'string' &&
    typeof u.loginId === 'string' &&
    typeof u.memberId === 'string' &&
    typeof u.fullName === 'string' &&
    (u.accountType === 'catechist' || u.accountType === 'student') &&
    (u.role === 'admin' || u.role === 'user' || u.role === null) &&
    (u.mustChangePassword === undefined ||
      typeof u.mustChangePassword === 'boolean') &&
    // Users stored before sessions existed are dropped → forced re-login.
    typeof u.sessionId === 'string' &&
    typeof u.sessionSecret === 'string'
  )
}

function readStoredUser(key: string): AuthUser | null {
  try {
    const stored = localStorage.getItem(key)
    if (!stored) return null
    const parsed = JSON.parse(stored) as unknown
    if (!isValidStoredUser(parsed)) {
      localStorage.removeItem(key)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function sessionArgs(u: AuthUser) {
  return { sessionId: u.sessionId as Id<'sessions'>, secret: u.sessionSecret }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const convex = useConvex()
  const [user, setUser] = React.useState<AuthUser | null>(null)
  const [impersonatorAdmin, setImpersonatorAdmin] =
    React.useState<AuthUser | null>(null)
  const [isHydrated, setIsHydrated] = React.useState(false)
  // sessionId whose token the server has accepted.
  const [authedSessionId, setAuthedSessionId] = React.useState<string | null>(
    null,
  )

  React.useEffect(() => {
    setUser(readStoredUser(AUTH_KEY))
    setImpersonatorAdmin(readStoredUser(IMPERSONATOR_KEY))
    setIsHydrated(true)
  }, [])

  const revokeSession = React.useCallback(
    (u: AuthUser) => {
      // Best effort: an already-invalid session is fine to ignore.
      new ConvexHttpClient(convex.url)
        .mutation(api.auth.logout, sessionArgs(u))
        .catch(() => {})
    },
    [convex],
  )

  const login = React.useCallback((u: AuthUser) => {
    setUser(u)
    localStorage.setItem(AUTH_KEY, JSON.stringify(u))
  }, [])

  const clearLocalSession = React.useCallback(() => {
    setUser(null)
    setImpersonatorAdmin(null)
    localStorage.removeItem(AUTH_KEY)
    localStorage.removeItem(IMPERSONATOR_KEY)
  }, [])

  const logout = React.useCallback(() => {
    if (user) revokeSession(user)
    if (impersonatorAdmin) revokeSession(impersonatorAdmin)
    clearLocalSession()
  }, [user, impersonatorAdmin, revokeSession, clearLocalSession])

  const sessionId = user?.sessionId
  const sessionSecret = user?.sessionSecret
  React.useEffect(() => {
    if (!sessionId || !sessionSecret) {
      convex.clearAuth()
      return
    }
    let cancelled = false
    // Separate HTTP client: setAuth pauses the websocket while fetching.
    const http = new ConvexHttpClient(convex.url)
    convex.setAuth(
      // Must never throw: a rejected fetcher leaves the websocket paused.
      async () => {
        for (let attempt = 0; !cancelled; attempt++) {
          try {
            return await http.mutation(api.auth.issueToken, {
              sessionId: sessionId as Id<'sessions'>,
              secret: sessionSecret,
            })
          } catch (e) {
            // Server rejected the session (revoked/expired) → onChange(false).
            if (!(e instanceof TypeError)) return null
            // Network error (offline): keep the session and retry.
            await new Promise((r) =>
              setTimeout(r, Math.min(30_000, 1000 * 2 ** attempt)),
            )
          }
        }
        return null
      },
      (isAuthenticated) => {
        if (isAuthenticated) setAuthedSessionId(sessionId)
        else clearLocalSession()
      },
    )
    return () => {
      cancelled = true
    }
  }, [convex, sessionId, sessionSecret, clearLocalSession])

  // Hold the app until the server accepts the token, so the first queries
  // don't run unauthenticated.
  const isAuthPending = !!user && authedSessionId !== user.sessionId

  const markPasswordChanged = React.useCallback(() => {
    setUser((prev) => {
      if (!prev) return null
      const updated = { ...prev, mustChangePassword: false }
      localStorage.setItem(AUTH_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  const loginAs = React.useCallback(
    (target: AuthUser) => {
      if (!user) return
      setImpersonatorAdmin(user)
      localStorage.setItem(IMPERSONATOR_KEY, JSON.stringify(user))
      setUser(target)
      localStorage.setItem(AUTH_KEY, JSON.stringify(target))
    },
    [user],
  )

  const returnToAdmin = React.useCallback(() => {
    if (!impersonatorAdmin) return
    if (user) revokeSession(user)
    setUser(impersonatorAdmin)
    localStorage.setItem(AUTH_KEY, JSON.stringify(impersonatorAdmin))
    setImpersonatorAdmin(null)
    localStorage.removeItem(IMPERSONATOR_KEY)
  }, [impersonatorAdmin, user, revokeSession])

  return (
    <AuthContext.Provider
      value={{
        user,
        isHydrated,
        impersonatorAdmin,
        login,
        logout,
        loginAs,
        returnToAdmin,
        markPasswordChanged,
      }}
    >
      {isAuthPending ? null : children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
