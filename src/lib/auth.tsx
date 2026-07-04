import * as React from 'react'

const AUTH_KEY = 'giaoly_auth'

export type AuthUser = {
  userDocId: string
  loginId: string
  memberId: string
  fullName: string
  accountType: 'catechist' | 'student'
  role: 'admin' | 'user' | null
}

type AuthContextValue = {
  user: AuthUser | null
  login: (user: AuthUser) => void
  logout: () => void
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
    (u.role === 'admin' || u.role === 'user' || u.role === null)
  )
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      const stored = localStorage.getItem(AUTH_KEY)
      if (!stored) return null
      const parsed = JSON.parse(stored) as unknown
      if (!isValidStoredUser(parsed)) {
        localStorage.removeItem(AUTH_KEY)
        return null
      }
      return parsed
    } catch {
      return null
    }
  })

  const login = React.useCallback((u: AuthUser) => {
    setUser(u)
    localStorage.setItem(AUTH_KEY, JSON.stringify(u))
  }, [])

  const logout = React.useCallback(() => {
    setUser(null)
    localStorage.removeItem(AUTH_KEY)
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
