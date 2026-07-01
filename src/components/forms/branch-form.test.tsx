import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { BranchForm } from './branch-form'
import type { Id } from '../../../convex/_generated/dataModel'
import { BRANCH_ERRORS } from '../../../convex/lib/errors'
import { toast } from 'sonner'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

describe('BranchForm', () => {
  const mockRequesterId = 'req123' as Id<'catechists'>
  const mockOnSuccess = vi.fn()
  const mockOnCancel = vi.fn()
  let mockCreate: ReturnType<typeof vi.fn>
  let mockUpdate: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockCreate = vi.fn().mockResolvedValue('new-id')
    mockUpdate = vi.fn().mockResolvedValue('updated-id')
    vi.mocked(toast.success).mockClear()
    vi.mocked(toast.error).mockClear()
    mockOnSuccess.mockClear()
    mockOnCancel.mockClear()
  })

  test('renders form fields', () => {
    render(
      <BranchForm
        requesterId={mockRequesterId}
        createMutation={mockCreate}
        updateMutation={mockUpdate}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />,
    )

    expect(screen.getByLabelText(/branches\.fields\.name/)).toBeInTheDocument()
    expect(
      screen.getByLabelText(/branches\.fields\.description/),
    ).toBeInTheDocument()
  })

  test('calls create mutation on submit with valid data', async () => {
    render(
      <BranchForm
        requesterId={mockRequesterId}
        createMutation={mockCreate}
        updateMutation={mockUpdate}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />,
    )

    fireEvent.change(
      screen.getByPlaceholderText('branches.fields.name.placeholder'),
      { target: { value: 'New Branch' } },
    )

    fireEvent.change(
      screen.getByPlaceholderText('branches.fields.description.placeholder'),
      { target: { value: 'Branch description' } },
    )

    fireEvent.click(screen.getByText('common.save'))

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Branch',
          description: 'Branch description',
        }),
      )
    })
    expect(mockOnSuccess).toHaveBeenCalled()
  })

  test('calls update mutation when branchId is provided', async () => {
    render(
      <BranchForm
        branchId={'branch123' as Id<'branches'>}
        initialValues={{ name: 'Old Name', description: 'Old desc' }}
        requesterId={mockRequesterId}
        createMutation={mockCreate}
        updateMutation={mockUpdate}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />,
    )

    fireEvent.change(
      screen.getByPlaceholderText('branches.fields.name.placeholder'),
      { target: { value: 'Updated Name' } },
    )

    fireEvent.click(screen.getByText('common.save'))

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          branchId: 'branch123',
          name: 'Updated Name',
          description: 'Old desc',
        }),
      )
    })
  })

  test('shows duplicate name error toast', async () => {
    const mockCreateWithError = vi
      .fn()
      .mockRejectedValue(new Error(BRANCH_ERRORS.DUPLICATE_NAME))

    render(
      <BranchForm
        requesterId={mockRequesterId}
        createMutation={mockCreateWithError as any}
        updateMutation={mockUpdate}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />,
    )

    fireEvent.change(
      screen.getByPlaceholderText('branches.fields.name.placeholder'),
      { target: { value: 'Duplicate Name' } },
    )

    fireEvent.click(screen.getByText('common.save'))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('branches.fields.name.duplicate')
    })
  })

  test('shows generic save error for unknown errors', async () => {
    const mockCreateWithError = vi
      .fn()
      .mockRejectedValue(new Error('UNKNOWN'))

    render(
      <BranchForm
        requesterId={mockRequesterId}
        createMutation={mockCreateWithError as any}
        updateMutation={mockUpdate}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />,
    )

    fireEvent.change(
      screen.getByPlaceholderText('branches.fields.name.placeholder'),
      { target: { value: 'Test' } },
    )

    fireEvent.click(screen.getByText('common.save'))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('branches.saveError')
    })
  })

  test('cancels directly when form is not dirty', () => {
    render(
      <BranchForm
        requesterId={mockRequesterId}
        createMutation={mockCreate}
        updateMutation={mockUpdate}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />,
    )

    fireEvent.click(screen.getByText('common.cancel'))
    expect(mockOnCancel).toHaveBeenCalled()
  })

  test('shows confirm leave dialog when form is dirty and cancel is clicked', () => {
    render(
      <BranchForm
        requesterId={mockRequesterId}
        createMutation={mockCreate}
        updateMutation={mockUpdate}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />,
    )

    fireEvent.change(
      screen.getByPlaceholderText('branches.fields.name.placeholder'),
      { target: { value: 'New Branch' } },
    )

    fireEvent.click(screen.getByText('common.cancel'))
    expect(screen.getByText('branches.confirmLeave.title')).toBeInTheDocument()
  })

  test('discard button in confirm dialog navigates away', () => {
    render(
      <BranchForm
        requesterId={mockRequesterId}
        createMutation={mockCreate}
        updateMutation={mockUpdate}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />,
    )

    fireEvent.change(
      screen.getByPlaceholderText('branches.fields.name.placeholder'),
      { target: { value: 'New Branch' } },
    )

    fireEvent.click(screen.getByText('common.cancel'))
    fireEvent.click(screen.getByText('branches.confirmLeave.discard'))
    expect(mockOnCancel).toHaveBeenCalled()
  })

  test('does not submit when name is empty', async () => {
    render(
      <BranchForm
        requesterId={mockRequesterId}
        createMutation={mockCreate}
        updateMutation={mockUpdate}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />,
    )

    fireEvent.click(screen.getByText('common.save'))

    await new Promise((r) => setTimeout(r, 100))
    expect(mockCreate).not.toHaveBeenCalled()
  })

  test('submits without description in create mode', async () => {
    render(
      <BranchForm
        requesterId={mockRequesterId}
        createMutation={mockCreate}
        updateMutation={mockUpdate}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />,
    )

    fireEvent.change(
      screen.getByPlaceholderText('branches.fields.name.placeholder'),
      { target: { value: 'Minimal Branch' } },
    )

    fireEvent.click(screen.getByText('common.save'))

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Minimal Branch',
          description: undefined,
        }),
      )
    })
  })
})
