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
    expect(screen.getByText('Học viên (Thiếu nhi)')).toBeInTheDocument()
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
    const searchItems = screen.getAllByText(/Điểm danh bằng mã QR/)
    fireEvent.click(searchItems[0])

    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/help/$role',
      params: { role: 'student' },
      hash: 'diem-danh-bang-ma-qr',
    })
  })

  test('handles language switching', () => {
    const Component = (Route as any).options.component
    render(<Component />)

    const enBtn = screen.getByRole('button', { name: 'EN' })
    fireEvent.click(enBtn)

    expect(setLanguage).toHaveBeenCalledWith('en-US')
  })

  test('toggles mobile menu', () => {
    const Component = (Route as any).options.component
    render(<Component />)

    const toggleBtn = screen.getByRole('button', { name: '' }) // hamburger menu button
    fireEvent.click(toggleBtn)
  })
})
