import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { toast } from 'sonner'
import { ClassForm } from './class-form'
import type { Id } from '../../../convex/_generated/dataModel'

vi.mock('~/lib/academic-year', () => ({
  useSelectedAcademicYear: () => ({
    selectedYearId: 'year123',
    setSelectedYearId: vi.fn(),
  }),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('~/components/ui/select', () => {
  return {
    Select: ({ value, onValueChange, children, disabled }: any) => {
      const [, forceUpdate] = React.useState(0)
      React.useEffect(() => {
        forceUpdate(1)
      }, [])
      return (
        <select
          data-testid="mock-select"
          value={value || ''}
          onChange={(e) => onValueChange(e.target.value)}
          disabled={disabled}
        >
          {children}
        </select>
      )
    },
    SelectTrigger: ({ children }: any) => <>{children}</>,
    SelectValue: ({ placeholder }: any) => (
      <option value="">{placeholder}</option>
    ),
    SelectContent: ({ children }: any) => <>{children}</>,
    SelectItem: ({ value, children }: any) => (
      <option value={value}>{children}</option>
    ),
  }
})

describe('ClassForm', () => {
  const mockRequesterId = 'req123' as Id<'catechists'>
  const mockOnSuccess = vi.fn()
  const mockOnCancel = vi.fn()
  let mockCreate: any
  let mockUpdate: any

  const mockBranches = [
    { _id: 'branch1' as Id<'branches'>, name: 'Chiên Con', _creationTime: 123 },
    { _id: 'branch2' as Id<'branches'>, name: 'Ấu Nhi', _creationTime: 124 },
  ] as Array<any>

  beforeEach(() => {
    mockCreate = vi.fn().mockResolvedValue('new-id')
    mockUpdate = vi.fn().mockResolvedValue('updated-id')
    vi.mocked(toast.success).mockClear()
    vi.mocked(toast.error).mockClear()
    mockOnSuccess.mockClear()
    mockOnCancel.mockClear()
  })

  test('renders form fields in create mode', () => {
    render(
      <ClassForm
        requesterId={mockRequesterId}
        branches={mockBranches}
        createMutation={mockCreate}
        updateMutation={mockUpdate}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />,
    )

    expect(screen.getByText(/classes\.fields\.name$/)).toBeInTheDocument()
    expect(screen.getByText(/classes\.fields\.branch$/)).toBeInTheDocument()
    expect(
      screen.getByText(/classes\.fields\.description$/),
    ).toBeInTheDocument()
    expect(screen.getByText('Chiên Con')).toBeInTheDocument()
    expect(screen.getByText('Ấu Nhi')).toBeInTheDocument()
  })

  test('calls create mutation on submit with valid data', async () => {
    render(
      <ClassForm
        requesterId={mockRequesterId}
        branches={mockBranches}
        createMutation={mockCreate}
        updateMutation={mockUpdate}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />,
    )

    fireEvent.change(
      screen.getByPlaceholderText('classes.fields.name.placeholder'),
      { target: { value: 'New Class' } },
    )

    const select = screen.getAllByTestId('mock-select')[0]
    fireEvent.change(select, { target: { value: 'branch1' } })

    fireEvent.change(
      screen.getByPlaceholderText('classes.fields.description.placeholder'),
      { target: { value: 'A description' } },
    )

    fireEvent.click(screen.getByText('common.save'))

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          requesterId: 'req123',
          branchId: 'branch1',
          name: 'New Class',
          description: 'A description',
          academicYearId: 'year123',
        }),
      )
    })
    expect(mockOnSuccess).toHaveBeenCalled()
  })

  test('calls update mutation when classId is provided', async () => {
    render(
      <ClassForm
        classId={'class123' as Id<'classes'>}
        initialValues={{
          name: 'Old Class',
          branchId: 'branch1',
          description: 'Old desc',
        }}
        requesterId={mockRequesterId}
        branches={mockBranches}
        createMutation={mockCreate}
        updateMutation={mockUpdate}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />,
    )

    fireEvent.change(
      screen.getByPlaceholderText('classes.fields.name.placeholder'),
      { target: { value: 'Updated Class' } },
    )

    fireEvent.click(screen.getByText('common.save'))

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          classId: 'class123',
          name: 'Updated Class',
          description: 'Old desc',
        }),
      )
    })
  })

  test('does not submit when name is empty', async () => {
    render(
      <ClassForm
        requesterId={mockRequesterId}
        branches={mockBranches}
        createMutation={mockCreate}
        updateMutation={mockUpdate}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />,
    )

    const select = screen.getAllByTestId('mock-select')[0]
    fireEvent.change(select, { target: { value: 'branch1' } })

    fireEvent.click(screen.getByText('common.save'))

    await new Promise((r) => setTimeout(r, 100))
    expect(mockCreate).not.toHaveBeenCalled()
  })

  test('does not submit when branchId is empty', async () => {
    render(
      <ClassForm
        requesterId={mockRequesterId}
        branches={mockBranches}
        createMutation={mockCreate}
        updateMutation={mockUpdate}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />,
    )

    fireEvent.change(
      screen.getByPlaceholderText('classes.fields.name.placeholder'),
      { target: { value: 'New Class' } },
    )

    fireEvent.click(screen.getByText('common.save'))

    await new Promise((r) => setTimeout(r, 100))
    expect(mockCreate).not.toHaveBeenCalled()
  })

  test('shows generic save error for unknown errors', async () => {
    const mockCreateWithError = vi.fn().mockRejectedValue(new Error('UNKNOWN'))

    render(
      <ClassForm
        requesterId={mockRequesterId}
        branches={mockBranches}
        createMutation={mockCreateWithError as any}
        updateMutation={mockUpdate}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />,
    )

    fireEvent.change(
      screen.getByPlaceholderText('classes.fields.name.placeholder'),
      { target: { value: 'Test' } },
    )

    const select = screen.getAllByTestId('mock-select')[0]
    fireEvent.change(select, { target: { value: 'branch1' } })

    fireEvent.click(screen.getByText('common.save'))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('classes.saveError')
    })
  })

  test('cancels directly when form is not dirty', () => {
    render(
      <ClassForm
        requesterId={mockRequesterId}
        branches={mockBranches}
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
      <ClassForm
        requesterId={mockRequesterId}
        branches={mockBranches}
        createMutation={mockCreate}
        updateMutation={mockUpdate}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />,
    )

    fireEvent.change(
      screen.getByPlaceholderText('classes.fields.name.placeholder'),
      { target: { value: 'New Class' } },
    )

    fireEvent.click(screen.getByText('common.cancel'))
    expect(screen.getByText('classes.confirmLeave.title')).toBeInTheDocument()
  })

  test('discard button in confirm dialog navigates away', () => {
    render(
      <ClassForm
        requesterId={mockRequesterId}
        branches={mockBranches}
        createMutation={mockCreate}
        updateMutation={mockUpdate}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />,
    )

    fireEvent.change(
      screen.getByPlaceholderText('classes.fields.name.placeholder'),
      { target: { value: 'New Class' } },
    )

    fireEvent.click(screen.getByText('common.cancel'))
    fireEvent.click(screen.getByText('classes.confirmLeave.discard'))
    expect(mockOnCancel).toHaveBeenCalled()
  })

  test('disables branch select in edit mode', () => {
    render(
      <ClassForm
        classId={'class123' as Id<'classes'>}
        initialValues={{
          name: 'Existing',
          branchId: 'branch1',
          description: '',
        }}
        requesterId={mockRequesterId}
        branches={mockBranches}
        createMutation={mockCreate}
        updateMutation={mockUpdate}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />,
    )

    const select = screen.getAllByTestId('mock-select')[0]
    expect(select).toBeDisabled()
  })

  test('renders classType select with default value primary', () => {
    render(
      <ClassForm
        requesterId={mockRequesterId}
        branches={mockBranches}
        createMutation={mockCreate}
        updateMutation={mockUpdate}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />,
    )

    const classTypeSelect = screen.getAllByTestId('mock-select')[1]
    expect(classTypeSelect).toHaveValue('primary')
  })

  test('includes classType in create mutation call', async () => {
    render(
      <ClassForm
        requesterId={mockRequesterId}
        branches={mockBranches}
        createMutation={mockCreate}
        updateMutation={mockUpdate}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />,
    )

    fireEvent.change(
      screen.getByPlaceholderText('classes.fields.name.placeholder'),
      { target: { value: 'New Class' } },
    )

    const branchSelect = screen.getAllByTestId('mock-select')[0]
    fireEvent.change(branchSelect, { target: { value: 'branch1' } })

    const classTypeSelect = screen.getAllByTestId('mock-select')[1]
    fireEvent.change(classTypeSelect, { target: { value: 'apostle' } })

    fireEvent.click(screen.getByText('common.save'))

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Class',
          branchId: 'branch1',
          classType: 'apostle',
        }),
      )
    })
  })

  test('calls updateClassYearMutation when classYearId is provided in edit mode', async () => {
    const mockUpdateClassYear = vi.fn().mockResolvedValue(undefined)

    render(
      <ClassForm
        classId={'class123' as Id<'classes'>}
        classYearId={'classYear123' as Id<'classYears'>}
        initialValues={{
          name: 'Old Class',
          branchId: 'branch1',
          description: 'Old desc',
          classType: 'primary',
        }}
        requesterId={mockRequesterId}
        branches={mockBranches}
        createMutation={mockCreate}
        updateMutation={mockUpdate}
        updateClassYearMutation={mockUpdateClassYear}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />,
    )

    const classTypeSelect = screen.getAllByTestId('mock-select')[1]
    fireEvent.change(classTypeSelect, { target: { value: 'sacrament_review' } })

    fireEvent.click(screen.getByText('common.save'))

    await waitFor(() => {
      expect(mockUpdateClassYear).toHaveBeenCalledWith({
        requesterId: 'req123',
        classYearId: 'classYear123',
        classType: 'sacrament_review',
      })
    })
    expect(mockUpdate).toHaveBeenCalled()
  })

  test('does not call updateClassYearMutation when classYearId is missing in edit mode', async () => {
    const mockUpdateClassYear = vi.fn().mockResolvedValue(undefined)

    render(
      <ClassForm
        classId={'class123' as Id<'classes'>}
        initialValues={{
          name: 'Old Class',
          branchId: 'branch1',
          description: 'Old desc',
          classType: 'primary',
        }}
        requesterId={mockRequesterId}
        branches={mockBranches}
        createMutation={mockCreate}
        updateMutation={mockUpdate}
        updateClassYearMutation={mockUpdateClassYear}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />,
    )

    fireEvent.click(screen.getByText('common.save'))

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalled()
    })
    expect(mockUpdateClassYear).not.toHaveBeenCalled()
  })

  test('disables classType select when classId is set but classYearId is not', () => {
    render(
      <ClassForm
        classId={'class123' as Id<'classes'>}
        initialValues={{
          name: 'Existing',
          branchId: 'branch1',
          description: '',
        }}
        requesterId={mockRequesterId}
        branches={mockBranches}
        createMutation={mockCreate}
        updateMutation={mockUpdate}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />,
    )

    const classTypeSelect = screen.getAllByTestId('mock-select')[1]
    expect(classTypeSelect).toBeDisabled()
  })

  test('enables classType select when classYearId is provided in edit mode', () => {
    render(
      <ClassForm
        classId={'class123' as Id<'classes'>}
        classYearId={'classYear123' as Id<'classYears'>}
        initialValues={{
          name: 'Existing',
          branchId: 'branch1',
          description: '',
          classType: 'apostle',
        }}
        requesterId={mockRequesterId}
        branches={mockBranches}
        createMutation={mockCreate}
        updateMutation={mockUpdate}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />,
    )

    const classTypeSelect = screen.getAllByTestId('mock-select')[1]
    expect(classTypeSelect).not.toBeDisabled()
    expect(classTypeSelect).toHaveValue('apostle')
  })

  test('submits without description in create mode', async () => {
    render(
      <ClassForm
        requesterId={mockRequesterId}
        branches={mockBranches}
        createMutation={mockCreate}
        updateMutation={mockUpdate}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />,
    )

    fireEvent.change(
      screen.getByPlaceholderText('classes.fields.name.placeholder'),
      { target: { value: 'Minimal Class' } },
    )

    const select = screen.getAllByTestId('mock-select')[0]
    fireEvent.change(select, { target: { value: 'branch2' } })

    fireEvent.click(screen.getByText('common.save'))

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Minimal Class',
          branchId: 'branch2',
          description: undefined,
          academicYearId: 'year123',
        }),
      )
    })
  })
})
