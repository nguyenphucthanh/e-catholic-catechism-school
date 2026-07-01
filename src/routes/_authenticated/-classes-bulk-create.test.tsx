import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { CLASS_ERRORS } from '../../../convex/lib/errors'
import { Route } from './classes_.bulk-create'
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

const sampleBranches = [
  {
    _id: 'branch1',
    name: 'Ấu Nhi',
    sortOrder: 1,
    description: '',
    isDeleted: false,
  },
  {
    _id: 'branch2',
    name: 'Thiếu Nhi',
    sortOrder: 2,
    description: '',
    isDeleted: false,
  },
]

function setupQueries(branches?: Array<any> | undefined) {
  const b = arguments.length > 0 ? branches : sampleBranches
  vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
    const path = queryRef?.[Symbol.for('functionName')]
    if (path === 'branches:list') return b
    return undefined
  })
}

const navigateMock = vi.fn()
vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

describe('BulkCreateClassesPage component', () => {
  beforeEach(() => {
    navigateMock.mockClear()
  })

  test('renders unauthorized message for non-board user', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockCatechistUser,
    })
    setupQueries()

    const BulkCreateComponent = (Route as any).options.component
    render(<BulkCreateComponent />)

    expect(screen.getByText(/common\.contactAdmin/i)).toBeInTheDocument()
  })

  test('renders loading state when branches are undefined', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupQueries(undefined)

    const BulkCreateComponent = (Route as any).options.component
    const { container } = render(<BulkCreateComponent />)

    const pulseElements = container.querySelectorAll('.animate-pulse')
    expect(pulseElements.length).toBeGreaterThan(0)
  })

  test('renders no entries message when branches are empty', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupQueries([])

    const BulkCreateComponent = (Route as any).options.component
    render(<BulkCreateComponent />)

    expect(screen.getByText('classes.bulkCreate.noEntries')).toBeInTheDocument()
  })

  test('renders form with branches and allows adding/removing rows', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupQueries()

    const BulkCreateComponent = (Route as any).options.component
    render(<BulkCreateComponent />)

    // Should render branch names
    expect(screen.getByText('Ấu Nhi')).toBeInTheDocument()
    expect(screen.getByText('Thiếu Nhi')).toBeInTheDocument()

    // Each branch starts with 1 empty input
    const inputs = screen.getAllByPlaceholderText(
      'classes.fields.name.placeholder',
    )
    expect(inputs).toHaveLength(2)

    // Add row to first branch (Ấu Nhi)
    const addButtons = screen.getAllByRole('button', {
      name: 'classes.bulkCreate.addRow',
    })
    expect(addButtons).toHaveLength(2)
    fireEvent.click(addButtons[0]) // Add to Ấu Nhi

    const inputsAfterAdd = screen.getAllByPlaceholderText(
      'classes.fields.name.placeholder',
    )
    expect(inputsAfterAdd).toHaveLength(3)

    // Remove row from first branch
    const removeButtons = screen.getAllByRole('button', {
      name: 'classes.bulkCreate.removeRow',
    })
    fireEvent.click(removeButtons[0]) // Remove first row of Ấu Nhi

    const inputsAfterRemove = screen.getAllByPlaceholderText(
      'classes.fields.name.placeholder',
    )
    expect(inputsAfterRemove).toHaveLength(2)
  })

  test('prevents submission if all inputs are empty', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupQueries()
    const mockCreate = vi.fn()
    vi.mocked(useMutation).mockReturnValue(mockCreate as any)

    const BulkCreateComponent = (Route as any).options.component
    render(<BulkCreateComponent />)

    // Try to submit with default empty inputs
    fireEvent.click(
      screen.getByRole('button', { name: 'classes.bulkCreate.submit' }),
    )

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('classes.bulkCreate.emptyName')
    })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  test('prevents submission if duplicate name in the same branch in the form', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupQueries()
    const mockCreate = vi.fn()
    vi.mocked(useMutation).mockReturnValue(mockCreate as any)

    const BulkCreateComponent = (Route as any).options.component
    render(<BulkCreateComponent />)

    // Add a second row to Ấu Nhi
    const addButtons = screen.getAllByRole('button', {
      name: 'classes.bulkCreate.addRow',
    })
    fireEvent.click(addButtons[0])

    const inputs = screen.getAllByPlaceholderText(
      'classes.fields.name.placeholder',
    )
    fireEvent.change(inputs[0], { target: { value: 'Class A' } })
    fireEvent.change(inputs[1], { target: { value: 'Class A' } })

    fireEvent.click(
      screen.getByRole('button', { name: 'classes.bulkCreate.submit' }),
    )

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'classes.bulkCreate.duplicateName',
      )
    })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  test('calls bulkCreateMutation and redirects on success', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: { ...mockBoardUser, userDocId: 'catechist123' },
    })
    setupQueries()

    const mockCreate = vi.fn().mockResolvedValue(['id1', 'id2'])
    vi.mocked(useMutation).mockReturnValue(mockCreate as any)

    const BulkCreateComponent = (Route as any).options.component
    render(<BulkCreateComponent />)

    const inputs = screen.getAllByPlaceholderText(
      'classes.fields.name.placeholder',
    )
    fireEvent.change(inputs[0], { target: { value: 'Class 1' } }) // Ấu Nhi
    fireEvent.change(inputs[1], { target: { value: 'Class 2' } }) // Thiếu Nhi

    fireEvent.click(
      screen.getByRole('button', { name: 'classes.bulkCreate.submit' }),
    )

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          requesterId: 'catechist123',
          classes: [
            { branchId: 'branch1', name: 'Class 1' },
            { branchId: 'branch2', name: 'Class 2' },
          ],
        }),
      )
    })
    // toast doesn't accept object directly, it checks it differently. Just verify it's called
    expect(toast.success).toHaveBeenCalled()
    expect(navigateMock).toHaveBeenCalledWith({ to: '/classes' })
  })

  test('shows dirty form dialog when clicking cancel with dirty state', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupQueries()

    const BulkCreateComponent = (Route as any).options.component
    render(<BulkCreateComponent />)

    // Make form dirty
    const inputs = screen.getAllByPlaceholderText(
      'classes.fields.name.placeholder',
    )
    fireEvent.change(inputs[0], { target: { value: 'Class 1' } })

    // Click cancel
    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }))

    await waitFor(() => {
      expect(screen.getByText('classes.confirmLeave.title')).toBeInTheDocument()
    })

    // Confirm discard
    fireEvent.click(
      screen.getByRole('button', { name: 'classes.confirmLeave.discard' }),
    )

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({ to: '/classes' })
    })
  })

  test('shows error toast when mutation fails', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: { ...mockBoardUser, userDocId: 'catechist123' },
    })
    setupQueries()

    const mockCreate = vi
      .fn()
      .mockRejectedValue(new Error(CLASS_ERRORS.DUPLICATE_NAME))
    vi.mocked(useMutation).mockReturnValue(mockCreate as any)

    const BulkCreateComponent = (Route as any).options.component
    render(<BulkCreateComponent />)

    const inputs = screen.getAllByPlaceholderText(
      'classes.fields.name.placeholder',
    )
    fireEvent.change(inputs[0], { target: { value: 'Class 1' } })

    fireEvent.click(
      screen.getByRole('button', { name: 'classes.bulkCreate.submit' }),
    )

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'classes.bulkCreate.duplicateName',
      )
    })
    expect(navigateMock).not.toHaveBeenCalled()
  })
})
