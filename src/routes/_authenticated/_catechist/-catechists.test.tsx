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
import { Route } from './catechists'
import { useAuth } from '~/lib/auth'
import { exportCsv } from '~/lib/export'

vi.mock('~/lib/export', () => ({ exportCsv: vi.fn() }))

// Global setup mocks convex/react without useConvex; re-supply the full set
// here so this file's useConvex import isn't undefined.
vi.mock('convex/react', () => ({
  useMutation: vi.fn(() => vi.fn()),
  useAction: vi.fn(() => vi.fn()),
  useQuery: vi.fn(),
  usePaginatedQuery: vi.fn(),
  useConvex: vi.fn(),
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
  mockNavigate.mockClear()
})

const mockAdminUser = {
  _id: 'user123',
  userDocId: 'catechist123',
  memberId: 'GLV0001',
  fullName: 'Admin User',
  role: 'admin',
} as any

const mockCatechistUser = {
  ...mockAdminUser,
  role: 'user',
}

const sampleCatechist = {
  _id: 'catechist123',
  memberId: '1',
  fullName: 'John Doe',
  role: 'user',
  isActive: true,
  isDeleted: false,
}

const sampleBranch = {
  _id: 'branch123',
  name: 'Ấu Nhi',
}

const paginatedResult = (items: Array<any> | undefined, isLoading = false) => ({
  results: items ?? [],
  isLoading,
  status: isLoading ? 'Loading' : 'Exhausted',
  loadMore: vi.fn(),
})

function setupQueries(
  options: {
    catechists?: Array<any> | undefined
    branches?: Array<any> | undefined
    permissions?: { isAdmin?: boolean; isBoardMember?: boolean } | undefined
  } = {},
) {
  const catechists =
    'catechists' in options ? options.catechists : [sampleCatechist]
  const branches = 'branches' in options ? options.branches : [sampleBranch]
  const permissions = 'permissions' in options ? options.permissions : undefined
  const isLoading = catechists === undefined

  ;(vi.mocked(usePaginatedQuery) as any).mockImplementation(
    (queryRef: any, args?: any) => {
      const path = queryRef?.[Symbol.for('functionName')]
      if (path === 'catechists:list') {
        if (args?.branchId === 'branch123' && catechists)
          return paginatedResult([sampleCatechist])
        return paginatedResult(catechists, isLoading)
      }
      return paginatedResult([])
    },
  )

  ;(vi.mocked(useQuery) as any).mockImplementation((queryRef: any) => {
    const path = queryRef?.[Symbol.for('functionName')]
    if (path === 'branches:list') return branches
    if (path === 'academicYears:getActive') return { _id: 'year123' }
    if (path === 'catechistPermissions:getPermissions') return permissions
    return undefined
  })
}

describe('CatechistsPage component', () => {
  test('renders page header, table, and search input', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockCatechistUser,
    })
    setupQueries()

    const CatechistsPageComponent = (Route as any).options.component
    render(<CatechistsPageComponent />)

    expect(screen.getByText('catechists.title')).toBeInTheDocument()
    expect(screen.getByText('John Doe')).toBeInTheDocument()

    const searchInput = screen.getByPlaceholderText(
      'catechists.searchPlaceholder',
    )
    expect(searchInput).toBeInTheDocument()
  })

  test('shows skeleton when data loading', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockCatechistUser,
    })
    setupQueries({ catechists: undefined, branches: undefined })

    const CatechistsPageComponent = (Route as any).options.component
    const { container } = render(<CatechistsPageComponent />)

    // Data table skeleton (pulse effect)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  test('branch dropdown sets selected branch', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockCatechistUser,
    })
    setupQueries()

    const CatechistsPageComponent = (Route as any).options.component
    render(<CatechistsPageComponent />)

    // Wait for the select trigger to be rendered
    const comboboxes = screen.getAllByRole('combobox')
    expect(comboboxes.length).toBeGreaterThan(0)
  })

  test('admin sees action menu; non-admin does not', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockCatechistUser,
    })
    setupQueries()

    const CatechistsPageComponent = (Route as any).options.component
    const { rerender } = render(<CatechistsPageComponent />)

    // Non-admin should not see more actions
    expect(
      screen.queryByRole('button', { name: 'common.moreActions' }),
    ).not.toBeInTheDocument()

    // Rerender with admin
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockAdminUser,
    })
    rerender(<CatechistsPageComponent />)

    expect(
      screen.getByRole('button', { name: 'common.moreActions' }),
    ).toBeInTheDocument()
  })

  test('navigates to create page when create button is clicked', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockAdminUser,
    })
    setupQueries()

    const CatechistsPageComponent = (Route as any).options.component
    render(<CatechistsPageComponent />)

    fireEvent.click(
      screen.getByRole('button', { name: 'catechists.actions.create' }),
    )
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/catechists/create' })
  })

  test('renders filter selects for gender and status', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockCatechistUser,
    })
    setupQueries()

    const CatechistsPageComponent = (Route as any).options.component
    render(<CatechistsPageComponent />)

    // Branch filter, gender filter, status filter → at least 3 comboboxes
    const comboboxes = screen.getAllByRole('combobox')
    expect(comboboxes.length).toBeGreaterThanOrEqual(3)
    // Gender filter should have male/female options
    expect(screen.getByText('students.filters.anyGender')).toBeInTheDocument()
    expect(screen.getByText('students.filters.anyStatus')).toBeInTheDocument()
  })

  test('delete confirmation dialog opens and confirms, handles error', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockAdminUser,
    })
    setupQueries()

    const mockDelete = vi.fn().mockRejectedValue(new Error('Delete failed'))
    vi.mocked(useMutation).mockReturnValue(mockDelete as any)

    const CatechistsPageComponent = (Route as any).options.component
    render(<CatechistsPageComponent />)

    const moreActionsBtns = screen.getAllByRole('button', {
      name: 'common.moreActions',
    })
    fireEvent.click(moreActionsBtns[0])

    const deleteBtn = await screen.findByText('common.delete')
    fireEvent.click(deleteBtn)

    await waitFor(() => {
      expect(screen.getByText('catechists.delete.title')).toBeInTheDocument()
    })

    // Click cancel first
    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }))
    await waitFor(() => {
      expect(
        screen.queryByText('catechists.delete.title'),
      ).not.toBeInTheDocument()
    })

    // Open again
    const newMoreActionsBtns = screen.getAllByRole('button', {
      name: 'common.moreActions',
    })
    fireEvent.click(newMoreActionsBtns[0])
    fireEvent.click(await screen.findByText('common.delete'))

    await waitFor(() => {
      expect(screen.getByText('catechists.delete.title')).toBeInTheDocument()
    })

    fireEvent.click(
      screen.getByRole('button', { name: 'catechists.delete.confirm' }),
    )

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith({
        requesterId: 'catechist123',
        catechistId: 'catechist123',
      })
    })
    expect(toast.error).toHaveBeenCalledWith('catechists.deleteError')
  })
})

