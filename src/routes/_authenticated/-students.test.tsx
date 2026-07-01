import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useMutation, usePaginatedQuery } from 'convex/react'
import { toast } from 'sonner'
import { Route } from './students'
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

const mockAdminUser = {
  _id: 'user123',
  userDocId: 'catechist123',
  memberId: 'GLV0001',
  fullName: 'Admin User',
  role: 'admin',
} as any

const mockNormalUser = { ...mockAdminUser, role: 'user' }

const sampleStudent = {
  _id: 'student123',
  studentCode: 'HV001',
  fullName: 'Nguyen Van A',
  saintName: 'Giuse',
  gender: 'male',
  isActive: true,
  createdAt: 123456789,
}

const sampleStudent2 = {
  _id: 'student124',
  studentCode: 'HV002',
  fullName: 'Tran Thi B',
  gender: 'female',
  isActive: false,
  createdAt: 123456789,
}

const studentNoSaint = {
  _id: 'student125',
  studentCode: 'HV003',
  fullName: 'Le Van C',
  gender: null,
  isActive: true,
  createdAt: 123456789,
}

function setupQueries(
  status: string = 'CanLoadMore',
  results: Array<any> = [sampleStudent, sampleStudent2],
) {
  vi.mocked(usePaginatedQuery).mockReturnValue({
    results,
    status,
    loadMore: vi.fn(),
    isLoading: false,
  } as any)
}

const StudentsPageComponent = (Route as any).options.component

