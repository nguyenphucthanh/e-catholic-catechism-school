import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { CLASS_ERRORS } from '../../../convex/lib/errors'
import { Route } from './classes'
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
  role: 'board',
} as any

const mockCatechistUser = {
  ...mockBoardUser,
  role: 'catechist',
}

const sampleBranch = {
  _id: 'branch123',
  name: 'Ấu Nhi',
  sortOrder: 1,
  description: 'Mô tả ấu nhi',
  isDeleted: false,
}

const sampleClass = {
  _id: 'class123',
  branchId: 'branch123',
  name: 'Ấu Nhi 1',
  description: 'Mô tả lớp',
  isDeleted: false,
}

function setupQueries(
  classes: Array<any> | undefined = [sampleClass],
  branches: Array<any> | undefined = [sampleBranch],
) {
  vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
    const path = queryRef?.[Symbol.for('functionName')]
    if (path === 'classes:list') return classes
    if (path === 'branches:list') return branches
    return undefined
  })
}

describe('ClassesPage component', () => {
  test('renders unauthorized message for non-board user', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockCatechistUser,
    })
    setupQueries()

    const ClassesPageComponent = (Route as any).options.component
    render(<ClassesPageComponent />)

    expect(
      screen.getByText(/common\.unauthorized|Unauthorized access/i),
    ).toBeInTheDocument()
    expect(screen.queryByText('classes.title')).not.toBeInTheDocument()
  })

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
      screen.getByRole('button', { name: /create|add/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('Ấu Nhi 1')).toBeInTheDocument()
    expect(screen.getByText('Ấu Nhi')).toBeInTheDocument() // Branch name should be resolved
  })

  test('renders loading skeleton when query returns undefined', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    vi.mocked(useQuery).mockReturnValue(undefined)

    const ClassesPageComponent = (Route as any).options.component
    const { container } = render(<ClassesPageComponent />)

    const pulseElements = container.querySelectorAll('.animate-pulse')
    expect(pulseElements.length).toBeGreaterThan(0)
  })

  test('opens create dialog when create button is clicked', async () => {
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

    await waitFor(() => {
      expect(screen.getByText('classes.dialog.create')).toBeInTheDocument()
    })
  })

  test('renders search input in the table toolbar', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupQueries()

    const ClassesPageComponent = (Route as any).options.component
    render(<ClassesPageComponent />)

    const searchInput = screen.getByPlaceholderText('classes.searchPlaceholder')
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
    setupQueries()

    const ClassesPageComponent = (Route as any).options.component
    render(<ClassesPageComponent />)

    await openRowAction('common.edit')

    await waitFor(() => {
      expect(screen.getByText('classes.dialog.edit')).toBeInTheDocument()
    })
    expect(screen.getByLabelText(/classes\.fields\.name/)).toHaveValue(
      'Ấu Nhi 1',
    )
  })

  test('calls createMutation when create form is submitted with valid data', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: { ...mockBoardUser, userDocId: 'catechist123' },
    })
    setupQueries()

    const mockCreate = vi.fn().mockResolvedValue('newClassId')
    vi.mocked(useMutation).mockReturnValue(mockCreate as any)

    const ClassesPageComponent = (Route as any).options.component
    render(<ClassesPageComponent />)

    fireEvent.click(
      screen.getByRole('button', { name: /classes\.actions\.create/i }),
    )

    await waitFor(() => {
      expect(screen.getByLabelText(/classes\.fields\.name/)).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText(/classes\.fields\.name/), {
      target: { value: 'Ấu Nhi 2' },
    })

    // Select branch
    const branchTrigger = screen.getByRole('combobox')
    fireEvent.click(branchTrigger)
    const listbox = await screen.findByRole('listbox')
    const branchOption = within(listbox).getByText('Ấu Nhi')
    fireEvent.click(branchOption)

    fireEvent.click(screen.getByRole('button', { name: 'common.save' }))

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          requesterId: 'catechist123',
          name: 'Ấu Nhi 2',
          branchId: 'branch123',
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
    setupQueries()

    const mockUpdate = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useMutation).mockReturnValue(mockUpdate as any)

    const ClassesPageComponent = (Route as any).options.component
    render(<ClassesPageComponent />)

    await openRowAction('common.edit')

    await waitFor(() => {
      expect(screen.getByLabelText(/classes\.fields\.name/)).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText(/classes\.fields\.name/), {
      target: { value: 'Ấu Nhi 1 Updated' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'common.save' }))

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          requesterId: 'catechist123',
          classId: 'class123',
          name: 'Ấu Nhi 1 Updated',
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
    setupQueries()

    const mockUpdate = vi
      .fn()
      .mockRejectedValue(new Error(`Boom: ${CLASS_ERRORS.DUPLICATE_NAME}`))
    vi.mocked(useMutation).mockReturnValue(mockUpdate as any)

    const ClassesPageComponent = (Route as any).options.component
    render(<ClassesPageComponent />)

    await openRowAction('common.edit')

    await waitFor(() => {
      expect(screen.getByLabelText(/classes\.fields\.name/)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'common.save' }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('classes.fields.name.duplicate')
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

  test('shows deleteInUseError toast when deleting fails with IN_USE_BY_CLASS_YEAR', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupQueries()

    const mockDelete = vi
      .fn()
      .mockRejectedValue(
        new Error(`Boom: ${CLASS_ERRORS.IN_USE_BY_CLASS_YEAR}`),
      )
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
      expect(toast.error).toHaveBeenCalledWith('classes.deleteInUseError')
    })
  })

  test('shows generic deleteError toast when delete fails with unknown error', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupQueries()

    const mockDelete = vi.fn().mockRejectedValue(new Error('Network Error'))
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
      expect(toast.error).toHaveBeenCalledWith('classes.deleteError')
    })
  })

  test('shows generic saveError toast when create fails with unknown error', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupQueries()

    const mockCreate = vi.fn().mockRejectedValue(new Error('Network Error'))
    vi.mocked(useMutation).mockReturnValue(mockCreate as any)

    const ClassesPageComponent = (Route as any).options.component
    render(<ClassesPageComponent />)

    fireEvent.click(
      screen.getByRole('button', { name: /classes\.actions\.create/i }),
    )

    await waitFor(() => {
      expect(screen.getByLabelText(/classes\.fields\.name/)).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText(/classes\.fields\.name/), {
      target: { value: 'New Class' },
    })

    // Select branch
    const branchTrigger = screen.getByRole('combobox')
    fireEvent.click(branchTrigger)
    const listbox = await screen.findByRole('listbox')
    const branchOption = within(listbox).getByText('Ấu Nhi')
    fireEvent.click(branchOption)

    fireEvent.click(screen.getByRole('button', { name: 'common.save' }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('classes.saveError')
    })
  })

  test('create dialog allows typing into description field', async () => {
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

    await waitFor(() => {
      expect(
        screen.getByLabelText(/classes\.fields\.description/),
      ).toBeInTheDocument()
    })

    const descInput = screen.getByLabelText(/classes\.fields\.description/)
    fireEvent.change(descInput, { target: { value: 'New description' } })

    expect(descInput).toHaveValue('New description')
  })

  test('pressing Escape closes the create dialog', async () => {
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

    await waitFor(() => {
      expect(screen.getByText('classes.dialog.create')).toBeInTheDocument()
    })

    fireEvent.keyDown(screen.getByRole('dialog'), {
      key: 'Escape',
      code: 'Escape',
    })

    await waitFor(() => {
      expect(
        screen.queryByText('classes.dialog.create'),
      ).not.toBeInTheDocument()
    })
  })

  test('pressing Escape closes the delete dialog', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupQueries()

    const mockDelete = vi.fn()
    vi.mocked(useMutation).mockReturnValue(mockDelete as any)

    const ClassesPageComponent = (Route as any).options.component
    render(<ClassesPageComponent />)

    await openRowAction('common.delete')

    await waitFor(() => {
      expect(screen.getByText('classes.delete.title')).toBeInTheDocument()
    })

    fireEvent.keyDown(screen.getByRole('alertdialog'), {
      key: 'Escape',
      code: 'Escape',
    })

    await waitFor(() => {
      expect(screen.queryByText('classes.delete.title')).not.toBeInTheDocument()
    })
    expect(mockDelete).not.toHaveBeenCalled()
  })

  test('calls updateMutation with undefined description when description is empty', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupQueries()

    const mockUpdate = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useMutation).mockReturnValue(mockUpdate as any)

    const ClassesPageComponent = (Route as any).options.component
    render(<ClassesPageComponent />)

    await openRowAction('common.edit')

    await waitFor(() => {
      expect(screen.getByLabelText(/classes\.fields\.name/)).toBeInTheDocument()
    })

    const descInput = screen.getByLabelText(/classes\.fields\.description/)
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

  test('cancel button in create dialog closes it', async () => {
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

    await waitFor(() => {
      expect(screen.getByText('classes.dialog.create')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }))

    await waitFor(() => {
      expect(
        screen.queryByText('classes.dialog.create'),
      ).not.toBeInTheDocument()
    })
  })

  test('cancel button in delete dialog closes it without calling deleteMutation', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupQueries()

    const mockDelete = vi.fn()
    vi.mocked(useMutation).mockReturnValue(mockDelete as any)

    const ClassesPageComponent = (Route as any).options.component
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
