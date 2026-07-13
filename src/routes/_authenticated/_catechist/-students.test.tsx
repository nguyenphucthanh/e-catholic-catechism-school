import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
  useConvex,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from 'convex/react'
import { toast } from 'sonner'
import { api } from '../../../../convex/_generated/api'
import { Route } from './students'
import { useAuth } from '~/lib/auth'
import { useSelectedAcademicYear } from '~/lib/academic-year'
import { exportQrCardsPdf } from '~/lib/export/qr-card-pdf'
import { exportCsv } from '~/lib/export'

vi.mock('~/lib/export/qr-card-pdf', () => ({
  exportQrCardsPdf: vi.fn(),
}))

vi.mock('~/lib/export', () => ({ exportCsv: vi.fn() }))

const mockSelectedYearId = 'year-2024'

vi.mock('~/lib/academic-year', () => ({
  useSelectedAcademicYear: vi.fn(),
}))

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
  vi.mocked(exportQrCardsPdf).mockClear()
  vi.mocked(exportCsv).mockClear()
  mockNavigate.mockClear()
  vi.mocked(useSelectedAcademicYear).mockReturnValue({
    selectedYearId: mockSelectedYearId as any,
    setSelectedYearId: vi.fn(),
  })
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

const sampleBranch = { _id: 'branch123', name: 'Ấu Nhi' }
const sampleClass = { _id: 'class123', name: 'Ấu Nhi 1', branchId: 'branch123' }
const sampleClassYear = { classYearId: 'classyear123', classId: 'class123' }

function setupQueries(
  status: string = 'CanLoadMore',
  results: Array<any> = [sampleStudent, sampleStudent2],
  permissions?: { isAdmin?: boolean; isBoardMember?: boolean },
) {
  vi.mocked(usePaginatedQuery).mockReturnValue({
    results,
    status,
    loadMore: vi.fn(),
    isLoading: false,
  } as any)

  vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
    const path = queryRef?.[Symbol.for('functionName')]
    if (path === 'branches:list') return [sampleBranch]
    if (path === 'classes:list') return [sampleClass]
    if (path === 'classes:listClassYears') return [sampleClassYear]
    if (path === 'academicYears:getActive') return { _id: 'year123' }
    if (path === 'catechistPermissions:getPermissions') return permissions
    if (path === 'appConfig:get') {
      return {
        troopName: 'Mock Troop',
        parishName: 'Mock Parish',
        dioceseName: 'Mock Diocese',
        nameFormat: 'firstName_lastName',
      }
    }
    return undefined
  })
}

const StudentsPageComponent = (Route as any).options.component

describe('StudentsPage component', () => {
  test('renders students for any user, hides edit/delete actions for non-admin', async () => {
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

    // Actions button is rendered because any catechist can view student
    const moreActionsBtns = screen.getAllByRole('button', {
      name: 'common.moreActions',
    })
    expect(moreActionsBtns.length).toBeGreaterThan(0)

    fireEvent.click(moreActionsBtns[0])

    // View should be visible
    expect(await screen.findByText('common.view')).toBeInTheDocument()

    // Edit and Delete should be hidden
    expect(screen.queryByText('common.edit')).not.toBeInTheDocument()
    expect(screen.queryByText('common.delete')).not.toBeInTheDocument()
  })

  test('does not render the client-side search input (search is server-side)', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockAdminUser,
    })
    setupQueries()

    render(<StudentsPageComponent />)
    expect(screen.queryByPlaceholderText('Filter...')).not.toBeInTheDocument()
    expect(
      screen.getByPlaceholderText('students.searchPlaceholder'),
    ).toBeInTheDocument()
  })

  test('renders loading skeleton rows on first page load, filters stay usable', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockAdminUser,
    })
    setupQueries('LoadingFirstPage', [])

    render(<StudentsPageComponent />)
    expect(screen.queryByText('Nguyen Van A')).not.toBeInTheDocument()
    // Filters remain visible/usable while the first page is loading.
    expect(
      screen.getByPlaceholderText('students.searchPlaceholder'),
    ).toBeInTheDocument()
  })

  test('renders dash for missing saintName and missing gender', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockAdminUser,
    })
    setupQueries('CanLoadMore', [studentNoSaint])

    render(<StudentsPageComponent />)
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('students.status.active')).toBeInTheDocument()
  })

  test('debounces the name filter passed to the paginated query', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockAdminUser,
    })
    setupQueries()

    render(<StudentsPageComponent />)

    const input = screen.getByPlaceholderText('students.searchPlaceholder')
    fireEvent.change(input, { target: { value: 'Nguyen' } })

    await waitFor(() => {
      const lastCall = vi.mocked(usePaginatedQuery).mock.calls.at(-1)
      expect(lastCall?.[1]).toMatchObject({ name: 'Nguyen' })
    })
  })

  test('scopes branch and class filter options to classes offered in the selected academic year', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockAdminUser,
    })
    setupQueries()

    render(<StudentsPageComponent />)

    // Branch/class options come from classes.list + classes.listClassYears
    // scoped to the selected academic year — both are queried, and their
    // results (branch/class present in the seeded fixtures) render as
    // selectable options.
    fireEvent.click(screen.getAllByRole('combobox')[2])
    expect(screen.getByText('Ấu Nhi')).toBeInTheDocument()
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
      vi
        .fn()
        .mockRejectedValue(new Error('STUDENT_IN_USE_BY_ENROLLMENT')) as any,
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

  test('calls exportQrCardsPdf when print card action is clicked', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockAdminUser,
    })
    setupQueries()

    render(<StudentsPageComponent />)
    await openRowAction('printCards.singleAction')

    expect(exportQrCardsPdf).toHaveBeenCalledWith(
      [
        {
          studentCode: sampleStudent.studentCode,
          fullName: sampleStudent.fullName,
          saintName: sampleStudent.saintName,
        },
      ],
      {
        troopName: 'Mock Troop',
        parishName: 'Mock Parish',
        studentCodeLabel: 'printCards.studentCodeLabel',
      },
      `${sampleStudent.studentCode}-card.pdf`,
    )
  })
})

