import { describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { Route } from './_authenticated'
import { useAuth } from '~/lib/auth'

// Mock the AppSidebar component to keep tests focused and avoid icon complexity
vi.mock('~/components/app-sidebar', () => ({
  AppSidebar: ({ user, onLogout }: any) => (
    <div data-testid="app-sidebar">
      <span>{user.fullName}</span>
      <button onClick={onLogout}>LogoutButton</button>
    </div>
  ),
}))

describe('AuthenticatedLayout component', () => {
  test('redirects to login when user is unauthenticated', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: null,
    })

    const LayoutComponent = (Route as any).options.component
    render(<LayoutComponent />)

    const navigateEl = screen.getByTestId('navigate')
    expect(navigateEl).toBeInTheDocument()
    expect(navigateEl).toHaveAttribute('data-to', '/login')
  })

  test('renders layout with sidebar, outlet, and breadcrumbs when authenticated', () => {
    const mockUser = {
      _id: 'user123',
      memberId: 'GLV0001',
      fullName: 'Nguyễn Văn A',
      role: 'catechist',
    } as any

    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockUser,
    })

    vi.mocked(useLocation).mockReturnValue({
      pathname: '/profile',
    } as any)

    const LayoutComponent = (Route as any).options.component
    render(<LayoutComponent />)

    expect(screen.getByTestId('app-sidebar')).toBeInTheDocument()
    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument()
    expect(screen.getByTestId('outlet')).toBeInTheDocument()
    expect(screen.getByText('nav.profile')).toBeInTheDocument()
  })

  test('triggers logout and navigates to login when logout is clicked', () => {
    const logoutMock = vi.fn()
    const navigateMock = vi.fn()
    const mockUser = {
      _id: 'user123',
      memberId: 'GLV0001',
      fullName: 'Nguyễn Văn A',
      role: 'catechist',
    } as any

    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: logoutMock,
      user: mockUser,
    })

    vi.mocked(useNavigate).mockReturnValue(navigateMock)

    const LayoutComponent = (Route as any).options.component
    render(<LayoutComponent />)

    const logoutBtn = screen.getByRole('button', { name: 'LogoutButton' })
    logoutBtn.click()

    expect(logoutMock).toHaveBeenCalled()
    expect(navigateMock).toHaveBeenCalledWith({ to: '/login' })
  })
})
