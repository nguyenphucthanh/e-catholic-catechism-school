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

const sampleSemesters = [
  { _id: 's1', semesterNumber: 1 },
  { _id: 's2', semesterNumber: 2, startDate: '2025-01-10' },
]

// route queries year via `get` and semesters via `listSemesters`
function mockQueries(year: unknown, ...rest: Array<unknown>) {
  const semesters = rest.length ? rest[0] : sampleSemesters
  vi.mocked(useQuery).mockImplementation((...args: Array<any>) =>
    args[0]?.[Symbol.for('functionName')] === 'academicYears:listSemesters'
      ? (semesters as any)
      : (year as any),
  )
}

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
    mockQueries(sampleYear)

    const EditPage = (Route as any).options.component
    render(<EditPage />)

    expect(screen.getByText('academicYears.edit.title')).toBeInTheDocument()
  })

  test('shows skeleton while semesters are loading', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'admin123', role: 'admin' },
    } as any)
    vi.mocked(isAdmin).mockReturnValue(true)
    mockQueries(sampleYear, undefined)

    const EditPage = (Route as any).options.component
    const { container } = render(<EditPage />)

    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(
      0,
    )
  })

  test('passes stored semester start dates (semesters 2..N) to the form', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'admin123', role: 'admin' },
    } as any)
    vi.mocked(isAdmin).mockReturnValue(true)
    mockQueries(sampleYear, [
      ...sampleSemesters,
      { _id: 's3', semesterNumber: 3 },
    ])

    const EditPage = (Route as any).options.component
    render(<EditPage />)

    const inputs = screen.getAllByLabelText(
      /academicYears\.fields\.semesterStartDate/,
    )
    expect(inputs).toHaveLength(2)
    expect(inputs[0]).toHaveValue('2025-01-10')
    expect(inputs[1]).toHaveValue('')
  })

  test('navigates to list on cancel', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'admin123', role: 'admin' },
    } as any)
    vi.mocked(isAdmin).mockReturnValue(true)
    mockQueries(sampleYear)
    const navigateMock = vi.fn()
    vi.mocked(useNavigate).mockReturnValue(navigateMock)

    const EditPage = (Route as any).options.component
    render(<EditPage />)

    fireEvent.click(screen.getByText('common.cancel'))
    expect(navigateMock).toHaveBeenCalledWith({ to: '/academic-years' })
  })
})
