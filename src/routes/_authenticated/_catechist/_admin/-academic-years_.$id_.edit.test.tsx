import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { useNavigate, useParams } from '@tanstack/react-router'
import { Route } from './academic-years_.$id_.edit'
import { useAuth } from '~/lib/auth'
import { isAdmin } from '~/lib/permissions'

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router')
  return {
    ...actual,
    useParams: vi.fn(),
    useNavigate: vi.fn(),
  }
})

vi.mock('~/lib/permissions', () => ({
  isAdmin: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(useQuery).mockClear()
  vi.mocked(useMutation).mockReturnValue(vi.fn() as any)
  vi.mocked(useParams).mockReturnValue({ id: 'year123' })
  vi.mocked(toast.success).mockClear()
  vi.mocked(toast.error).mockClear()
  vi.mocked(useNavigate).mockReturnValue(vi.fn())
})

const sampleYear = {
  _id: 'year123',
  name: '2024-2025',
  startDate: '2024-09-01',
  endDate: '2025-05-31',
  timezone: 'Asia/Ho_Chi_Minh',
  isActive: true,
  isDeleted: false,
}

describe('EditAcademicYearPage', () => {
  test('renders unauthorized when user cannot manage', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'user123', role: 'user' },
    } as any)
    vi.mocked(isAdmin).mockReturnValue(false)

    const EditPage = (Route as any).options.component
    render(<EditPage />)

    expect(screen.getByText('common.contactAdmin')).toBeInTheDocument()
  })

  test('renders skeleton while year data is loading', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'admin123', role: 'admin' },
    } as any)
    vi.mocked(isAdmin).mockReturnValue(true)
    vi.mocked(useQuery).mockReturnValue(undefined)

    const EditPage = (Route as any).options.component
    const { container } = render(<EditPage />)

    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  test('renders not found when year is null', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'admin123', role: 'admin' },
    } as any)
    vi.mocked(isAdmin).mockReturnValue(true)
    vi.mocked(useQuery).mockReturnValue(null)

    const EditPage = (Route as any).options.component
    render(<EditPage />)

    expect(screen.getByText('Year not found')).toBeInTheDocument()
  })

  test('renders form when year data is available', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'admin123', role: 'admin' },
    } as any)
    vi.mocked(isAdmin).mockReturnValue(true)
    vi.mocked(useQuery).mockReturnValue(sampleYear)

    const EditPage = (Route as any).options.component
    render(<EditPage />)

    expect(screen.getByText('academicYears.edit.title')).toBeInTheDocument()
  })

  test('navigates to list on cancel', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'admin123', role: 'admin' },
    } as any)
    vi.mocked(isAdmin).mockReturnValue(true)
    vi.mocked(useQuery).mockReturnValue(sampleYear)
    const navigateMock = vi.fn()
    vi.mocked(useNavigate).mockReturnValue(navigateMock)

    const EditPage = (Route as any).options.component
    render(<EditPage />)

    fireEvent.click(screen.getByText('common.cancel'))
    expect(navigateMock).toHaveBeenCalledWith({ to: '/academic-years' })
  })
})
