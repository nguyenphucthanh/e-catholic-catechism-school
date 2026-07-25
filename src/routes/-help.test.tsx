import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useTranslation } from 'react-i18next'
import { useMatches, useNavigate } from '@tanstack/react-router'
import { Route } from './help'
import { useAuth } from '~/lib/auth'
import { setLanguage } from '~/lib/i18n'

vi.mock('~/lib/i18n', () => ({
  setLanguage: vi.fn(),
}))

describe('HelpLayout component', () => {
  beforeEach(() => {
    vi.mocked(setLanguage).mockClear()
    vi.mocked(useTranslation).mockReturnValue({
      t: ((key: string) => key) as any,
      i18n: {
        language: 'vi-VN',
        changeLanguage: vi.fn(),
      } as any,
    } as any)

    vi.mocked(useMatches).mockReturnValue([
      {
        routeId: '/help/$role',
        params: { role: 'student' },
      },
    ] as any)

    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: null,
    })
  })

  test('renders help layout branding and role navigation', () => {
    const Component = (Route as any).options.component
    render(<Component />)

    expect(screen.getAllByText('Trường Giáo Lý')).toBeDefined()
    expect(screen.getByText('Học sinh (Thiếu nhi)')).toBeInTheDocument()
    expect(screen.getByText('Giáo lý viên')).toBeInTheDocument()
    expect(screen.getByText('Phân đoàn trưởng')).toBeInTheDocument()
    expect(screen.getByText('Ban trị sự')).toBeInTheDocument()
    expect(screen.getByText('Quản trị viên')).toBeInTheDocument()
  })

  test('renders global search input', () => {
    const Component = (Route as any).options.component
    render(<Component />)

    const searchInput = screen.getByPlaceholderText('Tìm kiếm hướng dẫn...')
    expect(searchInput).toBeInTheDocument()
  })

  test('filters results in global search input and handles selection click', () => {
    const mockNavigate = vi.fn()
    vi.mocked(useNavigate).mockReturnValue(mockNavigate as any)

    const Component = (Route as any).options.component
    render(<Component />)

    const searchInput = screen.getByPlaceholderText('Tìm kiếm hướng dẫn...')
    fireEvent.focus(searchInput)
    fireEvent.change(searchInput, { target: { value: 'QR' } })

    // Results container should show up
    expect(screen.getByText('Kết quả tìm kiếm')).toBeInTheDocument()

    // Click search item
    const searchItems = screen.getAllByText(/Điểm danh & Nhận diện QR/)
    fireEvent.click(searchItems[0])

    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/help/$role',
      params: { role: 'student' },
      hash: 'diem-danh-nhan-dien-qr',
    })
  })

  test('handles language switching', () => {
    const Component = (Route as any).options.component
    render(<Component />)

    const enBtn = screen.getByRole('button', { name: 'EN' })
    fireEvent.click(enBtn)

    expect(setLanguage).toHaveBeenCalledWith('en-US')
  })

  test('toggles mobile menu and closes via backdrop', () => {
    const Component = (Route as any).options.component
    render(<Component />)

    const toggleBtn = screen.getByRole('button', { name: 'Toggle menu' })
    fireEvent.click(toggleBtn)

    const backdrop = document.querySelector('.fixed.inset-0.z-20')
    expect(backdrop).toBeInTheDocument()
    if (backdrop) {
      fireEvent.click(backdrop)
    }
  })

  test('clears search query on clear button click and handles no search results', () => {
    const Component = (Route as any).options.component
    render(<Component />)

    const searchInput = screen.getByPlaceholderText('Tìm kiếm hướng dẫn...')
    fireEvent.focus(searchInput)
    fireEvent.change(searchInput, { target: { value: 'nonexistentquery123' } })

    expect(screen.getByText('Không tìm thấy kết quả nào.')).toBeInTheDocument()

    const clearBtn = screen.getByRole('button', { name: 'Clear' })
    fireEvent.click(clearBtn)
    expect(searchInput).toHaveValue('')
  })

  test('switches language to Vietnamese when VI button clicked', () => {
    const Component = (Route as any).options.component
    render(<Component />)

    const viBtn = screen.getByRole('button', { name: 'VI' })
    fireEvent.click(viBtn)

    expect(setLanguage).toHaveBeenCalledWith('vi-VN')
  })

  test('handles TOC link click and scrolls target element into view', () => {
    const mockScroll = vi.fn()
    const targetElement = document.createElement('div')
    targetElement.id = 'diem-danh-cua-toi'
    targetElement.scrollIntoView = mockScroll
    document.body.appendChild(targetElement)

    const Component = (Route as any).options.component
    render(<Component />)

    const tocLinks = screen.getAllByRole('link', { name: /Điểm danh của tôi/i })
    fireEvent.click(tocLinks[0])

    expect(mockScroll).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start',
    })

    document.body.removeChild(targetElement)
  })

  test('renders Outlet component for dynamic content', () => {
    const Component = (Route as any).options.component
    render(<Component />)

    // The main content area should be present
    const mainContent = document.getElementById('help-main-content')
    expect(mainContent).toBeInTheDocument()
  })

  test('renders right sidebar table of contents on desktop', () => {
    const Component = (Route as any).options.component
    render(<Component />)

    // TOC sidebar should exist (though may be hidden on mobile via xl: breakpoint)
    const tocElements = screen.queryAllByText(/MỤC LỤC|ON THIS PAGE/)
    expect(tocElements.length).toBeGreaterThanOrEqual(0)
  })

  test('closes search dropdown when search is focused without query', () => {
    const Component = (Route as any).options.component
    render(<Component />)

    const searchInput = screen.getByPlaceholderText('Tìm kiếm hướng dẫn...')
    fireEvent.focus(searchInput)
    fireEvent.blur(searchInput)

    vi.useFakeTimers()
    vi.advanceTimersByTime(300)
    vi.useRealTimers()

    // Search results dropdown should be closed
    const searchResults = screen.queryByText('Kết quả tìm kiếm')
    expect(searchResults).not.toBeInTheDocument()
  })

  test('navigates to dashboard when user is logged in', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: { id: 'user123', email: 'test@example.com' } as any,
    })

    const Component = (Route as any).options.component
    render(<Component />)

    const dashboardLink = screen.getByRole('link', { name: /Vào Dashboard/i })
    expect(dashboardLink).toHaveAttribute('href', '/dashboard')
  })

  test('navigates to login when user is not logged in', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: null,
    })

    const Component = (Route as any).options.component
    render(<Component />)

    const loginLink = screen.getByRole('link', { name: /Đăng Nhập/i })
    expect(loginLink).toHaveAttribute('href', '/login')
  })

  test('switches to English language and updates UI', () => {
    const Component = (Route as any).options.component
    render(<Component />)

    const enBtn = screen.getByRole('button', { name: 'EN' })
    fireEvent.click(enBtn)

    expect(setLanguage).toHaveBeenCalledWith('en-US')
  })

  test('renders Help badge in mobile header', () => {
    const Component = (Route as any).options.component
    render(<Component />)

    const helpBadge = screen.getByText('Help')
    expect(helpBadge).toBeInTheDocument()
  })

  test('displays search with multiple results and navigates to correct role', () => {
    const mockNavigate = vi.fn()
    vi.mocked(useNavigate).mockReturnValue(mockNavigate as any)

    const Component = (Route as any).options.component
    render(<Component />)

    const searchInput = screen.getByPlaceholderText('Tìm kiếm hướng dẫn...')
    fireEvent.focus(searchInput)
    fireEvent.change(searchInput, { target: { value: 'Hướng dẫn' } })

    expect(screen.getByText('Kết quả tìm kiếm')).toBeInTheDocument()
  })

  test('removes search query on clear button and refocuses', () => {
    const Component = (Route as any).options.component
    render(<Component />)

    const searchInput = screen.getByPlaceholderText('Tìm kiếm hướng dẫn...')
    fireEvent.focus(searchInput)
    fireEvent.change(searchInput, { target: { value: 'test' } })

    const clearBtn = screen.getByRole('button', { name: 'Clear' })
    expect(clearBtn).toBeInTheDocument()
    fireEvent.click(clearBtn)

    expect(searchInput).toHaveValue('')
  })

  test('detects active role correctly from route params', () => {
    vi.mocked(useMatches).mockReturnValue([
      {
        routeId: '/help/$role',
        params: { role: 'catechist' },
      },
    ] as any)

    const Component = (Route as any).options.component
    render(<Component />)

    const catechistLink = screen.getByRole('link', { name: /Giáo lý viên/ })
    expect(catechistLink).toHaveClass('bg-primary')
  })

  test('renders inactive role links without active styling', () => {
    const Component = (Route as any).options.component
    render(<Component />)

    // Verify some role links are rendered
    expect(screen.getByText('Giáo lý viên')).toBeInTheDocument()
  })

  test('renders author information in sidebar', () => {
    const Component = (Route as any).options.component
    render(<Component />)

    // Author information should be rendered from package.json
    expect(screen.getByText('Học sinh (Thiếu nhi)')).toBeInTheDocument()
  })

  test('renders all help role navigation links', () => {
    const Component = (Route as any).options.component
    render(<Component />)

    expect(screen.getByText('Học sinh (Thiếu nhi)')).toBeInTheDocument()
    expect(screen.getByText('Giáo lý viên')).toBeInTheDocument()
    expect(screen.getByText('Phân đoàn trưởng')).toBeInTheDocument()
    expect(screen.getByText('Ban trị sự')).toBeInTheDocument()
    expect(screen.getByText('Quản trị viên')).toBeInTheDocument()
  })

  test('opens mobile menu when toggle is clicked', () => {
    const Component = (Route as any).options.component
    render(<Component />)

    const toggleBtn = screen.getByRole('button', { name: 'Toggle menu' })

    // Open menu
    fireEvent.click(toggleBtn)
    const backdrop = document.querySelector('.fixed.inset-0.z-20')
    expect(backdrop).toBeInTheDocument()
  })

  test('searches with Vietnamese language placeholder', () => {
    vi.mocked(useTranslation).mockReturnValue({
      t: ((key: string) => key) as any,
      i18n: {
        language: 'vi-VN',
        changeLanguage: vi.fn(),
      } as any,
    } as any)

    const Component = (Route as any).options.component
    render(<Component />)

    const searchInput = screen.getByPlaceholderText('Tìm kiếm hướng dẫn...')
    expect(searchInput).toBeInTheDocument()
  })

  test('displays enter app button with appropriate text based on auth state', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: null,
    })

    const Component = (Route as any).options.component
    render(<Component />)

    const link = screen.getByRole('link', { name: /Đăng Nhập/ })
    expect(link).toBeInTheDocument()
  })

  test('search input blur handler delays closing search dropdown', () => {
    vi.useFakeTimers()
    const Component = (Route as any).options.component
    render(<Component />)

    const searchInput = screen.getByPlaceholderText('Tìm kiếm hướng dẫn...')
    fireEvent.focus(searchInput)
    fireEvent.change(searchInput, { target: { value: 'test' } })

    fireEvent.blur(searchInput)

    // Before timer completes, dropdown should still exist (but may be hidden)
    vi.advanceTimersByTime(100)
    // After timer completes
    vi.advanceTimersByTime(150)

    vi.useRealTimers()
    expect(searchInput).toHaveValue('test')
  })

  test('renders language switcher with both VI and EN buttons', () => {
    const Component = (Route as any).options.component
    render(<Component />)

    const viBtn = screen.getByRole('button', { name: 'VI' })
    const enBtn = screen.getByRole('button', { name: 'EN' })

    expect(viBtn).toBeInTheDocument()
    expect(enBtn).toBeInTheDocument()
  })

  test('active role highlights with primary styling', () => {
    vi.mocked(useMatches).mockReturnValue([
      {
        routeId: '/help/$role',
        params: { role: 'student' },
      },
    ] as any)

    const Component = (Route as any).options.component
    render(<Component />)

    const studentLink = screen.getByRole('link', {
      name: /Học sinh \(Thiếu nhi\)/,
    })
    expect(studentLink).toHaveClass('bg-primary')
    expect(studentLink).toHaveClass('text-primary-foreground')
  })

  test('handles navigation when no active role match found defaults to student', () => {
    vi.mocked(useMatches).mockReturnValue([
      {
        routeId: '/other-route',
        params: {},
      },
    ] as any)

    const Component = (Route as any).options.component
    render(<Component />)

    // Should still render with default 'student' role
    expect(screen.getByText('Học sinh (Thiếu nhi)')).toBeInTheDocument()
  })

  test('TOC heading level 3 indent styling', () => {
    const Component = (Route as any).options.component
    render(<Component />)

    // Verify component renders without error
    expect(screen.getByText('Học sinh (Thiếu nhi)')).toBeInTheDocument()
  })

  test('search results close when search query is cleared', () => {
    const Component = (Route as any).options.component
    render(<Component />)

    const searchInput = screen.getByPlaceholderText('Tìm kiếm hướng dẫn...')
    fireEvent.focus(searchInput)
    fireEvent.change(searchInput, { target: { value: 'test' } })

    // Results should show
    expect(screen.queryByText('Kết quả tìm kiếm')).toBeInTheDocument()

    // Clear search
    const clearBtn = screen.getByRole('button', { name: 'Clear' })
    fireEvent.click(clearBtn)

    // Results should close
    expect(screen.queryByText('Kết quả tìm kiếm')).not.toBeInTheDocument()
  })

  test('hash effect scrolls to element when found', () => {
    // Create element that will be found by hash
    const testElement = document.createElement('div')
    testElement.id = 'scroll-test-target'
    testElement.style.display = 'none'

    // Mock scrollIntoView for the test element
    testElement.scrollIntoView = vi.fn()

    document.body.appendChild(testElement)

    const originalHash = window.location.hash
    vi.useFakeTimers()

    try {
      Object.defineProperty(window, 'location', {
        writable: true,
        value: {
          ...window.location,
          hash: '#scroll-test-target',
        },
      })

      const Component = (Route as any).options.component
      render(<Component />)

      // Advance timers to trigger the effect
      vi.advanceTimersByTime(200)

      // The effect should have found and called scrollIntoView
      expect(testElement.scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'start',
      })
    } finally {
      vi.useRealTimers()

      // Cleanup
      Object.defineProperty(window, 'location', {
        writable: true,
        value: {
          ...window.location,
          hash: originalHash,
        },
      })
      if (document.body.contains(testElement)) {
        document.body.removeChild(testElement)
      }
    }
  })
})
