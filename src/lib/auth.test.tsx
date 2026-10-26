import { beforeEach, describe, expect, test, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

// Unmock ~/lib/auth so we can test the real implementation
vi.unmock('~/lib/auth')

const convexMock = vi.hoisted(() => ({
  setAuth: vi.fn(),
  clearAuth: vi.fn(),
  url: 'https://x.convex.cloud',
}))
const httpMutation = vi.hoisted(() => vi.fn())

vi.mock('convex/react', () => ({ useConvex: () => convexMock }))
vi.mock('convex/browser', () => ({
  ConvexHttpClient: class {
    mutation = httpMutation
  },
}))

// Re-import the real module after unmocking
const { AuthProvider, useAuth } = await import('~/lib/auth')

// Clear localStorage between tests
beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  httpMutation.mockResolvedValue(undefined)
  // Server accepts the session as soon as setAuth is called.
  convexMock.setAuth.mockImplementation(
    (_fetcher: unknown, onChange: (ok: boolean) => void) => onChange(true),
  )
})

const SESSION = { sessionId: 's1', sessionSecret: 'secret' }

const TARGET_USER = {
  userDocId: 'cat2',
  loginId: 'CAT-GLV0002',
  memberId: 'GLV0002',
  fullName: 'Trần Thị B',
  accountType: 'catechist' as const,
  role: 'user' as const,
  sessionId: 's2',
  sessionSecret: 'secret2',
}

// Helper: a component that exercises the auth context
function AuthConsumer() {
  const {
    user,
    impersonatorAdmin,
    isHydrated,
    login,
    logout,
    loginAs,
    returnToAdmin,
    markPasswordChanged,
  } = useAuth()
  return (
    <div>
      <span data-testid="hydrated">{String(isHydrated)}</span>
      <span data-testid="user">{user ? user.fullName : 'no-user'}</span>
      <span data-testid="must-change-pw">
        {String(user?.mustChangePassword)}
      </span>
      <span data-testid="impersonator">
        {impersonatorAdmin ? impersonatorAdmin.fullName : 'no-impersonator'}
      </span>
      <button
        onClick={() =>
          login({
            userDocId: 'cat1',
            loginId: 'CAT-GLV0001',
            memberId: 'GLV0001',
            fullName: 'Nguyễn Văn A',
            accountType: 'catechist',
            role: 'admin',
            mustChangePassword: true,
            ...SESSION,
          })
        }
      >
        login
      </button>
      <button onClick={logout}>logout</button>
      <button onClick={() => loginAs?.(TARGET_USER)}>loginAs</button>
      <button onClick={() => returnToAdmin?.()}>returnToAdmin</button>
      <button onClick={() => markPasswordChanged?.()}>
        markPasswordChanged
      </button>
    </div>
  )
}

