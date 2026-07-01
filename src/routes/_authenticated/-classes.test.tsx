import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { Route } from './classes'
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

const sampleBranch = { _id: 'branch123', name: 'Ấu Nhi' }

const sampleClass = {
  _id: 'class123',
  name: 'Ấu Nhi 1',
  branchId: 'branch123',
  isDeleted: false,
}

function setupQueries(classes?: any, branches?: any) {
  vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
    const path = queryRef?.[Symbol.for('functionName')]
    if (path === 'classes:list') return classes ?? [sampleClass]
    if (path === 'branches:list') return branches ?? [sampleBranch]
    return undefined
  })
}

const ClassesPageComponent = (Route as any).options.component

describe('ClassesPage component', () => {
  test('renders classes for any catechist, hides create for non-admin', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockCatechistUser,
    })
    setupQueries()

    render(<ClassesPageComponent />)

    expect(screen.getByText('classes.title')).toBeInTheDocument()
    expect(screen.getByText('Ấu Nhi 1')).toBeInTheDocument()
    expect(screen.getByText('Ấu Nhi')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'classes.actions.create' }),
    ).not.toBeInTheDocument()
  })

  test('renders classes table and board-only create button for board member', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupQueries()

    render(<ClassesPageComponent />)

    expect(screen.getByText('classes.title')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /classes\.actions\.create/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('Ấu Nhi 1')).toBeInTheDocument()
  })

  test('renders loading skeleton when classes data is undefined', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    vi.mocked(useQuery).mockReturnValue(undefined)

    const { container } = render(<ClassesPageComponent />)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  test('navigates to create page when create button is clicked', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupQueries()

    render(<ClassesPageComponent />)

    fireEvent.click(
      screen.getByRole('button', { name: /classes\.actions\.create/i }),
    )

    expect(mockNavigate).toHaveBeenCalledWith({ to: '/classes/create' })
  })

  test('renders dash when branch name not found', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    const classWithUnknownBranch = { ...sampleClass, branchId: 'nonexistent' }
    setupQueries([classWithUnknownBranch], [sampleBranch])

    render(<ClassesPageComponent />)
    expect(screen.getByText('—')).toBeInTheDocument()
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
    setupQueries()

    render(<ClassesPageComponent />)
    await openRowAction('common.edit')

    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/classes/$id/edit',
      params: { id: sampleClass._id },
    })
  })

  test('calls deleteMutation and shows success toast when delete is confirmed', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupQueries()

    const mockDelete = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useMutation).mockReturnValue(mockDelete as any)

    render(<ClassesPageComponent />)
    await openRowAction('common.delete')

    await waitFor(() => {
      expect(screen.getByText('classes.delete.title')).toBeInTheDocument()
    })

    fireEvent.click(
      screen.getByRole('button', { name: 'classes.delete.confirm' }),
    )

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith({
        requesterId: 'catechist123',
        classId: 'class123',
      })
    })
    expect(toast.success).toHaveBeenCalledWith('classes.deleted')
  })

  test('shows in-use-by-class-year error', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupQueries()

    vi.mocked(useMutation).mockReturnValue(
      vi.fn().mockRejectedValue(new Error('CLASS_IN_USE_BY_CLASS_YEAR')) as any,
    )

    render(<ClassesPageComponent />)
    await openRowAction('common.delete')

    await waitFor(() => {
      expect(screen.getByText('classes.delete.title')).toBeInTheDocument()
    })

    fireEvent.click(
      screen.getByRole('button', { name: 'classes.delete.confirm' }),
    )

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('classes.deleteInUseError')
    })
  })

  test('shows generic delete error for unknown errors', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupQueries()

    vi.mocked(useMutation).mockReturnValue(
      vi.fn().mockRejectedValue(new Error('UNKNOWN')) as any,
    )

    render(<ClassesPageComponent />)
    await openRowAction('common.delete')

    await waitFor(() => {
      expect(screen.getByText('classes.delete.title')).toBeInTheDocument()
    })

    fireEvent.click(
      screen.getByRole('button', { name: 'classes.delete.confirm' }),
    )

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('classes.deleteError')
    })
  })

  test('cancel button closes delete dialog', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupQueries()

    const mockDelete = vi.fn()
    vi.mocked(useMutation).mockReturnValue(mockDelete as any)

    render(<ClassesPageComponent />)
    await openRowAction('common.delete')

    await waitFor(() => {
      expect(screen.getByText('classes.delete.title')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }))

    await waitFor(() => {
      expect(screen.queryByText('classes.delete.title')).not.toBeInTheDocument()
    })
    expect(mockDelete).not.toHaveBeenCalled()
  })
})
