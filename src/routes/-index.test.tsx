import { describe, expect, test, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Route } from './index'
import { useAuth } from '~/lib/auth'

describe('IndexPage route component', () => {
  beforeEach(() => {
    // Reset document classes
    document.documentElement.className = ''
    vi.clearAllMocks()
  })

  test('renders landing page for unauthenticated user successfully', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: null,
    })

    const IndexPageComponent = (Route as any).options.component
    render(<IndexPageComponent />)

    // Check brand name and headers
    expect(screen.getAllByText('eCCS')[0]).toBeInTheDocument()
    expect(screen.getByText(/Nền Tảng Quản Lý Giáo Lý/i)).toBeInTheDocument()
    expect(screen.getByText('Vào Cổng Demo')).toBeInTheDocument()
    expect(screen.getByText('Tại Sao Chọn eCCS?')).toBeInTheDocument()
    expect(screen.getByText('Kiến Trúc')).toBeInTheDocument()
    expect(screen.getAllByText('Technical Stack')[0]).toBeInTheDocument()
    expect(screen.getByText('Câu Hỏi Kỹ Thuật')).toBeInTheDocument()
    expect(screen.getByText('TanStack là gì? Có miễn phí không?')).toBeInTheDocument()
    expect(screen.getAllByText(/Self-host/i)[0]).toBeInTheDocument()
    expect(screen.getByText('Quản lý Học viên & Hồ sơ')).toBeInTheDocument()
    expect(screen.getByText('Liên kết Gia đình & Anh em')).toBeInTheDocument()
    expect(screen.getByText('Hồ sơ Bí tích Tích hợp')).toBeInTheDocument()
  })

  test('redirects authenticated user to dashboard', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: {
        accountType: 'catechist',
        userDocId: 'cat1',
        memberId: 'GLV0001',
        fullName: 'Test User',
        role: 'user',
      } as any,
    })

    const IndexPageComponent = (Route as any).options.component
    render(<IndexPageComponent />)

    const navigateEl = screen.getByTestId('navigate')
    expect(navigateEl).toBeInTheDocument()
    expect(navigateEl).toHaveAttribute('data-to', '/dashboard')
  })

  test('toggles theme between dark and light mode when clicking toggle button', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: null,
    })

    const IndexPageComponent = (Route as any).options.component
    render(<IndexPageComponent />)

    const themeToggleBtn = screen.getByLabelText('Toggle theme')
    expect(themeToggleBtn).toBeInTheDocument()

    // Initially light since className reset
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    // Click to toggle to dark
    fireEvent.click(themeToggleBtn)
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    // Click to toggle back to light
    fireEvent.click(themeToggleBtn)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})
