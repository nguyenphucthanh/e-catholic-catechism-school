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

    expect(screen.getByText(/Hướng dẫn dành cho Học sinh/)).toBeInTheDocument()
    expect(screen.getByText(/Điểm danh & Nhận diện QR/)).toBeInTheDocument()
  })

  test('renders english markdown content when language is en', () => {
    vi.mocked(useTranslation).mockReturnValue({
      t: ((key: string) => key) as any,
      i18n: {
        language: 'en-US',
        changeLanguage: vi.fn(),
      } as any,
    } as any)
    vi.mocked(useParams).mockReturnValue({ role: 'student' })
    const Component = (Route as any).options.component
    render(<Component />)

    expect(screen.getByText(/Guide for Students/i)).toBeInTheDocument()
  })

  test('throws notFound when role parameter is invalid', () => {
    vi.mocked(useParams).mockReturnValue({ role: 'invalid_role' })
    const Component = (Route as any).options.component

    expect(() => render(<Component />)).toThrow()
  })

  test('renders catechist guide when parameter role is catechist', () => {
    vi.mocked(useParams).mockReturnValue({ role: 'catechist' })
    const Component = (Route as any).options.component
    render(<Component />)

    expect(
      screen.getByText(/Hướng dẫn dành cho Giáo lý viên/),
    ).toBeInTheDocument()
  })
})