describe('StudentsPage component', () => {
  test('renders students for any user, hides actions for non-admin', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockNormalUser,
    })
    setupQueries()

    render(<StudentsPageComponent />)

    expect(screen.getByText('students.title')).toBeInTheDocument()
    expect(screen.getByText('Nguyen Van A')).toBeInTheDocument()
    expect(screen.getByText('Tran Thi B')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'common.moreActions' }),
    ).not.toBeInTheDocument()
  })

  test('renders empty state correctly (LoadingFirstPage)', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockAdminUser,
    })
    setupQueries('LoadingFirstPage', [])

    render(<StudentsPageComponent />)
    expect(screen.queryByText('Nguyen Van A')).not.toBeInTheDocument()
    expect(
      screen.queryByText('students.searchPlaceholder'),
    ).not.toBeInTheDocument()
  })

  test('renders Load More button and triggers loadMore', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockAdminUser,
    })
    const loadMoreMock = vi.fn()
    vi.mocked(usePaginatedQuery).mockReturnValue({
      results: [sampleStudent],
      status: 'CanLoadMore',
      loadMore: loadMoreMock,
      isLoading: false,
    } as any)

    render(<StudentsPageComponent />)

    const loadMoreBtn = screen.getByRole('button', { name: 'students.loadMore' })
    expect(loadMoreBtn).toBeInTheDocument()
    fireEvent.click(loadMoreBtn)
    expect(loadMoreMock).toHaveBeenCalledWith(50)
  })

  test('renders disabled Load More button during LoadingMore', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockAdminUser,
    })
    vi.mocked(usePaginatedQuery).mockReturnValue({
      results: [sampleStudent],
      status: 'LoadingMore',
      loadMore: vi.fn(),
      isLoading: false,
    } as any)

    render(<StudentsPageComponent />)

    const loadMoreBtn = screen.getByRole('button', { name: 'students.loadMore' })
    expect(loadMoreBtn).toBeDisabled()
  })

  test('hides Load More button when Exhausted', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockAdminUser,
    })
    setupQueries('Exhausted')

    render(<StudentsPageComponent />)
    expect(
      screen.queryByRole('button', { name: 'students.loadMore' }),
    ).not.toBeInTheDocument()
  })

  test('renders dash for missing saintName and missing gender', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockAdminUser,
    })
    vi.mocked(usePaginatedQuery).mockReturnValue({
      results: [studentNoSaint],
      status: 'CanLoadMore',
      loadMore: vi.fn(),
      isLoading: false,
    } as any)

    render(<StudentsPageComponent />)
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('students.status.active')).toBeInTheDocument()
  })

  async function openRowAction(actionText: string, index: number = 0) {
    const moreActionsBtns = screen.getAllByRole('button', {
      name: 'common.moreActions',
    })
    fireEvent.click(moreActionsBtns[index])
    const item = await screen.findByText(actionText)
    fireEvent.click(item)
  }

  test('navigates to edit page when edit action is clicked', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockAdminUser,
    })
    setupQueries()

    render(<StudentsPageComponent />)
    await openRowAction('common.edit')
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/students/$id/edit',
      params: { id: sampleStudent._id },
    })
  })

  test('calls deleteMutation and shows success toast when delete is confirmed', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockAdminUser,
    })
    setupQueries()

    const mockDelete = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useMutation).mockReturnValue(mockDelete as any)

    render(<StudentsPageComponent />)
    await openRowAction('common.delete')

    await waitFor(() => {
      expect(screen.getByText('students.delete.title')).toBeInTheDocument()
    })

    fireEvent.click(
      screen.getByRole('button', { name: 'students.delete.confirm' }),
    )

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith({
        requesterId: 'catechist123',
        studentId: 'student123',
      })
    })
    expect(toast.success).toHaveBeenCalledWith('students.deleted')
  })

  test('shows active enrollment error when delete fails due to enrollment constraint', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockAdminUser,
    })
    setupQueries()

    vi.mocked(useMutation).mockReturnValue(
      vi.fn().mockRejectedValue(new Error('STUDENT_IN_USE_BY_ENROLLMENT')) as any,
    )

    render(<StudentsPageComponent />)
    await openRowAction('common.delete')

    await waitFor(() => {
      expect(screen.getByText('students.delete.title')).toBeInTheDocument()
    })

    fireEvent.click(
      screen.getByRole('button', { name: 'students.delete.confirm' }),
    )

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'students.deleteActiveEnrollmentError',
      )
    })
  })

  test('shows generic delete error for unknown errors', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockAdminUser,
    })
    setupQueries()

    vi.mocked(useMutation).mockReturnValue(
      vi.fn().mockRejectedValue(new Error('UNKNOWN')) as any,
    )

    render(<StudentsPageComponent />)
    await openRowAction('common.delete')

    await waitFor(() => {
      expect(screen.getByText('students.delete.title')).toBeInTheDocument()
    })

    fireEvent.click(
      screen.getByRole('button', { name: 'students.delete.confirm' }),
    )

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('students.deleteError')
    })
  })

  test('cancel button closes delete dialog', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockAdminUser,
    })
    setupQueries()

    const mockDelete = vi.fn()
    vi.mocked(useMutation).mockReturnValue(mockDelete as any)

    render(<StudentsPageComponent />)
    await openRowAction('common.delete')

    await waitFor(() => {
      expect(screen.getByText('students.delete.title')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }))

    await waitFor(() => {
      expect(
        screen.queryByText('students.delete.title'),
      ).not.toBeInTheDocument()
    })
    expect(mockDelete).not.toHaveBeenCalled()
  })

  test('groups data and renders badges when group by is changed', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockAdminUser,
    })
    setupQueries()

    render(<StudentsPageComponent />)

    expect(screen.getByText('students.gender.male')).toBeInTheDocument()
    expect(screen.getByText('students.status.active')).toBeInTheDocument()

    const selectTrigger = screen.getAllByRole('combobox')[0]
    fireEvent.click(selectTrigger)

    const groupByGender = await screen.findByText('students.groupBy.gender')
    fireEvent.click(groupByGender)

    expect(screen.getByText('Nguyen Van A')).toBeInTheDocument()
  })

  test('navigates to view page when view action is clicked', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockAdminUser,
    })
    setupQueries()

    render(<StudentsPageComponent />)
    await openRowAction('common.view')

    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/students/$id',
      params: { id: sampleStudent._id },
    })
  })
})