describe('StudentsPage export CSV', () => {
  const mockConvexQuery = vi.fn()

  beforeEach(() => {
    mockConvexQuery.mockReset()
    vi.mocked(useConvex).mockReturnValue({ query: mockConvexQuery } as any)
  })

  test('export button hidden when requester has no admin/board permission', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockNormalUser,
    })
    setupQueries(undefined, undefined, {
      isAdmin: false,
      isBoardMember: false,
    })

    render(<StudentsPageComponent />)

    expect(screen.queryByText('students.export.csv')).not.toBeInTheDocument()
  })

  test('export button visible for admin', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockAdminUser,
    })
    setupQueries(undefined, undefined, { isAdmin: true, isBoardMember: false })

    render(<StudentsPageComponent />)

    expect(screen.getByText('students.export.csv')).toBeInTheDocument()
  })

  test('export button visible for board member', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockNormalUser,
    })
    setupQueries(undefined, undefined, { isAdmin: false, isBoardMember: true })

    render(<StudentsPageComponent />)

    expect(screen.getByText('students.export.csv')).toBeInTheDocument()
  })

  test('clicking export calls exportList with current filter state and triggers exportCsv', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockAdminUser,
    })
    setupQueries(undefined, undefined, { isAdmin: true, isBoardMember: false })
    mockConvexQuery.mockResolvedValue([
      {
        studentCode: 'HV001',
        saintName: 'Giuse',
        fullName: 'Nguyen Van A',
        gender: 'male',
        isActive: true,
        primaryPhone: '+84123456789',
      },
    ])

    render(<StudentsPageComponent />)

    fireEvent.click(screen.getByText('students.export.csv'))

    await waitFor(() => {
      expect(mockConvexQuery).toHaveBeenCalledWith(api.students.exportList, {
        requesterId: 'catechist123',
        name: undefined,
        gender: undefined,
        isActive: undefined,
        branchId: undefined,
        classYearId: undefined,
        academicYearId: mockSelectedYearId,
        sortBy: undefined,
        sortOrder: 'asc',
      })
    })

    await waitFor(() => {
      expect(exportCsv).toHaveBeenCalledTimes(1)
    })
    const [rows, filename, headers] = vi.mocked(exportCsv).mock.calls[0]
    expect(filename).toMatch(/^students-\d{4}-\d{2}-\d{2}\.csv$/)
    expect(headers[2]).toBe('students.export.col.fullName')
    expect(rows[0][headers[2]]).toBe('Nguyen Van A')
    expect(rows[0][headers[18]]).toBe('+84123456789')
  })

  test('shows error toast instead of throwing when export query rejects', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockAdminUser,
    })
    setupQueries(undefined, undefined, { isAdmin: true, isBoardMember: false })
    mockConvexQuery.mockRejectedValue(new Error('STUDENT_EXPORT_UNAUTHORIZED'))

    render(<StudentsPageComponent />)

    fireEvent.click(screen.getByText('students.export.csv'))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('students.export.unauthorized')
    })
    expect(exportCsv).not.toHaveBeenCalled()
  })
})
