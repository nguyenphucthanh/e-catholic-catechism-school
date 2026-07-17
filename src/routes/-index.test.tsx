import { describe, expect, test, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, act } from '@testing-library/react'
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
    expect(
      screen.getByText('TanStack là gì? Có miễn phí không?'),
    ).toBeInTheDocument()
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

  test('updates active nav item when section intersection changes', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: null,
    })

    let observerCallback: any = null
    const originalIntersectionObserver = window.IntersectionObserver

    window.IntersectionObserver = function (callback: any) {
      observerCallback = callback
      return {
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
        root: null,
        rootMargin: '',
        thresholds: [],
        takeRecords: vi.fn(() => []),
      }
    } as any

    const mockElements: Record<string, any> = {
      philosophy: {
        id: 'philosophy',
        getBoundingClientRect: () => ({ top: 10, bottom: 500 }),
      },
      architecture: {
        id: 'architecture',
        getBoundingClientRect: () => ({ top: 200, bottom: 800 }),
      },
    }
    const getElementSpy = vi
      .spyOn(document, 'getElementById')
      .mockImplementation((id) => {
        return mockElements[id] || null
      })

    const IndexPageComponent = (Route as any).options.component
    render(<IndexPageComponent />)

    expect(observerCallback).not.toBeNull()

    // Trigger an intersection event with multiple elements (covers distance check true and false branches)
    act(() => {
      observerCallback([
        {
          target: mockElements.philosophy,
          isIntersecting: true,
        },
        {
          target: mockElements.architecture,
          isIntersecting: true,
        },
      ])
    })

    // Check if the active class is applied to Philosophy (since it is closer: 10 < 200)
    const philosophyLink = screen.getByText('Triết Lý')
    expect(philosophyLink).toHaveClass('font-bold')

    // Trigger an intersection event for philosophy leaving (covers the else branch)
    act(() => {
      observerCallback([
        {
          target: mockElements.philosophy,
          isIntersecting: false,
        },
      ])
    })

    // Trigger with only stack which is null (covers if (el) false and if (mostProminentId) false)
    act(() => {
      observerCallback([
        {
          target: { id: 'stack' },
          isIntersecting: true,
        },
      ])
    })

    // Test scroll to top clears active section
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(50)
    act(() => {
      fireEvent.scroll(window)
    })
    expect(philosophyLink).not.toHaveClass('font-bold')

    // Clean up
    window.IntersectionObserver = originalIntersectionObserver
    getElementSpy.mockRestore()
  })
})
