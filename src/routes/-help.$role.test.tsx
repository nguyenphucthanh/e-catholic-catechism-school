import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useTranslation } from 'react-i18next'
import { useParams } from '@tanstack/react-router'
import { Route } from './help.$role'

vi.mock('@tanstack/react-router', () => {
  return {
    createFileRoute: vi.fn(() => (options: any) => ({ options })),
    useParams: vi.fn(),
    notFound: vi.fn(),
  }
})

describe('HelpRoleDetail route component', () => {
  beforeEach(() => {
    vi.mocked(useTranslation).mockReturnValue({
      t: ((key: string) => key) as any,
      i18n: {
        language: 'vi-VN',
        changeLanguage: vi.fn(),
      } as any,
    } as any)
  })

  test('renders student guide when parameter role is student', () => {
    vi.mocked(useParams).mockReturnValue({ role: 'student' })
    const Component = (Route as any).options.component
    render(<Component />)

    expect(screen.getByText(/Hướng dẫn dành cho Học viên/)).toBeInTheDocument()
    expect(screen.getByText(/Điểm danh bằng mã QR/)).toBeInTheDocument()
  })

  test('renders admin guide when parameter role is admin', () => {
    vi.mocked(useParams).mockReturnValue({ role: 'admin' })
    const Component = (Route as any).options.component
    render(<Component />)

    expect(
      screen.getByText(/Hướng dẫn dành cho Quản trị viên/),
    ).toBeInTheDocument()
    expect(screen.getByText(/Cấu hình hệ thống chung/)).toBeInTheDocument()
  })
})
