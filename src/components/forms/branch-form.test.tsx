import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { BranchForm } from './branch-form'
import type { Id } from '../../../convex/_generated/dataModel'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe('BranchForm', () => {
  const mockRequesterId = 'req123' as Id<'catechists'>
  const mockCreate = vi.fn().mockResolvedValue('new-id')
  const mockUpdate = vi.fn().mockResolvedValue('updated-id')
  const mockOnSuccess = vi.fn()
  const mockOnCancel = vi.fn()

  test('renders form fields', () => {
    render(
      <BranchForm
        requesterId={mockRequesterId}
        createMutation={mockCreate}
        updateMutation={mockUpdate}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    )

    expect(screen.getByLabelText(/branches\.fields\.name/)).toBeInTheDocument()
    expect(screen.getByLabelText(/branches\.fields\.description/)).toBeInTheDocument()
  })

  test('calls create mutation on submit with valid data', async () => {
    render(
      <BranchForm
        requesterId={mockRequesterId}
        createMutation={mockCreate}
        updateMutation={mockUpdate}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    )

    fireEvent.change(screen.getByPlaceholderText('branches.fields.name.placeholder'), {
      target: { value: 'New Branch' },
    })

    fireEvent.change(screen.getByPlaceholderText('branches.fields.description.placeholder'), {
      target: { value: 'Branch description' },
    })

    fireEvent.click(screen.getByText('common.save'))

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        name: 'New Branch',
        description: 'Branch description',
      }))
    })
  })
})