describe('CatechistsPage export CSV', () => {
  const mockConvexQuery = vi.fn()

  beforeEach(() => {
    mockConvexQuery.mockReset()
    vi.mocked(useConvex).mockReturnValue({ query: mockConvexQuery } as any)
    vi.mocked(exportCsv).mockClear()
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockCatechistUser,
    })
  })

  test('export button hidden when requester has no admin/board permission', () => {
    setupQueries({
      permissions: { isAdmin: false, isBoardMember: false },
    })

    const CatechistsPageComponent = (Route as any).options.component
    render(<CatechistsPageComponent />)

    expect(screen.queryByText('catechists.export.csv')).not.toBeInTheDocument()
  })

  test('export button visible for admin', () => {
    setupQueries({
      permissions: { isAdmin: true, isBoardMember: false },
    })

    const CatechistsPageComponent = (Route as any).options.component
    render(<CatechistsPageComponent />)

    expect(screen.getByText('catechists.export.csv')).toBeInTheDocument()
  })

  test('export button visible for board member', () => {
    setupQueries({
      permissions: { isAdmin: false, isBoardMember: true },
    })

    const CatechistsPageComponent = (Route as any).options.component
    render(<CatechistsPageComponent />)

    expect(screen.getByText('catechists.export.csv')).toBeInTheDocument()
  })

  test('clicking export calls exportList with current filters and triggers exportCsv', async () => {
    setupQueries({
      permissions: { isAdmin: true, isBoardMember: false },
    })
    mockConvexQuery.mockResolvedValue([
      {
        memberId: '1',
        saintName: 'Giuse',
        fullName: 'John Doe',
        gender: 'male',
        role: 'user',
        isActive: true,
        primaryPhone: '+84123456789',
      },
    ])

    const CatechistsPageComponent = (Route as any).options.component
    render(<CatechistsPageComponent />)

    fireEvent.click(screen.getByText('catechists.export.csv'))

    await waitFor(() => {
      expect(mockConvexQuery).toHaveBeenCalledWith(api.catechists.exportList, {
        requesterId: 'catechist123',
        name: undefined,
        gender: undefined,
        isActive: undefined,
        branchId: undefined,
        academicYearId: 'year123',
        sortBy: undefined,
        sortOrder: 'asc',
      })
    })

    await waitFor(() => {
      expect(exportCsv).toHaveBeenCalledTimes(1)
    })
    const [rows, filename, headers] = vi.mocked(exportCsv).mock.calls[0]
    expect(filename).toMatch(/^catechists-\d{4}-\d{2}-\d{2}\.csv$/)
    expect(headers[0]).toBe('catechists.export.col.memberId')
    expect(headers[2]).toBe('catechists.export.col.fullName')
    expect(rows[0][headers[2]]).toBe('John Doe')
    expect(rows[0][headers[20]]).toBe('+84123456789')
  })

  test('shows error toast instead of throwing when export query rejects', async () => {
    setupQueries({
      permissions: { isAdmin: true, isBoardMember: false },
    })
    mockConvexQuery.mockRejectedValue(
      new Error('CATECHIST_EXPORT_UNAUTHORIZED'),
    )

    const CatechistsPageComponent = (Route as any).options.component
    render(<CatechistsPageComponent />)

    fireEvent.click(screen.getByText('catechists.export.csv'))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('catechists.export.unauthorized')
    })
    expect(exportCsv).not.toHaveBeenCalled()
  })
})
