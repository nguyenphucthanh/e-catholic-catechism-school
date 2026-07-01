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
  role: 'board',
} as any

const sampleBranch = {
  _id: 'branch123',
  name: 'Ấu Nhi',
}

const sampleClass = {
  _id: 'class123',
  name: 'Ấu Nhi 1',
  branchId: 'branch123',
  isDeleted: false,
}

function setupQueries() {
  vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
    const path = queryRef?.[Symbol.for('functionName')]
    if (path === 'classes:list') return [sampleClass]
    if (path === 'branches:list') return [sampleBranch]
    return undefined
  })
}

describe('ClassesPage component', () => {
  test('renders classes table and board-only create button for board member', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupQueries()

    const ClassesPageComponent = (Route as any).options.component
    render(<ClassesPageComponent />)

    expect(screen.getByText('classes.title')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /classes\.actions\.create/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('Ấu Nhi 1')).toBeInTheDocument()
  })

  test('navigates to create page when create button is clicked', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupQueries()

    const ClassesPageComponent = (Route as any).options.component
    render(<ClassesPageComponent />)

    fireEvent.click(
      screen.getByRole('button', { name: /classes\.actions\.create/i }),
    )

    expect(mockNavigate).toHaveBeenCalledWith({ to: '/classes/create' })
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

    const ClassesPageComponent = (Route as any).options.component
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

    const ClassesPageComponent = (Route as any).options.component
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
})
