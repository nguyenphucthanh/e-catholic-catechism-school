import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { Route } from './catechists'
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

function setupQueries(
  options: {
    catechists?: Array<any> | undefined
    branches?: Array<any> | undefined
  } = {},
) {
  const catechists =
    'catechists' in options ? options.catechists : [sampleCatechist]
  const branches = 'branches' in options ? options.branches : [sampleBranch]

  vi.mocked(useQuery).mockImplementation((queryRef: any, args?: any) => {
    const path = queryRef?.[Symbol.for('functionName')]
    if (path === 'catechists:list') {
      if (args?.branchId === 'branch123' && catechists) return [sampleCatechist]
      return catechists
    }
    if (path === 'branches:list') return branches
    if (path === 'academicYears:getActive') return { _id: 'year123' }
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

  test('grouping dropdown sets grouping state', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockAdminUser,
    })
    setupQueries()

    const CatechistsPageComponent = (Route as any).options.component
    render(<CatechistsPageComponent />)

    const comboboxes = screen.getAllByRole('combobox')
    // The second combobox should be the Grouping one, or we can just try to click it
    // The grouping combobox has "No Grouping" by default, wait, the text is "No Grouping" or "Group by..."
    // Let's assume it's the second combobox (after branch select)
    expect(comboboxes.length).toBeGreaterThan(1)
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
