import { describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Route as AdminLayoutRoute } from '../_admin'
import { useAuth } from '~/lib/auth'

const AdminLayoutComponent = (AdminLayoutRoute as any).options.component

describe('_admin layout guard (protects /import route)', () => {
  test('redirects non-admin users away instead of rendering the import route outlet', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: { _id: 'u1', role: 'user' } as any,
    })

    render(<AdminLayoutComponent />)

    const navigate = screen.getByTestId('navigate')
    expect(navigate).toHaveAttribute('data-to', '/dashboard')
    expect(screen.queryByTestId('outlet')).not.toBeInTheDocument()
  })

  test('renders the outlet (which hosts the import route) for admin users', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: { _id: 'u1', role: 'admin' } as any,
    })

    render(<AdminLayoutComponent />)

    expect(screen.getByTestId('outlet')).toBeInTheDocument()
    expect(screen.queryByTestId('navigate')).not.toBeInTheDocument()
  })

  test('redirects when user is null (unauthenticated)', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: null,
    })

    render(<AdminLayoutComponent />)

    expect(screen.getByTestId('navigate')).toHaveAttribute(
      'data-to',
      '/dashboard',
    )
  })
})