describe('AuthProvider / useAuth', () => {
  test('starts with no user when localStorage is empty', () => {
    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    )
    expect(screen.getByTestId('user').textContent).toBe('no-user')
  })

  test('isHydrated becomes true after mount', async () => {
    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    )
    await waitFor(() => {
      expect(screen.getByTestId('hydrated').textContent).toBe('true')
    })
  })

  test('login sets the user and persists to localStorage', () => {
    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    )
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'login' }))
    })
    expect(screen.getByTestId('user').textContent).toBe('Nguyễn Văn A')
    const stored = JSON.parse(localStorage.getItem('giaoly_auth')!)
    expect(stored.memberId).toBe('GLV0001')
  })

  test('logout clears the user and removes from localStorage', () => {
    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    )
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'login' }))
    })
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'logout' }))
    })
    expect(screen.getByTestId('user').textContent).toBe('no-user')
    expect(localStorage.getItem('giaoly_auth')).toBeNull()
  })

  test('reads persisted user from localStorage on mount', () => {
    const stored = {
      userDocId: 'cat99',
      loginId: 'CAT-GLV0099',
      memberId: 'GLV0099',
      fullName: 'Persisted User',
      accountType: 'catechist',
      role: null,
      ...SESSION,
    }
    localStorage.setItem('giaoly_auth', JSON.stringify(stored))

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    )
    expect(screen.getByTestId('user').textContent).toBe('Persisted User')
  })

  test('discards stale localStorage user missing loginId', () => {
    const stored = {
      userDocId: 'cat99',
      memberId: 'GLV0099',
      fullName: 'Stale User',
      accountType: 'catechist',
      role: null,
    }
    localStorage.setItem('giaoly_auth', JSON.stringify(stored))

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    )
    expect(screen.getByTestId('user').textContent).toBe('no-user')
    expect(localStorage.getItem('giaoly_auth')).toBeNull()
  })

  test('handles corrupted localStorage data gracefully', () => {
    localStorage.setItem('giaoly_auth', 'not-valid-json}}}')

    // Should not throw; falls back to null
    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    )
    expect(screen.getByTestId('user').textContent).toBe('no-user')
  })

  test('useAuth throws when used outside AuthProvider', () => {
    // Suppress the expected React error boundary console output
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    function Bare() {
      useAuth()
      return null
    }

    expect(() => render(<Bare />)).toThrow(
      'useAuth must be used within AuthProvider',
    )

    spy.mockRestore()
  })

  describe('impersonation', () => {
    test('loginAs stashes current user as impersonatorAdmin and switches to target', () => {
      render(
        <AuthProvider>
          <AuthConsumer />
        </AuthProvider>,
      )
      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'login' }))
      })
      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'loginAs' }))
      })

      expect(screen.getByTestId('user').textContent).toBe('Trần Thị B')
      expect(screen.getByTestId('impersonator').textContent).toBe(
        'Nguyễn Văn A',
      )

      const storedUser = JSON.parse(localStorage.getItem('giaoly_auth')!)
      expect(storedUser.memberId).toBe('GLV0002')

      const storedImpersonator = JSON.parse(
        localStorage.getItem('giaoly_impersonator')!,
      )
      expect(storedImpersonator.memberId).toBe('GLV0001')
    })

    test('loginAs is a no-op when there is no current user', () => {
      render(
        <AuthProvider>
          <AuthConsumer />
        </AuthProvider>,
      )
      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'loginAs' }))
      })

      expect(screen.getByTestId('user').textContent).toBe('no-user')
      expect(screen.getByTestId('impersonator').textContent).toBe(
        'no-impersonator',
      )
      expect(localStorage.getItem('giaoly_auth')).toBeNull()
      expect(localStorage.getItem('giaoly_impersonator')).toBeNull()
    })

    test('returnToAdmin restores the admin user and clears impersonator state', () => {
      render(
        <AuthProvider>
          <AuthConsumer />
        </AuthProvider>,
      )
      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'login' }))
      })
      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'loginAs' }))
      })
      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'returnToAdmin' }))
      })

      expect(screen.getByTestId('user').textContent).toBe('Nguyễn Văn A')
      expect(screen.getByTestId('impersonator').textContent).toBe(
        'no-impersonator',
      )
      expect(localStorage.getItem('giaoly_impersonator')).toBeNull()
      const storedUser = JSON.parse(localStorage.getItem('giaoly_auth')!)
      expect(storedUser.memberId).toBe('GLV0001')
    })

    test('returnToAdmin is a no-op when there is no impersonatorAdmin', () => {
      render(
        <AuthProvider>
          <AuthConsumer />
        </AuthProvider>,
      )
      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'login' }))
      })
      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'returnToAdmin' }))
      })

      expect(screen.getByTestId('user').textContent).toBe('Nguyễn Văn A')
      expect(screen.getByTestId('impersonator').textContent).toBe(
        'no-impersonator',
      )
    })

    test('logout also clears impersonatorAdmin and its localStorage key', () => {
      render(
        <AuthProvider>
          <AuthConsumer />
        </AuthProvider>,
      )
      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'login' }))
      })
      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'loginAs' }))
      })
      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'logout' }))
      })

      expect(screen.getByTestId('user').textContent).toBe('no-user')
      expect(screen.getByTestId('impersonator').textContent).toBe(
        'no-impersonator',
      )
      expect(localStorage.getItem('giaoly_auth')).toBeNull()
      expect(localStorage.getItem('giaoly_impersonator')).toBeNull()
    })

    test('loads a validly-shaped impersonatorAdmin from localStorage on mount', () => {
      const stored = {
        userDocId: 'cat1',
        loginId: 'CAT-GLV0001',
        memberId: 'GLV0001',
        fullName: 'Persisted Admin',
        accountType: 'catechist',
        role: 'admin',
        ...SESSION,
      }
      localStorage.setItem('giaoly_impersonator', JSON.stringify(stored))

      render(
        <AuthProvider>
          <AuthConsumer />
        </AuthProvider>,
      )
      expect(screen.getByTestId('impersonator').textContent).toBe(
        'Persisted Admin',
      )
    })

    test('discards malformed impersonatorAdmin from localStorage on mount', () => {
      const stored = {
        userDocId: 'cat1',
        memberId: 'GLV0001',
        fullName: 'Stale Admin',
        accountType: 'catechist',
        role: 'admin',
      }
      localStorage.setItem('giaoly_impersonator', JSON.stringify(stored))

      render(
        <AuthProvider>
          <AuthConsumer />
        </AuthProvider>,
      )
      expect(screen.getByTestId('impersonator').textContent).toBe(
        'no-impersonator',
      )
      expect(localStorage.getItem('giaoly_impersonator')).toBeNull()
    })

    test('updates mustChangePassword to false when markPasswordChanged is called', () => {
      render(
        <AuthProvider>
          <AuthConsumer />
        </AuthProvider>,
      )
      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'login' }))
      })
      expect(screen.getByTestId('must-change-pw').textContent).toBe('true')
      const storedBefore = JSON.parse(localStorage.getItem('giaoly_auth')!)
      expect(storedBefore.mustChangePassword).toBe(true)

      act(() => {
        fireEvent.click(
          screen.getByRole('button', { name: 'markPasswordChanged' }),
        )
      })
      expect(screen.getByTestId('must-change-pw').textContent).toBe('false')
      const storedAfter = JSON.parse(localStorage.getItem('giaoly_auth')!)
      expect(storedAfter.mustChangePassword).toBe(false)
    })

    test('preserves mustChangePassword flag when reading stored user from localStorage', () => {
      const stored = {
        userDocId: 'cat1',
        loginId: 'CAT-GLV0001',
        memberId: 'GLV0001',
        fullName: 'Persisted User',
        accountType: 'catechist',
        role: 'user',
        mustChangePassword: true,
        ...SESSION,
      }
      localStorage.setItem('giaoly_auth', JSON.stringify(stored))

      render(
        <AuthProvider>
          <AuthConsumer />
        </AuthProvider>,
      )
      expect(screen.getByTestId('user').textContent).toBe('Persisted User')
      expect(screen.getByTestId('must-change-pw').textContent).toBe('true')
    })
  })
})

