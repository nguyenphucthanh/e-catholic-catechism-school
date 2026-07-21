import * as React from 'react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { useNavigate, useParams } from '@tanstack/react-router'
import { Route } from './academic-years_.$id'
import { useAuth } from '~/lib/auth'

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router')
  return {
    ...actual,
    useParams: vi.fn(),
    useNavigate: vi.fn(),
    Navigate: ({ to }: { to: string }) =>
      React.createElement('div', { 'data-testid': 'navigate', 'data-to': to }),
    Link: ({ children, to, params, className }: any) => (
      <a href={to} data-params={JSON.stringify(params)} className={className}>
        {children}
      </a>
    ),
  }
})

const sampleYear = {
  _id: 'year123',
  name: '2024-2025',
  startDate: '2024-09-01',
  endDate: '2025-05-31',
  timezone: 'Asia/Ho_Chi_Minh',
  isActive: false,
  isDeleted: false,
}

const sampleSemesters = [
  { _id: 'sem1', semesterNumber: 1 },
  { _id: 'sem2', semesterNumber: 2 },
]

function mockQueries({
  year,
  semesters,
}: {
  year: unknown
  semesters: unknown
}) {
  vi.mocked(useQuery).mockImplementation(((query: any) => {
    const path = query?.[Symbol.for('functionName')]
    if (path === 'academicYears:get') return year
    if (path === 'academicYears:listSemesters') return semesters
    if (path === 'orgStats:getOrgStats') return undefined
    if (path === 'branchStats:getBranchStats') return undefined
    return undefined
  }) as typeof useQuery)
}

let setActiveMock: ReturnType<typeof vi.fn>
let deleteMock: ReturnType<typeof vi.fn>

function mockMutations() {
  vi.mocked(useMutation).mockImplementation(((fnRef: any) => {
    const path = fnRef?.[Symbol.for('functionName')]
    if (path === 'academicYears:setActive') return setActiveMock
    if (path === 'academicYears:softDelete') return deleteMock
    return vi.fn()
  }) as any)
}

beforeEach(() => {
  vi.mocked(useParams).mockReturnValue({ id: 'year123' })
  vi.mocked(useNavigate).mockReturnValue(vi.fn())
  setActiveMock = vi.fn().mockResolvedValue(undefined)
  deleteMock = vi.fn().mockResolvedValue(undefined)
  mockMutations()
  vi.mocked(toast.success).mockClear()
  vi.mocked(toast.error).mockClear()
})

function renderPage() {
  const DetailPage = (Route as any).options.component
  return render(<DetailPage />)
}

describe('AcademicYearDetailPage', () => {
  test('renders loading skeleton for semesters while data is pending', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'catechist123', role: 'user' },
    } as any)
    mockQueries({ year: sampleYear, semesters: undefined })

    const { container } = renderPage()

    expect(screen.getByText('2024-2025')).toBeInTheDocument()
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  test('redirects to list when year is null', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'catechist123', role: 'user' },
    } as any)
    mockQueries({ year: null, semesters: undefined })

    renderPage()

    expect(screen.getByTestId('navigate')).toHaveAttribute(
      'data-to',
      '/academic-years',
    )
  })

  test('non-admin user does not see management action buttons', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'catechist123', role: 'user' },
    } as any)
    mockQueries({ year: sampleYear, semesters: sampleSemesters })

    renderPage()

    expect(
      screen.queryByText('academicYears.actions.setActive'),
    ).not.toBeInTheDocument()
    expect(screen.queryByText('common.edit')).not.toBeInTheDocument()
    expect(screen.queryByText('common.delete')).not.toBeInTheDocument()
  })

  test('admin user sees management action buttons', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'admin123', role: 'admin' },
    } as any)
    mockQueries({ year: sampleYear, semesters: sampleSemesters })

    renderPage()

    expect(
      screen.getByText('academicYears.actions.setActive'),
    ).toBeInTheDocument()
    expect(screen.getByText('common.edit')).toBeInTheDocument()
    expect(screen.getByText('common.delete')).toBeInTheDocument()
  })

  test('renders a badge per semester', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'admin123', role: 'admin' },
    } as any)
    mockQueries({ year: sampleYear, semesters: sampleSemesters })

    renderPage()

    expect(screen.getAllByText('semesters.numberLabel').length).toBe(
      sampleSemesters.length,
    )
  })

  test('set active succeeds and shows success toast', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'admin123', role: 'admin' },
    } as any)
    mockQueries({ year: sampleYear, semesters: sampleSemesters })

    renderPage()
    fireEvent.click(screen.getByText('academicYears.actions.setActive'))

    await waitFor(() => {
      expect(setActiveMock).toHaveBeenCalledWith({
        requesterId: 'admin123',
        academicYearId: 'year123',
      })
    })
    expect(toast.success).toHaveBeenCalledWith('academicYears.setActiveSuccess')
  })

  test('set active failure shows error toast', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'admin123', role: 'admin' },
    } as any)
    setActiveMock.mockRejectedValueOnce(new Error('boom'))
    mockQueries({ year: sampleYear, semesters: sampleSemesters })

    renderPage()
    fireEvent.click(screen.getByText('academicYears.actions.setActive'))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('academicYears.saveError')
    })
  })

  test('set active button is disabled when already active', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'admin123', role: 'admin' },
    } as any)
    mockQueries({
      year: { ...sampleYear, isActive: true },
      semesters: sampleSemesters,
    })

    renderPage()

    expect(
      screen.getByText('academicYears.actions.setActive').closest('button'),
    ).toBeDisabled()
  })

  test('delete succeeds and navigates away', async () => {
    const navigateMock = vi.fn()
    vi.mocked(useNavigate).mockReturnValue(navigateMock)
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'admin123', role: 'admin' },
    } as any)
    mockQueries({ year: sampleYear, semesters: sampleSemesters })

    renderPage()
    fireEvent.click(screen.getByText('common.delete'))
    const dialog = await screen.findByRole('alertdialog')
    fireEvent.click(within(dialog).getByText('academicYears.delete.confirm'))

    await waitFor(() => {
      expect(deleteMock).toHaveBeenCalledWith({
        requesterId: 'admin123',
        academicYearId: 'year123',
      })
    })
    expect(toast.success).toHaveBeenCalledWith('academicYears.deleted')
    expect(navigateMock).toHaveBeenCalledWith({ to: '/academic-years' })
  })

  test('delete of active year shows deleteActiveError toast', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'admin123', role: 'admin' },
    } as any)
    deleteMock.mockRejectedValueOnce(
      new Error('ACADEMIC_YEAR_CANNOT_DELETE_ACTIVE'),
    )
    mockQueries({ year: sampleYear, semesters: sampleSemesters })

    renderPage()
    fireEvent.click(screen.getByText('common.delete'))
    const dialog = await screen.findByRole('alertdialog')
    fireEvent.click(within(dialog).getByText('academicYears.delete.confirm'))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'academicYears.deleteActiveError',
      )
    })
  })

  test('delete failure with unrelated error shows generic deleteError toast', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'admin123', role: 'admin' },
    } as any)
    deleteMock.mockRejectedValueOnce(new Error('some other failure'))
    mockQueries({ year: sampleYear, semesters: sampleSemesters })

    renderPage()
    fireEvent.click(screen.getByText('common.delete'))
    const dialog = await screen.findByRole('alertdialog')
    fireEvent.click(within(dialog).getByText('academicYears.delete.confirm'))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('academicYears.deleteError')
    })
  })
})
