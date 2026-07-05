import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { toast } from 'sonner'
import { useMutation } from 'convex/react'
import { BulkUpdateSacramentDialog } from './bulk-update-sacrament-dialog'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import { useAuth } from '~/lib/auth'

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

// Mock useAuth
vi.mock('~/lib/auth', () => ({
  useAuth: vi.fn(),
}))

// Mock useMutation (convex)
vi.mock('convex/react', () => ({
  useMutation: vi.fn(),
}))

// Mock Select wrappers
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

// Mock Dialog to render inline
vi.mock('~/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) =>
    open ? <div data-testid="mock-dialog">{children}</div> : null,
  DialogContent: ({ children }: any) => (
    <div data-testid="mock-dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
}))

// Mock ScrollArea
vi.mock('~/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: any) => (
    <div data-testid="mock-scroll-area">{children}</div>
  ),
}))

describe('BulkUpdateSacramentDialog', () => {
  const mockClassYearId = 'cy123' as Id<'classYears'>
  const mockClassName = 'Au Nhi 1'
  const mockOnOpenChange = vi.fn()
  let mockBulkUpdate: any

  const mockStudents = [
    {
      enrollment: {
        _id: 'sc1' as Id<'studentClasses'>,
        status: 'active' as const,
        enrolledDate: '2024-09-01',
      },
      student: {
        _id: 's1' as Id<'students'>,
        studentCode: 'HS001',
        fullName: 'Nguyen Van A',
        saintName: 'Giuse',
        isActive: true,
        isDeleted: false,
        createdAt: 123,
      } as Doc<'students'>,
    },
    {
      enrollment: {
        _id: 'sc2' as Id<'studentClasses'>,
        status: 'active' as const,
        enrolledDate: '2024-09-01',
      },
      student: {
        _id: 's2' as Id<'students'>,
        studentCode: 'HS002',
        fullName: 'Le Thi B',
        saintName: 'Maria',
        isActive: true,
        isDeleted: false,
        createdAt: 124,
      } as Doc<'students'>,
    },
    {
      // Inactive enrollment (should not show up in active students selection)
      enrollment: {
        _id: 'sc3' as Id<'studentClasses'>,
        status: 'withdrawn' as const,
        enrolledDate: '2024-09-01',
      },
      student: {
        _id: 's3' as Id<'students'>,
        studentCode: 'HS003',
        fullName: 'Tran Van C',
        saintName: 'Phero',
        isActive: true,
        isDeleted: false,
        createdAt: 125,
      } as Doc<'students'>,
    },
  ]

  beforeEach(() => {
    mockBulkUpdate = vi.fn().mockResolvedValue(true)
    vi.mocked(useMutation).mockReturnValue(mockBulkUpdate)
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'cat123' },
    } as any)
    vi.mocked(toast.success).mockClear()
    vi.mocked(toast.error).mockClear()
    mockOnOpenChange.mockClear()
  })

  test('does not render when isOpen is false', () => {
    render(
      <BulkUpdateSacramentDialog
        isOpen={false}
        onOpenChange={mockOnOpenChange}
        classYearId={mockClassYearId}
        className={mockClassName}
        students={mockStudents}
      />,
    )
    expect(screen.queryByTestId('mock-dialog')).toBeNull()
  })

  test('renders dialog and active students list', () => {
    render(
      <BulkUpdateSacramentDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        classYearId={mockClassYearId}
        className={mockClassName}
        students={mockStudents}
      />,
    )

    expect(screen.getByTestId('mock-dialog')).toBeInTheDocument()
    expect(screen.getByText(/Giuse Nguyen Van A/)).toBeInTheDocument()
    expect(screen.getByText(/Maria Le Thi B/)).toBeInTheDocument()
    // Withdrawn student should not be listed
    expect(screen.queryByText(/Phero Tran Van C/)).toBeNull()
  })

  test('submits form with selected sacrament, date, and checked students', async () => {
    render(
      <BulkUpdateSacramentDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        classYearId={mockClassYearId}
        className={mockClassName}
        students={mockStudents}
      />,
    )

    // Select confirmation
    const select = screen.getByTestId('mock-select')
    fireEvent.change(select, { target: { value: 'confirmation' } })

    // Change date
    const dateInput = screen.getByLabelText(
      /classes\.sacraments\.bulkUpdate\.receivedDate/,
    )
    fireEvent.change(dateInput, { target: { value: '2026-05-15' } })

    // Check student 1
    const student1Checkbox = screen.getByText('Giuse Nguyen Van A')
    fireEvent.click(student1Checkbox)

    // Submit form
    const submitBtn = screen.getByText('classes.sacraments.bulkUpdate.submit')
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockBulkUpdate).toHaveBeenCalledWith({
        requesterId: 'cat123',
        classYearId: mockClassYearId,
        studentIds: ['s1'],
        sacramentType: 'confirmation',
        receivedDate: '2026-05-15',
      })
    })

    expect(toast.success).toHaveBeenCalledWith(
      'classes.sacraments.bulkUpdate.success',
    )
    expect(mockOnOpenChange).toHaveBeenCalledWith(false)
  })

  test('selectAll checkbox toggles all active students', async () => {
    render(
      <BulkUpdateSacramentDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        classYearId={mockClassYearId}
        className={mockClassName}
        students={mockStudents}
      />,
    )

    // Initially 0 selected
    expect(screen.getByText('0 / 2')).toBeInTheDocument()

    // Select a sacrament
    const select = screen.getByTestId('mock-select')
    fireEvent.change(select, { target: { value: 'first_communion' } })

    // Click select all
    const selectAllCheckbox = screen.getByText(
      'classes.sacraments.bulkUpdate.selectAll',
    )
    fireEvent.click(selectAllCheckbox)

    // Now 2 selected
    expect(screen.getByText('2 / 2')).toBeInTheDocument()

    // Submit form
    const submitBtn = screen.getByText('classes.sacraments.bulkUpdate.submit')
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockBulkUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          studentIds: ['s1', 's2'],
        }),
      )
    })
  })

  test('shows error toast when no sacrament is selected', async () => {
    render(
      <BulkUpdateSacramentDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        classYearId={mockClassYearId}
        className={mockClassName}
        students={mockStudents}
      />,
    )

    // Select a student but leave sacrament empty
    const student1Checkbox = screen.getByText('Giuse Nguyen Van A')
    fireEvent.click(student1Checkbox)

    const submitBtn = screen.getByText('classes.sacraments.bulkUpdate.submit')
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'classes.sacraments.bulkUpdate.selectSacramentRequired',
      )
    })
    expect(mockBulkUpdate).not.toHaveBeenCalled()
  })

  test('shows error toast when no student is selected', async () => {
    render(
      <BulkUpdateSacramentDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        classYearId={mockClassYearId}
        className={mockClassName}
        students={mockStudents}
      />,
    )

    // Select a sacrament but no students
    const select = screen.getByTestId('mock-select')
    fireEvent.change(select, { target: { value: 'baptism' } })

    // Submit without selecting any student
    const submitBtn = screen.getByText('classes.sacraments.bulkUpdate.submit')
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'classes.sacraments.bulkUpdate.noStudentsSelected',
      )
    })
    expect(mockBulkUpdate).not.toHaveBeenCalled()
  })

  test('shows error toast when mutation fails', async () => {
    mockBulkUpdate.mockRejectedValue(new Error('MUTATION_FAILED'))

    render(
      <BulkUpdateSacramentDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        classYearId={mockClassYearId}
        className={mockClassName}
        students={mockStudents}
      />,
    )

    // Select a sacrament
    const select = screen.getByTestId('mock-select')
    fireEvent.change(select, { target: { value: 'confirmation' } })

    // Check student 1
    const student1Checkbox = screen.getByText('Giuse Nguyen Van A')
    fireEvent.click(student1Checkbox)

    // Submit form
    const submitBtn = screen.getByText('classes.sacraments.bulkUpdate.submit')
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'classes.sacraments.bulkUpdate.error',
      )
    })
  })

  test('cancel button closes the dialog', () => {
    render(
      <BulkUpdateSacramentDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        classYearId={mockClassYearId}
        className={mockClassName}
        students={mockStudents}
      />,
    )

    const cancelBtn = screen.getByText('common.cancel')
    fireEvent.click(cancelBtn)

    expect(mockOnOpenChange).toHaveBeenCalledWith(false)
  })

  test('selectAll deselects all when all students are already selected', () => {
    render(
      <BulkUpdateSacramentDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        classYearId={mockClassYearId}
        className={mockClassName}
        students={mockStudents}
      />,
    )

    // Select all first
    const selectAllLabel = screen.getByText(
      'classes.sacraments.bulkUpdate.selectAll',
    )
    fireEvent.click(selectAllLabel)
    expect(screen.getByText('2 / 2')).toBeInTheDocument()

    // Click again to deselect all
    fireEvent.click(selectAllLabel)
    expect(screen.getByText('0 / 2')).toBeInTheDocument()
  })

  test('shows empty state when no active students', () => {
    const noActiveStudents = [
      {
        enrollment: {
          _id: 'sc3' as Id<'studentClasses'>,
          status: 'withdrawn' as const,
          enrolledDate: '2024-09-01',
        },
        student: {
          _id: 's3' as Id<'students'>,
          studentCode: 'HS003',
          fullName: 'Tran Van C',
          saintName: 'Phero',
          isActive: true,
          isDeleted: false,
          createdAt: 125,
        } as Doc<'students'>,
      },
    ]

    render(
      <BulkUpdateSacramentDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        classYearId={mockClassYearId}
        className={mockClassName}
        students={noActiveStudents}
      />,
    )

    expect(
      screen.getByText('classes.enrollment.noStudents'),
    ).toBeInTheDocument()
  })

  test('Ctrl+Enter triggers form submission', async () => {
    render(
      <BulkUpdateSacramentDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        classYearId={mockClassYearId}
        className={mockClassName}
        students={mockStudents}
      />,
    )

    // Select a sacrament
    const select = screen.getByTestId('mock-select')
    fireEvent.change(select, { target: { value: 'baptism' } })

    // Select a student
    const student1 = screen.getByText('Giuse Nguyen Van A')
    fireEvent.click(student1)

    // Fire Ctrl+Enter keyboard event
    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true })

    await waitFor(() => {
      expect(mockBulkUpdate).toHaveBeenCalled()
    })
  })
})