describe('session handling', () => {
  const ADMIN = {
    userDocId: 'cat1',
    loginId: 'CAT-GLV0001',
    memberId: 'GLV0001',
    fullName: 'Admin',
    accountType: 'catechist',
    role: 'admin',
    ...SESSION,
  }
  const store = (key: string, v: unknown) =>
    localStorage.setItem(key, JSON.stringify(v))
  const renderProvider = () =>
    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    )
  const fetcherOf = () =>
    convexMock.setAuth.mock.calls[0][0] as () => Promise<string | null>

  test('discards stored user without sessionId/sessionSecret', () => {
    const { sessionId: _a, sessionSecret: _b, ...legacy } = ADMIN
    store('giaoly_auth', legacy)
    renderProvider()
    expect(screen.getByTestId('user').textContent).toBe('no-user')
    expect(localStorage.getItem('giaoly_auth')).toBeNull()
  })

  test('hides children until server confirms the session', async () => {
    store('giaoly_auth', ADMIN)
    let onChange: (ok: boolean) => void = () => {}
    convexMock.setAuth.mockImplementation((_f: unknown, cb: any) => {
      onChange = cb
    })
    renderProvider()
    await waitFor(() => expect(convexMock.setAuth).toHaveBeenCalledTimes(1))
    expect(typeof convexMock.setAuth.mock.calls[0][0]).toBe('function')
    expect(screen.queryByTestId('user')).toBeNull()

    act(() => onChange(true))
    expect(screen.getByTestId('user').textContent).toBe('Admin')
  })

  test('fetcher returns token from issueToken with session args', async () => {
    store('giaoly_auth', ADMIN)
    httpMutation.mockResolvedValue('jwt')
    renderProvider()
    await expect(fetcherOf()()).resolves.toBe('jwt')
    expect(httpMutation).toHaveBeenCalledWith(expect.anything(), {
      sessionId: 's1',
      secret: 'secret',
    })
  })

  test('fetcher returns null when the server rejects the session', async () => {
    store('giaoly_auth', ADMIN)
    httpMutation.mockRejectedValue(new Error('AUTHZ_UNAUTHENTICATED'))
    renderProvider()
    await expect(fetcherOf()()).resolves.toBeNull()
  })

  test('fetcher retries on TypeError then returns the token', async () => {
    store('giaoly_auth', ADMIN)
    httpMutation
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce('jwt')
    renderProvider()
    vi.useFakeTimers()
    try {
      const p = fetcherOf()()
      await vi.advanceTimersByTimeAsync(1000)
      await expect(p).resolves.toBe('jwt')
      expect(httpMutation).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  test('fetcher stops retrying once the effect is cleaned up', async () => {
    store('giaoly_auth', ADMIN)
    httpMutation.mockRejectedValue(new TypeError('Failed to fetch'))
    const { unmount } = renderProvider()
    vi.useFakeTimers()
    try {
      const p = fetcherOf()()
      await vi.advanceTimersByTimeAsync(0)
      unmount()
      await vi.advanceTimersByTimeAsync(1000)
      await expect(p).resolves.toBeNull()
      expect(httpMutation).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  test('onChange(false) clears user and localStorage', async () => {
    store('giaoly_auth', ADMIN)
    store('giaoly_impersonator', ADMIN)
    let onChange: (ok: boolean) => void = () => {}
    convexMock.setAuth.mockImplementation((_f: unknown, cb: any) => {
      onChange = cb
    })
    renderProvider()
    await waitFor(() => expect(convexMock.setAuth).toHaveBeenCalled())
    act(() => onChange(true))
    act(() => onChange(false))
    expect(screen.getByTestId('user').textContent).toBe('no-user')
    expect(localStorage.getItem('giaoly_auth')).toBeNull()
    expect(localStorage.getItem('giaoly_impersonator')).toBeNull()
  })

  test('clears convex auth when there is no user', async () => {
    renderProvider()
    await waitFor(() => expect(convexMock.clearAuth).toHaveBeenCalled())
    expect(convexMock.setAuth).not.toHaveBeenCalled()
  })

  test('logout revokes user and impersonator sessions and clears storage', async () => {
    store('giaoly_auth', TARGET_USER)
    store('giaoly_impersonator', ADMIN)
    renderProvider()
    await screen.findByTestId('user')
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'logout' }))
    })
    expect(httpMutation).toHaveBeenCalledTimes(2)
    expect(httpMutation).toHaveBeenCalledWith(expect.anything(), {
      sessionId: 's2',
      secret: 'secret2',
    })
    expect(httpMutation).toHaveBeenCalledWith(expect.anything(), {
      sessionId: 's1',
      secret: 'secret',
    })
    expect(localStorage.getItem('giaoly_auth')).toBeNull()
    expect(localStorage.getItem('giaoly_impersonator')).toBeNull()
  })

  test('logout does not throw when the revoke mutation rejects', async () => {
    store('giaoly_auth', ADMIN)
    renderProvider()
    await screen.findByTestId('user')
    httpMutation.mockRejectedValue(new Error('boom'))
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'logout' }))
    })
    await act(async () => {})
    expect(screen.getByTestId('user').textContent).toBe('no-user')
    expect(localStorage.getItem('giaoly_auth')).toBeNull()
  })

  test('returnToAdmin revokes the impersonated session and restores admin', async () => {
    store('giaoly_auth', ADMIN)
    renderProvider()
    await screen.findByTestId('user')
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'loginAs' }))
    })
    expect(screen.getByTestId('user').textContent).toBe('Trần Thị B')
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'returnToAdmin' }))
    })
    expect(httpMutation).toHaveBeenCalledTimes(1)
    expect(httpMutation).toHaveBeenCalledWith(expect.anything(), {
      sessionId: 's2',
      secret: 'secret2',
    })
    expect(screen.getByTestId('user').textContent).toBe('Admin')
    expect(screen.getByTestId('impersonator').textContent).toBe(
      'no-impersonator',
    )
  })
})
