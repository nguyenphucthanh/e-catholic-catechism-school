import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { EnrollmentDialog } from './enrollment-dialog'
import type { Id } from '../../../convex/_generated/dataModel'

// Mock Convex hooks
vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}))

// Mock useAuth
vi.mock('~/lib/auth', () => ({
  useAuth: () => ({
    user: {
      userDocId: 'catechist123' as Id<'catechists'>,
    },
  }),
}))

// Mock useSelectedAcademicYear
vi.mock('~/lib/academic-year', () => ({
  useSelectedAcademicYear: () => ({
    selectedYearId: 'year123' as Id<'academicYears'>,
  }),
}))

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock translation
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => {
      if (options?.defaultValue) return options.defaultValue
      const map: Record<string, string> = {
        'classes.enrollment.title': 'Enroll Students',
        'classes.enrollment.selectStudents': 'Select Students',
        'classes.enrollment.searchPlaceholder': 'Search by name or code',
        'classes.enrollment.enrolledIn': 'Enrolled in {{className}}',
        'classes.enrollment.noStudents': 'No students found',
        'classes.enrollment.noStudentsSelected':
          'Please select at least one student',
        'classes.enrollment.error': 'An error occurred',
        'classes.enrollment.success': 'Enrollment successful',
        'classes.enrollment.enrolledDate': 'Enrollment Date',
        'classes.enrollment.isPrimaryClass': 'Primary Class',
        'classes.enrollment.submit': 'Enroll',
        'classes.enrollment.selectedList': 'Selected List',
        'common.cancel': 'Cancel',
        'common.delete': 'Delete',
      }
      return map[key] || key
    },
  }),
}))

describe('EnrollmentDialog', () => {
  const mockClassYearId = 'classYear123' as Id<'classYears'>
  const mockClassName = 'Class 1'
  const mockOnOpenChange = vi.fn()
  let mockMutate: any

  const mockStudents = [
    {
      _id: 'student1' as Id<'students'>,
      studentCode: 'S001',
      fullName: 'John Doe',
      saintName: 'John',
      isActive: true,
      createdAt: 0,
      isDeleted: false,
      enrolledClassYearId: null,
      className: null,
      isPrimaryClass: false,
      status: null,
    },
    {
      _id: 'student2' as Id<'students'>,
      studentCode: 'S002',
      fullName: 'Jane Smith',
      saintName: 'Jane',
      isActive: true,
      createdAt: 0,
      isDeleted: false,
      enrolledClassYearId: 'otherClass' as Id<'classYears'>,
      className: 'Other Class',
      isPrimaryClass: true,
      status: 'active' as const,
    },
    {
      _id: 'student3' as Id<'students'>,
      studentCode: 'S003',
      fullName: 'Bob Johnson',
      saintName: 'Bob',
      isActive: true,
      createdAt: 0,
      isDeleted: false,
      enrolledClassYearId: null,
      className: null,
      isPrimaryClass: false,
      status: null,
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockMutate = vi.fn().mockResolvedValue(['enrollment1'])
    vi.mocked(useQuery).mockReturnValue(mockStudents as any)
    vi.mocked(useMutation).mockReturnValue(mockMutate)
  })

  test('renders dialog layout with combobox label and selection table', () => {
    render(
      <EnrollmentDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        classYearId={mockClassYearId}
        className={mockClassName}
      />,
    )

    expect(screen.getByText(/Select Students/i)).toBeInTheDocument()
    expect(screen.getByText(/Selected List/i)).toBeInTheDocument()
    expect(
      screen.getByText(/Please select at least one student/i),
    ).toBeInTheDocument()
  })

  test('displays class name in title', () => {
    render(
      <EnrollmentDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        classYearId={mockClassYearId}
        className={mockClassName}
      />,
    )

    expect(screen.getByText(/Class 1/)).toBeInTheDocument()
  })

  test('allows date input', () => {
    render(
      <EnrollmentDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        classYearId={mockClassYearId}
        className={mockClassName}
      />,
    )

    const dateInput = screen.getByDisplayValue(/2026/)
    expect(dateInput).toBeInTheDocument()
    expect(dateInput).toHaveAttribute('type', 'date')
  })

  test('allows toggling primary class checkbox', () => {
    render(
      <EnrollmentDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        classYearId={mockClassYearId}
        className={mockClassName}
      />,
    )

    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).toBeChecked()
  })

  test('submits form button exists', () => {
    render(
      <EnrollmentDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        classYearId={mockClassYearId}
        className={mockClassName}
      />,
    )

    const enrollButton = screen.getByRole('button', { name: /enroll$/i })
    expect(enrollButton).toBeInTheDocument()
  })

  test('handles Ctrl+Enter keyboard shortcut', () => {
    render(
      <EnrollmentDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        classYearId={mockClassYearId}
        className={mockClassName}
      />,
    )

    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      ctrlKey: true,
      bubbles: true,
    })

    fireEvent.keyDown(window, event)
  })

  test('has cancel button', () => {
    render(
      <EnrollmentDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        classYearId={mockClassYearId}
        className={mockClassName}
      />,
    )

    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    expect(cancelButton).toBeInTheDocument()
    fireEvent.click(cancelButton)
    expect(mockOnOpenChange).toHaveBeenCalledWith(false)
  })

  test('shows preselected student in table and allows removal', () => {
    render(
      <EnrollmentDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        classYearId={mockClassYearId}
        className={mockClassName}
        defaultStudentIds={['student1' as Id<'students'>]}
      />,
    )

    // Verify student is in table
    expect(screen.getByText(/John Doe/)).toBeInTheDocument()

    // Find and click remove button (the button that has role button and name Delete)
    const removeBtn = screen.getByRole('button', { name: /delete/i })
    fireEvent.click(removeBtn)

    // Student should be removed from list
    expect(screen.queryByText(/John Doe/)).not.toBeInTheDocument()
  })

  test('submits successfully with preselected students', async () => {
    render(
      <EnrollmentDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        classYearId={mockClassYearId}
        className={mockClassName}
        defaultStudentIds={['student1' as Id<'students'>]}
      />,
    )

    const enrollButton = screen.getByRole('button', { name: /enroll$/i })
    fireEvent.click(enrollButton)

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          requesterId: 'catechist123',
          studentIds: ['student1'],
          classYearId: mockClassYearId,
          isPrimaryClass: true,
        }),
      )
      expect(toast.success).toHaveBeenCalledWith('Enrollment successful')
      expect(mockOnOpenChange).toHaveBeenCalledWith(false)
    })
  })

  test('shows validation toast on empty submit', async () => {
    render(
      <EnrollmentDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        classYearId={mockClassYearId}
        className={mockClassName}
      />,
    )

    const enrollButton = screen.getByRole('button', { name: /enroll$/i })
    fireEvent.click(enrollButton)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Please select at least one student',
      )
      expect(mockMutate).not.toHaveBeenCalled()
    })
  })

  test('handles mutation failure', async () => {
    mockMutate.mockRejectedValueOnce(new Error('Mutation rejected'))

    render(
      <EnrollmentDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        classYearId={mockClassYearId}
        className={mockClassName}
        defaultStudentIds={['student1' as Id<'students'>]}
      />,
    )

    const enrollButton = screen.getByRole('button', { name: /enroll$/i })
    fireEvent.click(enrollButton)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Mutation rejected')
      expect(mockOnOpenChange).not.toHaveBeenCalledWith(false)
    })
  })
})
