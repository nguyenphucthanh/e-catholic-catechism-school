import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { AcademicYearForm } from './academic-year-form'
import type { Id } from '../../../convex/_generated/dataModel'
import { ACADEMIC_YEAR_ERRORS } from '../../../convex/lib/errors'
import { toast } from 'sonner'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('~/components/custom/date-input', () => ({
  DateInput: ({ value, onChange, placeholder }: any) => (
    <input
      data-testid="mock-date-input"
      placeholder={placeholder}
      value={value ? new Date(value).toISOString().split('T')[0] : ''}
      onChange={(e) =>
        onChange(e.target.value ? new Date(e.target.value) : undefined)
      }
    />
  ),
}))

describe('AcademicYearForm', () => {
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

  test('renders form fields for create mode', () => {
    render(
      <AcademicYearForm
        requesterId={mockRequesterId}
        createMutation={mockCreate}
        updateMutation={mockUpdate}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />,
    )

    expect(
      screen.getByLabelText(/academicYears\.fields\.name/),
    ).toBeInTheDocument()
    expect(
      screen.getByPlaceholderText('academicYears.fields.startDate'),
    ).toBeInTheDocument()
    expect(
      screen.getByPlaceholderText('academicYears.fields.endDate'),
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText(/academicYears\.fields\.numberOfSemesters/),
    ).toBeInTheDocument()
  })

  test('calls create mutation on submit with valid data', async () => {
    render(
      <AcademicYearForm
        requesterId={mockRequesterId}
        createMutation={mockCreate}
        updateMutation={mockUpdate}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />,
    )

    fireEvent.change(
      screen.getByPlaceholderText('academicYears.fields.name.placeholder'),
      { target: { value: '2023-2024' } },
    )

    const startInput = screen.getByPlaceholderText('academicYears.fields.startDate')
    fireEvent.change(startInput, { target: { value: '2023-09-01' } })

    const endInput = screen.getByPlaceholderText('academicYears.fields.endDate')
    fireEvent.change(endInput, { target: { value: '2024-06-01' } })

    fireEvent.click(screen.getByText('common.save'))

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: '2023-2024',
          startDate: '2023-09-01',
          endDate: '2024-06-01',
          numberOfSemesters: 2,
        }),
      )
    })
    expect(mockOnSuccess).toHaveBeenCalled()
  })

  test('calls update mutation when yearId is provided', async () => {
    render(
      <AcademicYearForm
        yearId={'year123' as Id<'academicYears'>}
        initialValues={{ name: '2024-2025', startDate: '2024-09-01', endDate: '2025-05-31' }}
        requesterId={mockRequesterId}
        createMutation={mockCreate}
        updateMutation={mockUpdate}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />,
    )

    fireEvent.change(
      screen.getByPlaceholderText('academicYears.fields.name.placeholder'),
      { target: { value: '2025-2026' } },
    )

    fireEvent.click(screen.getByText('common.save'))

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          academicYearId: 'year123',
          name: '2025-2026',
        }),
      )
    })
  })

  test('shows date range error when start date >= end date', async () => {
    render(
      <AcademicYearForm
        requesterId={mockRequesterId}
        createMutation={mockCreate}
        updateMutation={mockUpdate}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />,
    )

    fireEvent.change(
      screen.getByPlaceholderText('academicYears.fields.name.placeholder'),
      { target: { value: '2025-2026' } },
    )

    const startInput = screen.getByPlaceholderText('academicYears.fields.startDate')
    fireEvent.change(startInput, { target: { value: '2025-09-01' } })

    const endInput = screen.getByPlaceholderText('academicYears.fields.endDate')
    fireEvent.change(endInput, { target: { value: '2025-01-01' } })

    fireEvent.click(screen.getByText('common.save'))

    await waitFor(() => {
      expect(mockCreate).not.toHaveBeenCalled()
    })
  })

  test('shows duplicate name error toast from create mutation', async () => {
    const mockCreateWithError = vi
      .fn()
      .mockRejectedValue(new Error(ACADEMIC_YEAR_ERRORS.DUPLICATE_NAME))

    render(
      <AcademicYearForm
        requesterId={mockRequesterId}
        createMutation={mockCreateWithError as any}
        updateMutation={mockUpdate}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />,
    )

    fireEvent.change(
      screen.getByPlaceholderText('academicYears.fields.name.placeholder'),
      { target: { value: '2024-2025' } },
    )

    const startInput = screen.getByPlaceholderText('academicYears.fields.startDate')
    fireEvent.change(startInput, { target: { value: '2024-09-01' } })

    const endInput = screen.getByPlaceholderText('academicYears.fields.endDate')
    fireEvent.change(endInput, { target: { value: '2025-06-01' } })

    fireEvent.click(screen.getByText('common.save'))

    await waitFor(() => {
      expect(mockCreateWithError).toHaveBeenCalled()
      expect(toast.error).toHaveBeenCalledWith('academicYears.fields.name.duplicate')
    })
  })

  test('shows invalid semester count error', async () => {
    const mockCreateWithError = vi
      .fn()
      .mockRejectedValue(new Error(ACADEMIC_YEAR_ERRORS.INVALID_SEMESTER_COUNT))

    render(
      <AcademicYearForm
        requesterId={mockRequesterId}
        createMutation={mockCreateWithError as any}
        updateMutation={mockUpdate}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />,
    )

    fireEvent.change(
      screen.getByPlaceholderText('academicYears.fields.name.placeholder'),
      { target: { value: '2024-2025' } },
    )

    const startInput = screen.getByPlaceholderText('academicYears.fields.startDate')
    fireEvent.change(startInput, { target: { value: '2024-09-01' } })

    const endInput = screen.getByPlaceholderText('academicYears.fields.endDate')
    fireEvent.change(endInput, { target: { value: '2025-06-01' } })

    fireEvent.click(screen.getByText('common.save'))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('academicYears.fields.numberOfSemesters.error')
    })
  })

  test('shows generic save error when error message does not match known errors', async () => {
    const mockCreateWithError = vi
      .fn()
      .mockRejectedValue(new Error('UNKNOWN_ERROR'))

    render(
      <AcademicYearForm
        requesterId={mockRequesterId}
        createMutation={mockCreateWithError as any}
        updateMutation={mockUpdate}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />,
    )

    fireEvent.change(
      screen.getByPlaceholderText('academicYears.fields.name.placeholder'),
      { target: { value: '2024-2025' } },
    )

    const startInput = screen.getByPlaceholderText('academicYears.fields.startDate')
    fireEvent.change(startInput, { target: { value: '2024-09-01' } })

    const endInput = screen.getByPlaceholderText('academicYears.fields.endDate')
    fireEvent.change(endInput, { target: { value: '2025-06-01' } })

    fireEvent.click(screen.getByText('common.save'))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('academicYears.saveError')
    })
  })

  test('cancels directly when form is not dirty', () => {
    render(
      <AcademicYearForm
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
      <AcademicYearForm
        requesterId={mockRequesterId}
        createMutation={mockCreate}
        updateMutation={mockUpdate}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />,
    )

    fireEvent.change(
      screen.getByPlaceholderText('academicYears.fields.name.placeholder'),
      { target: { value: '2024-2025' } },
    )

    fireEvent.click(screen.getByText('common.cancel'))
    expect(
      screen.getByText('academicYears.confirmLeave.title'),
    ).toBeInTheDocument()
  })

  test('discard button in confirm dialog navigates away', () => {
    render(
      <AcademicYearForm
        requesterId={mockRequesterId}
        createMutation={mockCreate}
        updateMutation={mockUpdate}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />,
    )

    fireEvent.change(
      screen.getByPlaceholderText('academicYears.fields.name.placeholder'),
      { target: { value: '2024-2025' } },
    )

    fireEvent.click(screen.getByText('common.cancel'))
    fireEvent.click(screen.getByText('academicYears.confirmLeave.discard'))
    expect(mockOnCancel).toHaveBeenCalled()
  })

  test('hides numberOfSemesters field in update mode', () => {
    render(
      <AcademicYearForm
        yearId={'year123' as Id<'academicYears'>}
        initialValues={{ name: '2024-2025', startDate: '2024-09-01', endDate: '2025-05-31' }}
        requesterId={mockRequesterId}
        createMutation={mockCreate}
        updateMutation={mockUpdate}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />,
    )

    expect(
      screen.queryByLabelText(/academicYears\.fields\.numberOfSemesters/),
    ).not.toBeInTheDocument()
  })

  test('calls update mutation with correct data in update mode', async () => {
    render(
      <AcademicYearForm
        yearId={'year123' as Id<'academicYears'>}
        initialValues={{ name: '2024-2025', startDate: '2024-09-01', endDate: '2025-05-31' }}
        requesterId={mockRequesterId}
        createMutation={mockCreate}
        updateMutation={mockUpdate}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />,
    )

    fireEvent.click(screen.getByText('common.save'))

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          requesterId: 'req123',
          academicYearId: 'year123',
          name: '2024-2025',
          startDate: '2024-09-01',
          endDate: '2025-05-31',
        }),
      )
    })
  })
})
