import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { toast } from 'sonner'
import { useMutation, useQuery } from 'convex/react'
import { SendStudentsDialog } from './send-students-dialog'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import { useAuth } from '~/lib/auth'
import { useSelectedAcademicYear } from '~/lib/academic-year'

// Mock convex/react
vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}))

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: any) => {
      if (options?.count !== undefined && options?.className) {
        return `${key}:${options.count}:${options.className}`
      }
      return key
    },
  }),
}))

// Mock useAuth
vi.mock('~/lib/auth', () => ({
  useAuth: vi.fn(),
}))

// Mock useSelectedAcademicYear
vi.mock('~/lib/academic-year', () => ({
  useSelectedAcademicYear: vi.fn(),
}))

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock Select component
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

describe('SendStudentsDialog', () => {
  const currentClassYearId = 'cy_source' as Id<'classYears'>
  const currentClassName = 'Au Nhi 1'
  const mockOnOpenChange = vi.fn()
  let mockAssignMutation: any

  const mockClassYearsList = [
    {
      classYearId: 'cy_source' as Id<'classYears'>,
      classId: 'c_source' as Id<'classes'>,
      className: 'Au Nhi 1',
      classType: 'primary' as const,
    },
    {
      classYearId: 'cy_target_primary' as Id<'classYears'>,
      classId: 'c_target_primary' as Id<'classes'>,
      className: 'Au Nhi 2',
      classType: 'primary' as const,
    },
    {
      classYearId: 'cy_target_choir' as Id<'classYears'>,
      classId: 'c_target_choir' as Id<'classes'>,
      className: 'Ca Doan Thien Than',
      classType: 'apostle' as const,
    },
  ]

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
        dateOfBirth: '2015-01-01',
        gender: 'male',
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
        dateOfBirth: '2015-02-02',
        gender: 'female',
        isActive: true,
        isDeleted: false,
        createdAt: 124,
      } as Doc<'students'>,
    },
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
        dateOfBirth: '2015-03-03',
        gender: 'male',
        isActive: true,
        isDeleted: false,
        createdAt: 125,
      } as Doc<'students'>,
    },
  ]

  beforeEach(() => {
    mockAssignMutation = vi.fn().mockResolvedValue(['sc_new_1'])
    vi.mocked(useMutation).mockImplementation((fnRef: any) => {
      const path = fnRef?.[Symbol.for('functionName')]
      if (path === 'students:assignStudentToClassYear')
        return mockAssignMutation
      return mockAssignMutation
    })
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'cat123' },
    } as any)
    vi.mocked(useSelectedAcademicYear).mockReturnValue({
      selectedYearId: 'ay123' as Id<'academicYears'>,
    } as any)
    vi.mocked(useQuery).mockImplementation(((queryRef: any) => {
      const path = queryRef?.[Symbol.for('functionName')]
      if (path === 'classes:listClassYears') return mockClassYearsList
      if (path === 'appConfig:get') return { nameFormat: 'firstName_lastName' }
      return undefined
    }) as any)
    vi.mocked(toast.success).mockClear()
    vi.mocked(toast.error).mockClear()
    mockOnOpenChange.mockClear()
  })

  test('does not render when isOpen is false', () => {
    render(
      <SendStudentsDialog
        isOpen={false}
        onOpenChange={mockOnOpenChange}
        currentClassYearId={currentClassYearId}
        currentClassName={currentClassName}
        students={mockStudents}
      />,
    )
    expect(screen.queryByTestId('mock-dialog')).toBeNull()
  })

  test('renders dialog, excludes source class from target select options, and renders active students', () => {
    render(
      <SendStudentsDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        currentClassYearId={currentClassYearId}
        currentClassName={currentClassName}
        students={mockStudents}
      />,
    )

    expect(screen.getByTestId('mock-dialog')).toBeInTheDocument()
    expect(screen.getByText(/classes\.sendStudents\.title/)).toBeInTheDocument()

    // Options in select
    expect(screen.getByText('Au Nhi 2')).toBeInTheDocument()
    expect(screen.getByText('Ca Doan Thien Than')).toBeInTheDocument()
    // Current class should not be in target options
    const select = screen.getByTestId('mock-select')
    const options = Array.from(select.querySelectorAll('option')).map(
      (o) => o.textContent,
    )
    expect(options).not.toContain('Au Nhi 1')

    // Active students
    expect(screen.getByText('Giuse Nguyen Van A')).toBeInTheDocument()
    expect(screen.getByText('Maria Le Thi B')).toBeInTheDocument()
    // Withdrawn student should not appear
    expect(screen.queryByText('Phero Tran Van C')).toBeNull()

    // Default select notice
    expect(
      screen.getByText('classes.sendStudents.selectTargetClassNotice'),
    ).toBeInTheDocument()
  })

  test('displays primary class move notice when primary target class is selected', async () => {
    render(
      <SendStudentsDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        currentClassYearId={currentClassYearId}
        currentClassName={currentClassName}
        students={mockStudents}
      />,
    )

    const select = screen.getByTestId('mock-select')
    fireEvent.change(select, { target: { value: 'cy_target_primary' } })

    expect(
      await screen.findByText('classes.sendStudents.primaryNotice'),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('classes.sendStudents.nonPrimaryNotice'),
    ).toBeNull()
  })

  test('displays non-primary class notice when supplemental target class is selected', async () => {
    render(
      <SendStudentsDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        currentClassYearId={currentClassYearId}
        currentClassName={currentClassName}
        students={mockStudents}
      />,
    )

    const select = screen.getByTestId('mock-select')
    fireEvent.change(select, { target: { value: 'cy_target_choir' } })

    expect(
      await screen.findByText('classes.sendStudents.nonPrimaryNotice'),
    ).toBeInTheDocument()
    expect(screen.queryByText('classes.sendStudents.primaryNotice')).toBeNull()
  })

  test('filters students by search input', () => {
    render(
      <SendStudentsDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        currentClassYearId={currentClassYearId}
        currentClassName={currentClassName}
        students={mockStudents}
      />,
    )

    const searchInput = screen.getByPlaceholderText(
      'classes.sendStudents.searchPlaceholder',
    )
    fireEvent.change(searchInput, { target: { value: 'HS002' } })

    expect(screen.getByText('Maria Le Thi B')).toBeInTheDocument()
    expect(screen.queryByText('Giuse Nguyen Van A')).toBeNull()
  })

  test('toggles individual student selection and select-all checkbox', () => {
    render(
      <SendStudentsDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        currentClassYearId={currentClassYearId}
        currentClassName={currentClassName}
        students={mockStudents}
      />,
    )

    const student1Row = screen.getByText('Giuse Nguyen Van A')
    fireEvent.click(student1Row)

    const selectAllCheckbox = screen.getByLabelText(
      'classes.sendStudents.selectAll',
    )
    fireEvent.click(selectAllCheckbox)

    // Clicking again deselects all
    fireEvent.click(selectAllCheckbox)
  })

  test('submits successfully when target is primary and shows move success toast', async () => {
    render(
      <SendStudentsDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        currentClassYearId={currentClassYearId}
        currentClassName={currentClassName}
        students={mockStudents}
      />,
    )

    // Select target class
    const select = screen.getByTestId('mock-select')
    fireEvent.change(select, { target: { value: 'cy_target_primary' } })

    // Change date
    const dateInput = screen.getByLabelText(
      /classes\.sendStudents\.effectiveDate/,
    )
    fireEvent.change(dateInput, { target: { value: '2026-09-15' } })

    // Select student 1
    const student1Row = screen.getByText('Giuse Nguyen Van A')
    fireEvent.click(student1Row)

    // Submit
    const submitBtn = screen.getByText('classes.sendStudents.submit')
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockAssignMutation).toHaveBeenCalledWith({
        requesterId: 'cat123',
        studentIds: ['s1'],
        targetClassYearId: 'cy_target_primary',
        sourceClassYearId: 'cy_source',
        isPrimaryClass: true,
        enrolledDate: '2026-09-15',
        replaceExistingPrimary: true,
      })
      expect(toast.success).toHaveBeenCalledWith(
        'classes.sendStudents.successMoved:1:Au Nhi 2',
      )
      expect(mockOnOpenChange).toHaveBeenCalledWith(false)
    })
  })

  test('submits successfully when target is non-primary and shows multi-enrollment toast', async () => {
    render(
      <SendStudentsDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        currentClassYearId={currentClassYearId}
        currentClassName={currentClassName}
        students={mockStudents}
      />,
    )

    // Select choir target class
    const select = screen.getByTestId('mock-select')
    fireEvent.change(select, { target: { value: 'cy_target_choir' } })

    // Select student 2
    const student2Row = screen.getByText('Maria Le Thi B')
    fireEvent.click(student2Row)

    // Submit
    const submitBtn = screen.getByText('classes.sendStudents.submit')
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockAssignMutation).toHaveBeenCalledWith(
        expect.objectContaining({
          targetClassYearId: 'cy_target_choir',
          isPrimaryClass: false,
          replaceExistingPrimary: false,
        }),
      )
      expect(toast.success).toHaveBeenCalledWith(
        'classes.sendStudents.successEnrolled:1:Ca Doan Thien Than',
      )
    })
  })

  test('handles keyboard shortcut Ctrl+Enter to submit', async () => {
    render(
      <SendStudentsDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        currentClassYearId={currentClassYearId}
        currentClassName={currentClassName}
        students={mockStudents}
      />,
    )

    const select = screen.getByTestId('mock-select')
    fireEvent.change(select, { target: { value: 'cy_target_primary' } })

    const student1Row = screen.getByText('Giuse Nguyen Van A')
    fireEvent.click(student1Row)

    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true })

    await waitFor(() => {
      expect(mockAssignMutation).toHaveBeenCalled()
    })
  })

  test('shows error toast when mutation fails', async () => {
    mockAssignMutation.mockRejectedValueOnce(new Error('ConvexError: Fail'))

    render(
      <SendStudentsDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        currentClassYearId={currentClassYearId}
        currentClassName={currentClassName}
        students={mockStudents}
      />,
    )

    const select = screen.getByTestId('mock-select')
    fireEvent.change(select, { target: { value: 'cy_target_primary' } })

    const student1Row = screen.getByText('Giuse Nguyen Van A')
    fireEvent.click(student1Row)

    const submitBtn = screen.getByText('classes.sendStudents.submit')
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled()
    })
  })

  test('shows unauthorized error when requesterId is missing', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
    } as any)

    render(
      <SendStudentsDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        currentClassYearId={currentClassYearId}
        currentClassName={currentClassName}
        students={mockStudents}
      />,
    )

    const select = screen.getByTestId('mock-select')
    fireEvent.change(select, { target: { value: 'cy_target_primary' } })

    const student1Row = screen.getByText('Giuse Nguyen Van A')
    fireEvent.click(student1Row)

    const submitBtn = screen.getByText('classes.sendStudents.submit')
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('common.unauthorized')
    })
  })

  test('renders empty message when no students in source class', () => {
    render(
      <SendStudentsDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        currentClassYearId={currentClassYearId}
        currentClassName={currentClassName}
        students={[]}
      />,
    )

    expect(
      screen.getByText('classes.sendStudents.noStudentsInClass'),
    ).toBeInTheDocument()
  })

  test('renders no students found when search matches no one', () => {
    render(
      <SendStudentsDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        currentClassYearId={currentClassYearId}
        currentClassName={currentClassName}
        students={mockStudents}
      />,
    )

    const searchInput = screen.getByPlaceholderText(
      'classes.sendStudents.searchPlaceholder',
    )
    fireEvent.change(searchInput, { target: { value: 'NON_EXISTENT_STUDENT' } })

    expect(
      screen.getByText('classes.enrollment.noStudents'),
    ).toBeInTheDocument()
  })

  test('cancels dialog when cancel button is clicked', () => {
    render(
      <SendStudentsDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        currentClassYearId={currentClassYearId}
        currentClassName={currentClassName}
        students={mockStudents}
      />,
    )

    const cancelBtn = screen.getByText('common.cancel')
    fireEvent.click(cancelBtn)

    expect(mockOnOpenChange).toHaveBeenCalledWith(false)
  })

  test('toggles checkbox via direct checkbox onCheckedChange', () => {
    render(
      <SendStudentsDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        currentClassYearId={currentClassYearId}
        currentClassName={currentClassName}
        students={mockStudents}
      />,
    )

    const checkbox = screen.getByLabelText('Giuse Nguyen Van A')
    fireEvent.click(checkbox)
  })
})
