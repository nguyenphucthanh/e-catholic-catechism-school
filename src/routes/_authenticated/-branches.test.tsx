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

const mockCatechistUser = {
  ...mockBoardUser,
  role: 'user',
}

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
  test('renders branches table for any catechist, hides create button for non-board', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockCatechistUser,
    })
    setupBranchesQuery()

    const BranchesPageComponent = (Route as any).options.component
    render(<BranchesPageComponent />)

    expect(screen.getByText('branches.title')).toBeInTheDocument()
    expect(screen.getByText('Ấu Nhi')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /create|add/i }),
    ).not.toBeInTheDocument()
  })

  test('renders branches table and board-only create button for board member', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupBranchesQuery()

    const BranchesPageComponent = (Route as any).options.component
    render(<BranchesPageComponent />)

    expect(screen.getByText('branches.title')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /branches\.actions\.create/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('Ấu Nhi')).toBeInTheDocument()
  })

  test('navigates to create page when create button is clicked', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupBranchesQuery()

    const BranchesPageComponent = (Route as any).options.component
    render(<BranchesPageComponent />)

    fireEvent.click(
      screen.getByRole('button', { name: /branches\.actions\.create/i }),
    )

    expect(mockNavigate).toHaveBeenCalledWith({ to: '/branches/create' })
  })

  async function openRowAction(actionText: string) {
    const moreActionsBtns = screen.getAllByRole('button', {
      name: 'common.moreActions',
    })
    fireEvent.click(moreActionsBtns[0])
    const item = await screen.findByText(actionText)
    fireEvent.click(item)
  }

  test('navigates to edit page when edit action is clicked', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupBranchesQuery([sampleBranch])

    const BranchesPageComponent = (Route as any).options.component
    render(<BranchesPageComponent />)

    await openRowAction('common.edit')

    expect(mockNavigate).toHaveBeenCalledWith({ 
      to: '/branches/$id/edit', 
      params: { id: sampleBranch._id } 
    })
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

    const BranchesPageComponent = (Route as any).options.component
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
})
