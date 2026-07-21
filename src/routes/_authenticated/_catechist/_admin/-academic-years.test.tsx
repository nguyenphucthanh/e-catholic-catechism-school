import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { Route } from './academic-years'
import { useAuth } from '~/lib/auth'

const mockNavigate = vi.fn()
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as Record<string, unknown>),
    useNavigate: () => mockNavigate,
    Link: ({ children, to, params, className }: any) => (
      <a href={to} data-params={JSON.stringify(params)} className={className}>
        {children}
      </a>
    ),
  }
})

beforeEach(() => {
  vi.mocked(toast.success).mockClear()
  vi.mocked(toast.error).mockClear()
  mockNavigate.mockClear()
})

const mockBoardUser = {
  _id: 'user123',
  userDocId: 'catechist123',
  memberId: 'GLV0001',
  fullName: 'Nguyễn Văn A',
  role: 'admin',
} as any

const mockNonBoardUser = { ...mockBoardUser, role: 'user' }

const sampleYear = {
  _id: 'year123',
  name: '2024-2025',
  startDate: '2024-09-01',
  endDate: '2025-05-31',
  timezone: 'Asia/Ho_Chi_Minh',
  isActive: true,
  isDeleted: false,
}

const inactiveYear = {
  ...sampleYear,
  _id: 'year456',
  name: '2023-2024',
  isActive: false,
}

function setupYearsQuery(years: any = [sampleYear]) {
  vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
    const path = queryRef?.[Symbol.for('functionName')]
    if (path === 'academicYears:list') return years
    return undefined
  })
}

function r() {
  return render(<AcademicYearsPageComponent />)
}

const AcademicYearsPageComponent = (Route as any).options.component

describe('AcademicYearsPage component', () => {
  test('renders years table and board-only create button for board member', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupYearsQuery()

    r()

    expect(screen.getByText('academicYears.title')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /academicYears\.actions\.create/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('2024-2025')).toBeInTheDocument()
  })

  test('hides create button for non-board user', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockNonBoardUser,
    })
    setupYearsQuery()

    r()

    expect(
      screen.queryByRole('link', { name: /academicYears\.actions\.create/i }),
    ).not.toBeInTheDocument()
  })

  test('contains correct link to create page', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupYearsQuery()

    r()

    const link = screen.getByRole('link', {
      name: /academicYears\.actions\.create/i,
    })
    expect(link).toHaveAttribute('href', '/academic-years/create')
  })

  test('renders loading skeleton when years is undefined', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    vi.mocked(useQuery).mockReturnValue(undefined)

    const { container } = r()
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  test('renders inactive year with secondary badge', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupYearsQuery([sampleYear, inactiveYear])

    r()
    expect(
      screen.getByText('academicYears.status.inactive'),
    ).toBeInTheDocument()
    expect(screen.getByText('academicYears.status.active')).toBeInTheDocument()
  })

  async function openRowAction(actionText: string) {
    const moreActionsBtns = screen.getAllByRole('button', {
      name: 'common.moreActions',
    })
    fireEvent.click(moreActionsBtns[0])
    const item = await screen.findByText(actionText)
    fireEvent.click(item)
  }

  test('has correct edit link in row action menu', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupYearsQuery([sampleYear])

    r()
    const moreActionsBtns = screen.getAllByRole('button', {
      name: 'common.moreActions',
    })
    fireEvent.click(moreActionsBtns[0])
    const editLink = await screen.findByRole('link', { name: 'common.edit' })
    expect(editLink).toHaveAttribute('href', '/academic-years/$id/edit')
    expect(editLink.getAttribute('data-params')).toContain(sampleYear._id)
  })

  test('calls deleteMutation and shows success toast when delete is confirmed', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupYearsQuery([sampleYear])

    const mockDelete = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useMutation).mockReturnValue(mockDelete as any)

    r()
    await openRowAction('common.delete')

    await waitFor(() => {
      expect(screen.getByText('academicYears.delete.title')).toBeInTheDocument()
    })

    fireEvent.click(
      screen.getByRole('button', { name: 'academicYears.delete.confirm' }),
    )

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith({
        requesterId: 'catechist123',
        academicYearId: 'year123',
      })
    })
    expect(toast.success).toHaveBeenCalledWith('academicYears.deleted')
  })

  test('shows cannot delete active year error', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupYearsQuery([sampleYear])

    vi.mocked(useMutation).mockReturnValue(
      vi
        .fn()
        .mockRejectedValue(
          new Error('ACADEMIC_YEAR_CANNOT_DELETE_ACTIVE'),
        ) as any,
    )

    r()
    await openRowAction('common.delete')

    await waitFor(() => {
      expect(screen.getByText('academicYears.delete.title')).toBeInTheDocument()
    })

    fireEvent.click(
      screen.getByRole('button', { name: 'academicYears.delete.confirm' }),
    )

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'academicYears.deleteActiveError',
      )
    })
  })

  test('shows generic delete error for unknown errors', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupYearsQuery([sampleYear])

    vi.mocked(useMutation).mockReturnValue(
      vi.fn().mockRejectedValue(new Error('UNKNOWN')) as any,
    )

    r()
    await openRowAction('common.delete')

    await waitFor(() => {
      expect(screen.getByText('academicYears.delete.title')).toBeInTheDocument()
    })

    fireEvent.click(
      screen.getByRole('button', { name: 'academicYears.delete.confirm' }),
    )

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('academicYears.deleteError')
    })
  })

  test('cancel button closes delete dialog', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupYearsQuery([sampleYear])

    const mockDelete = vi.fn()
    vi.mocked(useMutation).mockReturnValue(mockDelete as any)

    r()
    await openRowAction('common.delete')

    await waitFor(() => {
      expect(screen.getByText('academicYears.delete.title')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }))

    await waitFor(() => {
      expect(
        screen.queryByText('academicYears.delete.title'),
      ).not.toBeInTheDocument()
    })
    expect(mockDelete).not.toHaveBeenCalled()
  })

  test('set active action calls setActiveMutation and shows success toast', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupYearsQuery([inactiveYear])

    const mockSetActive = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useMutation).mockReturnValue(mockSetActive as any)

    r()
    await openRowAction('academicYears.actions.setActive')

    await waitFor(() => {
      expect(mockSetActive).toHaveBeenCalledWith({
        requesterId: 'catechist123',
        academicYearId: inactiveYear._id,
      })
    })
    expect(toast.success).toHaveBeenCalledWith('academicYears.setActiveSuccess')
  })

  test('set active action shows error toast on failure', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupYearsQuery([inactiveYear])

    vi.mocked(useMutation).mockReturnValue(
      vi.fn().mockRejectedValue(new Error('fail')) as any,
    )

    r()
    await openRowAction('academicYears.actions.setActive')

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('academicYears.saveError')
    })
  })
})
