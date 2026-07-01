import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { BRANCH_ERRORS } from '../../../convex/lib/errors'
import { Route } from './branches'
import { useAuth } from '~/lib/auth'

beforeEach(() => {
  vi.mocked(toast.success).mockClear()
  vi.mocked(toast.error).mockClear()
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

const sampleBranch2 = {
  _id: 'branch456',
  name: 'Thiếu Nhi',
  sortOrder: 2,
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
  test('renders unauthorized message for non-board user', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockCatechistUser,
    })
    setupBranchesQuery()

    const BranchesPageComponent = (Route as any).options.component
    render(<BranchesPageComponent />)

    expect(screen.getByText(/common\.contactAdmin/i)).toBeInTheDocument()
    expect(screen.queryByText('branches.title')).not.toBeInTheDocument()
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
      screen.getByRole('button', { name: /create|add/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('Ấu Nhi')).toBeInTheDocument()
  })

  test('renders loading skeleton when query returns undefined', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    vi.mocked(useQuery).mockReturnValue(undefined)

    const BranchesPageComponent = (Route as any).options.component
    const { container } = render(<BranchesPageComponent />)

    const pulseElements = container.querySelectorAll('.animate-pulse')
    expect(pulseElements.length).toBeGreaterThan(0)
  })

  test('opens create dialog when create button is clicked', async () => {
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

    await waitFor(() => {
      expect(screen.getByText('branches.dialog.create')).toBeInTheDocument()
    })
  })

  test('renders search input in the table toolbar', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupBranchesQuery()

    const BranchesPageComponent = (Route as any).options.component
    render(<BranchesPageComponent />)

    const searchInput = screen.getByPlaceholderText(
      'branches.searchPlaceholder',
    )
    expect(searchInput).toBeInTheDocument()
  })

  async function openRowAction(actionText: string) {
    const moreActionsBtns = screen.getAllByRole('button', {
      name: 'common.moreActions',
    })
    fireEvent.click(moreActionsBtns[0])
    const item = await screen.findByText(actionText)
    fireEvent.click(item)
  }

  test('opens edit dialog with prefilled name when edit action is clicked', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupBranchesQuery([sampleBranch])

    const BranchesPageComponent = (Route as any).options.component
    render(<BranchesPageComponent />)

    await openRowAction('common.edit')

    await waitFor(() => {
      expect(screen.getByText('branches.dialog.edit')).toBeInTheDocument()
    })
    expect(screen.getByLabelText(/branches\.fields\.name/)).toHaveValue(
      'Ấu Nhi',
    )
  })

  test('calls createMutation when create form is submitted with valid data', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: { ...mockBoardUser, userDocId: 'catechist123' },
    })
    setupBranchesQuery()

    const mockCreate = vi.fn().mockResolvedValue('newBranchId')
    vi.mocked(useMutation).mockReturnValue(mockCreate as any)

    const BranchesPageComponent = (Route as any).options.component
    render(<BranchesPageComponent />)

    fireEvent.click(
      screen.getByRole('button', { name: /branches\.actions\.create/i }),
    )

    await waitFor(() => {
      expect(
        screen.getByLabelText(/branches\.fields\.name/),
      ).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText(/branches\.fields\.name/), {
      target: { value: 'Thiếu Nhi' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'common.save' }))

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          requesterId: 'catechist123',
          name: 'Thiếu Nhi',
        }),
      )
    })
    expect(toast.success).toHaveBeenCalledWith('common.saved')
  })

  test('calls updateMutation when edit form is submitted', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupBranchesQuery([sampleBranch])

    const mockUpdate = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useMutation).mockReturnValue(mockUpdate as any)

    const BranchesPageComponent = (Route as any).options.component
    render(<BranchesPageComponent />)

    await openRowAction('common.edit')

    await waitFor(() => {
      expect(
        screen.getByLabelText(/branches\.fields\.name/),
      ).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText(/branches\.fields\.name/), {
      target: { value: 'Ấu Nhi Updated' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'common.save' }))

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          requesterId: 'catechist123',
          branchId: 'branch123',
          name: 'Ấu Nhi Updated',
        }),
      )
    })
    expect(toast.success).toHaveBeenCalledWith('common.saved')
  })

  test('shows duplicate name error toast when mutation throws DUPLICATE_NAME', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupBranchesQuery([sampleBranch])

    const mockUpdate = vi
      .fn()
      .mockRejectedValue(new Error(`Boom: ${BRANCH_ERRORS.DUPLICATE_NAME}`))
    vi.mocked(useMutation).mockReturnValue(mockUpdate as any)

    const BranchesPageComponent = (Route as any).options.component
    render(<BranchesPageComponent />)

    await openRowAction('common.edit')

    await waitFor(() => {
      expect(
        screen.getByLabelText(/branches\.fields\.name/),
      ).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'common.save' }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('branches.fields.name.duplicate')
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

  test('shows deleteInUseError toast when deleting fails with IN_USE_BY_CLASS', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupBranchesQuery([sampleBranch])

    const mockDelete = vi
      .fn()
      .mockRejectedValue(new Error(`Boom: ${BRANCH_ERRORS.IN_USE_BY_CLASS}`))
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
      expect(toast.error).toHaveBeenCalledWith('branches.deleteInUseError')
    })
  })

  test('shows generic deleteError toast when delete fails with unknown error', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupBranchesQuery([sampleBranch])

    const mockDelete = vi.fn().mockRejectedValue(new Error('Network Error'))
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
      expect(toast.error).toHaveBeenCalledWith('branches.deleteError')
    })
  })

  test('shows generic saveError toast when create fails with unknown error', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupBranchesQuery()

    const mockCreate = vi.fn().mockRejectedValue(new Error('Network Error'))
    vi.mocked(useMutation).mockReturnValue(mockCreate as any)

    const BranchesPageComponent = (Route as any).options.component
    render(<BranchesPageComponent />)

    fireEvent.click(
      screen.getByRole('button', { name: /branches\.actions\.create/i }),
    )

    await waitFor(() => {
      expect(
        screen.getByLabelText(/branches\.fields\.name/),
      ).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText(/branches\.fields\.name/), {
      target: { value: 'Chiên Con' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'common.save' }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('branches.saveError')
    })
  })

  test('shows generic reorderError toast when reorder fails', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupBranchesQuery([sampleBranch, sampleBranch2])

    const mockReorder = vi.fn().mockRejectedValue(new Error('Network error'))
    vi.mocked(useMutation).mockReturnValue(mockReorder as any)

    const BranchesPageComponent = (Route as any).options.component
    const { container } = render(<BranchesPageComponent />)

    const buttons = container.querySelectorAll('button')
    const enabledUpButtons = Array.from(buttons).filter(
      (b) => !b.disabled && b.querySelector('.lucide-chevron-up'),
    )

    if (enabledUpButtons.length > 0) {
      fireEvent.click(enabledUpButtons[0])
    }

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('branches.reorderError')
    })
  })

  test('calls reorderMutation when up/down arrows are clicked', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupBranchesQuery([sampleBranch, sampleBranch2])

    const mockReorder = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useMutation).mockReturnValue(mockReorder as any)

    const BranchesPageComponent = (Route as any).options.component
    const { container } = render(<BranchesPageComponent />)

    // Find and click the UP button
    const buttons = container.querySelectorAll('button')
    const enabledUpButtons = Array.from(buttons).filter(
      (b) => !b.disabled && b.querySelector('.lucide-chevron-up'),
    )

    if (enabledUpButtons.length > 0) {
      fireEvent.click(enabledUpButtons[0])
    }
    await waitFor(() => {
      expect(mockReorder).toHaveBeenCalledWith(
        expect.objectContaining({ direction: 'up' }),
      )
    })

    // Find and click the DOWN button
    const enabledDownButtons = Array.from(buttons).filter(
      (b) => !b.disabled && b.querySelector('.lucide-chevron-down'),
    )
    if (enabledDownButtons.length > 0) {
      fireEvent.click(enabledDownButtons[0])
    }
    await waitFor(() => {
      expect(mockReorder).toHaveBeenCalledWith(
        expect.objectContaining({ direction: 'down' }),
      )
    })
  })

  test('cancel button in create dialog closes it', async () => {
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

    await waitFor(() => {
      expect(screen.getByText('branches.dialog.create')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }))

    await waitFor(() => {
      expect(
        screen.queryByText('branches.dialog.create'),
      ).not.toBeInTheDocument()
    })
  })

  test('cancel button in delete dialog closes it without calling deleteMutation', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupBranchesQuery([sampleBranch])

    const mockDelete = vi.fn()
    vi.mocked(useMutation).mockReturnValue(mockDelete as any)

    const BranchesPageComponent = (Route as any).options.component
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

  test('create dialog allows typing into description field', async () => {
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

    await waitFor(() => {
      expect(
        screen.getByLabelText(/branches\.fields\.description/),
      ).toBeInTheDocument()
    })

    const descInput = screen.getByLabelText(/branches\.fields\.description/)
    fireEvent.change(descInput, { target: { value: 'New description' } })

    expect(descInput).toHaveValue('New description')
  })

  test('pressing Escape closes the create dialog', async () => {
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

    await waitFor(() => {
      expect(screen.getByText('branches.dialog.create')).toBeInTheDocument()
    })

    fireEvent.keyDown(screen.getByRole('dialog'), {
      key: 'Escape',
      code: 'Escape',
    })

    await waitFor(() => {
      expect(
        screen.queryByText('branches.dialog.create'),
      ).not.toBeInTheDocument()
    })
  })

  test('pressing Escape closes the delete dialog', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupBranchesQuery([sampleBranch])

    const BranchesPageComponent = (Route as any).options.component
    render(<BranchesPageComponent />)

    await openRowAction('common.delete')

    await waitFor(() => {
      expect(screen.getByText('branches.delete.title')).toBeInTheDocument()
    })

    fireEvent.keyDown(screen.getByRole('alertdialog'), {
      key: 'Escape',
      code: 'Escape',
    })

    await waitFor(() => {
      expect(
        screen.queryByText('branches.delete.title'),
      ).not.toBeInTheDocument()
    })
  })

  test('calls updateMutation with undefined description when description is empty', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupBranchesQuery([sampleBranch])

    const mockUpdate = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useMutation).mockReturnValue(mockUpdate as any)

    const BranchesPageComponent = (Route as any).options.component
    render(<BranchesPageComponent />)

    await openRowAction('common.edit')

    await waitFor(() => {
      expect(
        screen.getByLabelText(/branches\.fields\.name/),
      ).toBeInTheDocument()
    })

    const descInput = screen.getByLabelText(/branches\.fields\.description/)
    fireEvent.change(descInput, { target: { value: '' } })

    fireEvent.click(screen.getByRole('button', { name: 'common.save' }))

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          description: undefined,
        }),
      )
    })
  })
})
