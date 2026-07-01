import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { AcademicYearForm } from './academic-year-form'
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

vi.mock('~/components/custom/date-input', () => ({
  DateInput: ({ value, onChange, placeholder }: any) => (
    <input 
      data-testid="mock-date-input" 
      placeholder={placeholder} 
      value={value ? new Date(value).toISOString().split('T')[0] : ''} 
      onChange={(e) => onChange(e.target.value ? new Date(e.target.value) : undefined)} 
    />
  )
}))

describe('AcademicYearForm', () => {
  const mockRequesterId = 'req123' as Id<'catechists'>
  const mockCreate = vi.fn().mockResolvedValue('new-id')
  const mockUpdate = vi.fn().mockResolvedValue('updated-id')
  const mockOnSuccess = vi.fn()
  const mockOnCancel = vi.fn()

  test('renders form fields for create mode', () => {
    render(
      <AcademicYearForm
        requesterId={mockRequesterId}
        createMutation={mockCreate}
        updateMutation={mockUpdate}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    )

    expect(screen.getByLabelText(/academicYears\.fields\.name/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('academicYears.fields.startDate')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('academicYears.fields.endDate')).toBeInTheDocument()
    expect(screen.getByLabelText(/academicYears\.fields\.numberOfSemesters/)).toBeInTheDocument()
  })

  test('calls create mutation on submit with valid data', async () => {
    render(
      <AcademicYearForm
        requesterId={mockRequesterId}
        createMutation={mockCreate}
        updateMutation={mockUpdate}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    )

    fireEvent.change(screen.getByPlaceholderText('academicYears.fields.name.placeholder'), {
      target: { value: '2023-2024' },
    })

    // Date inputs are rendered via DateInput mock
    // We can't easily query DateInput, so let's mock it or just assume it is in the DOM

    const nameInput = screen.getByPlaceholderText('academicYears.fields.name.placeholder')
    expect(nameInput).toHaveValue('2023-2024')

    // Since date input is a custom component, we might need to find its input
    // The placeholder is passed to DateInput.
    const startInput = screen.getByPlaceholderText('academicYears.fields.startDate')
    fireEvent.change(startInput, { target: { value: '2023-09-01' } })

    const endInput = screen.getByPlaceholderText('academicYears.fields.endDate')
    fireEvent.change(endInput, { target: { value: '2024-06-01' } })

    fireEvent.click(screen.getByText('common.save'))

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        name: '2023-2024',
        startDate: '2023-09-01',
        endDate: '2024-06-01',
        numberOfSemesters: 2,
      }))
    })
  })
})
