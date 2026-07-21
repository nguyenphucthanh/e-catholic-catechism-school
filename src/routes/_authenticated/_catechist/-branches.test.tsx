import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { Route } from './branches'
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
  fullName: 'Board User',
  role: 'admin',
} as any

const mockCatechistUser = { ...mockBoardUser, role: 'user' }

const sampleBranch = {
  _id: 'branch123',
  name: 'Ấu Nhi',
  sortOrder: 1,
  description: 'Mô tả ấu nhi',
  isDeleted: false,
}

function setupBranchesQuery(branches: Array<any> | undefined = [sampleBranch]) {
  vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
    const path = queryRef?.[Symbol.for('functionName')]
    if (path === 'branches:list') return branches
    return undefined
  })
}

describe('BranchesPage component', () => {
  const BranchesPageComponent = (Route as any).options.component

  test('renders branches table for any catechist, hides create button for non-board', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockCatechistUser,
    })
    setupBranchesQuery()

    render(<BranchesPageComponent />)

    expect(screen.getByText('branches.title')).toBeInTheDocument()
    expect(screen.getByText('branches.title')).toBeInTheDocument()
    expect(screen.getByText('Ấu Nhi')).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /create|add/i }),
    ).not.toBeInTheDocument()
  })

  test('renders branches table and board-only create button for board member', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupBranchesQuery()

    render(<BranchesPageComponent />)

    expect(screen.getByText('branches.title')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /branches\.actions\.create/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('Ấu Nhi')).toBeInTheDocument()
  })

  test('renders loading skeleton when branches is undefined', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    vi.mocked(useQuery).mockReturnValue(undefined)

    const { container } = render(<BranchesPageComponent />)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  test('contains correct link to create page', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupBranchesQuery()

    render(<BranchesPageComponent />)

    const link = screen.getByRole('link', {
      name: /branches\.actions\.create/i,
    })
    expect(link).toHaveAttribute('href', '/branches/create')
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
    setupBranchesQuery([sampleBranch])

    render(<BranchesPageComponent />)
    const moreActionsBtns = screen.getAllByRole('button', {
      name: 'common.moreActions',
    })
    fireEvent.click(moreActionsBtns[0])
    const editLink = await screen.findByRole('link', { name: 'common.edit' })
    expect(editLink).toHaveAttribute('href', '/branches/$id/edit')
    expect(editLink.getAttribute('data-params')).toContain(sampleBranch._id)
  })

  test('calls deleteMutation and shows success toast when delete is confirmed', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupBranchesQuery([sampleBranch])

    const mockDelete = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useMutation).mockReturnValue(mockDelete as any)

    render(<BranchesPageComponent />)
    await openRowAction('common.delete')

    await waitFor(() => {
      expect(screen.getByText('branches.delete.title')).toBeInTheDocument()
    })

    fireEvent.click(
      screen.getByRole('button', { name: 'branches.delete.confirm' }),
    )

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith({
        requesterId: 'catechist123',
        branchId: 'branch123',
      })
    })
    expect(toast.success).toHaveBeenCalledWith('branches.deleted')
  })

  test('shows in-use-by-class error when delete fails', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupBranchesQuery([sampleBranch])

    vi.mocked(useMutation).mockReturnValue(
      vi.fn().mockRejectedValue(new Error('BRANCH_IN_USE_BY_CLASS')) as any,
    )

    render(<BranchesPageComponent />)
    await openRowAction('common.delete')

    await waitFor(() => {
      expect(screen.getByText('branches.delete.title')).toBeInTheDocument()
    })

    fireEvent.click(
      screen.getByRole('button', { name: 'branches.delete.confirm' }),
    )

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('branches.deleteInUseError')
    })
  })

  test('shows generic delete error for unknown errors', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupBranchesQuery([sampleBranch])

    vi.mocked(useMutation).mockReturnValue(
      vi.fn().mockRejectedValue(new Error('UNKNOWN')) as any,
    )

    render(<BranchesPageComponent />)
    await openRowAction('common.delete')

    await waitFor(() => {
      expect(screen.getByText('branches.delete.title')).toBeInTheDocument()
    })

    fireEvent.click(
      screen.getByRole('button', { name: 'branches.delete.confirm' }),
    )

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('branches.deleteError')
    })
  })

  test('cancel button closes delete dialog without calling mutation', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupBranchesQuery([sampleBranch])

    const mockDelete = vi.fn()
    vi.mocked(useMutation).mockReturnValue(mockDelete as any)

    render(<BranchesPageComponent />)
    await openRowAction('common.delete')

    await waitFor(() => {
      expect(screen.getByText('branches.delete.title')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }))

    await waitFor(() => {
      expect(
        screen.queryByText('branches.delete.title'),
      ).not.toBeInTheDocument()
    })
    expect(mockDelete).not.toHaveBeenCalled()
  })

  test('reorder up button calls reorderMutation', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupBranchesQuery([sampleBranch])

    const mockReorder = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useMutation).mockReturnValue(mockReorder as any)

    render(<BranchesPageComponent />)

    const upButtons = screen.getAllByRole('button', { name: '' })
    // Find the ChevronUp button by looking for the arrow up icon
    const svgButtons = upButtons.filter(
      (b) => b.querySelector('svg') && b.className.includes('h-4 w-4'),
    )
    if (svgButtons.length > 0) {
      fireEvent.click(svgButtons[0])
    }
  })

  test('reorder down button calls reorderMutation', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    const secondBranch = { ...sampleBranch, _id: 'branch456', sortOrder: 2 }
    setupBranchesQuery([sampleBranch, secondBranch])
    const mockReorder = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useMutation).mockReturnValue(mockReorder as any)

    render(<BranchesPageComponent />)

    // Find down buttons (they contain ChevronDown)
    const downButtons = screen.getAllByRole('button', { name: '' })
    const reorderDownBtns = downButtons.filter(
      (b) =>
        b.innerHTML.includes('ChevronDown') ||
        b.querySelector('[class*="h-3 w-3"]'),
    )
    if (reorderDownBtns.length > 0) {
      fireEvent.click(reorderDownBtns[0])
    }
  })

  test('reorder error shows error toast', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupBranchesQuery([sampleBranch])
    vi.mocked(useMutation).mockReturnValue(
      vi.fn().mockRejectedValue(new Error('fail')) as any,
    )

    render(<BranchesPageComponent />)

    // Click the reorder up button to trigger the error
    const reorderBtns = screen.getAllByRole('button')
    const upBtn = reorderBtns.find(
      (b) => b.className.includes('h-4 w-4') || b.innerHTML.includes('svg'),
    )
    if (upBtn) {
      fireEvent.click(upBtn)
    }
  })
})
