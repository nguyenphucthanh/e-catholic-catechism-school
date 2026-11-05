import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { useConvex, useMutation } from 'convex/react'
import { toast } from 'sonner'
import { EnrollmentDialog } from './enrollment-dialog'
import type { Id } from '../../../convex/_generated/dataModel'
import { useOneShotQuery } from '~/hooks/use-one-shot-query'

// Mock Convex hooks
vi.mock('convex/react', () => ({
  useMutation: vi.fn(),
  useConvex: vi.fn(),
}))

// Mock one-shot query hook
vi.mock('~/hooks/use-one-shot-query', () => ({
  useOneShotQuery: vi.fn(),
}))

// Mock useAuth
vi.mock('~/lib/auth', () => ({
  useAuth: () => ({
    user: {
      userDocId: 'catechist123' as Id<'catechists'>,
    },
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
    t: (key: string, options?: Record<string, string>) => {
      if (options?.defaultValue) return options.defaultValue
      const map: Record<string, string> = {
        'classes.enrollment.title': 'Enroll Students',
        'classes.enrollment.selectStudents': 'Select Students',
        'classes.enrollment.searchPlaceholder': 'Search by name or code',
        'classes.enrollment.alreadyEnrolled.title': 'Already enrolled',
        'classes.enrollment.alreadyEnrolled.description':
          'Enrolled in {{className}}: {{student}}',
        'classes.enrollment.alreadyEnrolled.ok': 'OK',
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
      return (map[key] || key).replace(
        /\{\{(\w+)\}\}/g,
        (_, k: string) => options?.[k] ?? '',
      )
    },
  }),
}))

describe('EnrollmentDialog', () => {
  const mockClassYearId = 'classYear123' as Id<'classYears'>
  const mockAcademicYearId = 'year123' as Id<'academicYears'>
  let mockMutate: any
  let mockQuery: any
  const mockOnOpenChange = vi.fn()

  const mockStudents = [
    {
      _id: 'student1' as Id<'students'>,
      studentCode: 'S001',
      fullName: 'John Doe',
      saintName: 'John',
    },
    {
      _id: 'student2' as Id<'students'>,
      studentCode: 'S002',
      fullName: 'Jane Smith',
      saintName: 'Jane',
    },
  ]

  const renderDialog = (
    props: { isOpen?: boolean; isPrimary?: boolean } = {},
  ) =>
    render(
      <EnrollmentDialog
        isOpen={props.isOpen ?? true}
        onOpenChange={mockOnOpenChange}
        classYearId={mockClassYearId}
        academicYearId={mockAcademicYearId}
        className="Class 1"
        isPrimary={props.isPrimary}
      />,
    )

  const searchArgs = () =>
    vi.mocked(useOneShotQuery).mock.calls.map((c) => c[1])

  // Type a term, pick the named result.
  const pick = async (term: string, name: RegExp) => {
    const input = screen.getByPlaceholderText(/search by name or code/i)
    fireEvent.change(input, { target: { value: term } })
    fireEvent.mouseDown(input)
    const option = await screen.findByText(name)
    fireEvent.pointerDown(option)
    fireEvent.click(option)
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockMutate = vi.fn().mockResolvedValue(['enrollment1'])
    mockQuery = vi.fn().mockResolvedValue(null)
    vi.mocked(useMutation).mockReturnValue(mockMutate)
    vi.mocked(useConvex).mockReturnValue({ query: mockQuery } as any)
    vi.mocked(useOneShotQuery).mockReturnValue({
      data: mockStudents,
      isRefreshing: false,
      refresh: vi.fn(),
    })
  })

  test('renders title, empty selection and date input', () => {
    renderDialog()
    expect(screen.getByText(/Enroll Students - Class 1/)).toBeInTheDocument()
    expect(
      screen.getByText(/Please select at least one student/i),
    ).toBeInTheDocument()
    expect(screen.getByDisplayValue(/\d{4}-\d{2}-\d{2}/)).toHaveAttribute(
      'type',
      'date',
    )
  })

  describe('search', () => {
    test('skips the query when the dialog is closed', () => {
      renderDialog({ isOpen: false })
      expect(searchArgs().every((a) => a === 'skip')).toBe(true)
    })

    test('skips the query when fewer than 2 chars are typed', async () => {
      renderDialog()
      fireEvent.change(screen.getByPlaceholderText(/search by name/i), {
        target: { value: ' j ' },
      })
      await new Promise((r) => setTimeout(r, 400))
      expect(searchArgs().every((a) => a === 'skip')).toBe(true)
    })

    test('queries with the trimmed term only after the 300ms debounce', async () => {
      renderDialog()
      fireEvent.change(screen.getByPlaceholderText(/search by name/i), {
        target: { value: ' jo ' },
      })
      expect(searchArgs()).not.toContainEqual({ name: 'jo' })
      await waitFor(() => expect(searchArgs()).toContainEqual({ name: 'jo' }))
    })
  })

  describe('picking', () => {
    test('un-enrolled student is added straight to the table', async () => {
      renderDialog()
      await pick('jo', /John Doe/)

      await waitFor(() =>
        expect(mockQuery).toHaveBeenCalledWith(expect.anything(), {
          studentId: 'student1',
          academicYearId: mockAcademicYearId,
        }),
      )
      expect(await screen.findByText('S001')).toBeInTheDocument()
      expect(screen.queryByText('Already enrolled')).not.toBeInTheDocument()
    })

    test('primary existing enrollment blocks: dialog shows, student not added', async () => {
      mockQuery.mockResolvedValue({
        className: 'Other Class',
        isPrimaryClass: true,
      })
      renderDialog()
      await pick('ja', /Jane Smith/)

      expect(await screen.findByText('Already enrolled')).toBeInTheDocument()
      expect(
        screen.getByText(/Enrolled in Other Class: Jane Jane Smith/),
      ).toBeInTheDocument()
      expect(screen.queryByText('S002')).not.toBeInTheDocument()
      const alert = screen.getByRole('alertdialog')
      expect(
        within(alert).queryByRole('button', { name: 'Cancel' }),
      ).not.toBeInTheDocument()
    })

    test('Escape dismisses the blocked dialog without adding the student', async () => {
      mockQuery.mockResolvedValue({
        className: 'Other Class',
        isPrimaryClass: true,
      })
      renderDialog()
      await pick('ja', /Jane Smith/)
      await screen.findByText('Already enrolled')

      fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' })

      await waitFor(() =>
        expect(screen.queryByText('Already enrolled')).not.toBeInTheDocument(),
      )
      expect(screen.queryByText('S002')).not.toBeInTheDocument()
    })

    test('OK dismisses the blocked dialog without adding the student', async () => {
      mockQuery.mockResolvedValue({
        className: 'Other Class',
        isPrimaryClass: true,
      })
      renderDialog()
      await pick('ja', /Jane Smith/)
      await screen.findByText('Already enrolled')

      const alert = screen.getByRole('alertdialog')
      fireEvent.click(within(alert).getByRole('button', { name: 'OK' }))

      await waitFor(() =>
        expect(screen.queryByText('Already enrolled')).not.toBeInTheDocument(),
      )
      expect(screen.queryByText('S002')).not.toBeInTheDocument()
    })

    test('non-primary existing enrollment adds directly with its class name', async () => {
      mockQuery.mockResolvedValue({
        className: 'Other Class',
        isPrimaryClass: false,
      })
      renderDialog()
      await pick('ja', /Jane Smith/)

      expect(await screen.findByText('S002')).toBeInTheDocument()
      expect(screen.getByText('Other Class')).toBeInTheDocument()
      expect(screen.queryByText('Already enrolled')).not.toBeInTheDocument()
    })

    test('isPrimary=false adds directly even if a primary enrollment exists', async () => {
      mockQuery.mockResolvedValue({
        className: 'Other Class',
        isPrimaryClass: true,
      })
      renderDialog({ isPrimary: false })
      await pick('ja', /Jane Smith/)

      expect(await screen.findByText('S002')).toBeInTheDocument()
      expect(screen.getByText('Other Class')).toBeInTheDocument()
      expect(screen.queryByText('Already enrolled')).not.toBeInTheDocument()
    })

    test('shows toast.error when the enrollment lookup rejects', async () => {
      mockQuery.mockRejectedValue(new Error('boom'))
      renderDialog()
      await pick('jo', /John Doe/)

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith('An error occurred'),
      )
      expect(screen.queryByText('S001')).not.toBeInTheDocument()
    })
  })

  test('removes a selected student', async () => {
    renderDialog()
    await pick('jo', /John Doe/)
    await screen.findByText('S001')

    fireEvent.click(screen.getByRole('button', { name: /delete/i }))

    await waitFor(() =>
      expect(screen.queryByText('S001')).not.toBeInTheDocument(),
    )
  })

  describe('submit', () => {
    test('submits selected students with isPrimary default true', async () => {
      renderDialog()
      await pick('jo', /John Doe/)
      await screen.findByText('S001')

      fireEvent.click(screen.getByRole('button', { name: /enroll$/i }))

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith(
          expect.objectContaining({
            studentIds: ['student1'],
            classYearId: mockClassYearId,
            isPrimaryClass: true,
          }),
        )
        expect(toast.success).toHaveBeenCalledWith('Enrollment successful')
        expect(mockOnOpenChange).toHaveBeenCalledWith(false)
      })
    })

    test('passes isPrimary=false through and supports Ctrl+Enter', async () => {
      renderDialog({ isPrimary: false })
      await pick('jo', /John Doe/)
      await screen.findByText('S001')

      fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true })

      await waitFor(() =>
        expect(mockMutate).toHaveBeenCalledWith(
          expect.objectContaining({ isPrimaryClass: false }),
        ),
      )
    })

    test('shows validation error and skips mutation with no students', async () => {
      renderDialog()
      fireEvent.click(screen.getByRole('button', { name: /enroll$/i }))
      await waitFor(() =>
        expect(
          screen.getByText('Please select at least one student'),
        ).toBeInTheDocument(),
      )
      expect(mockMutate).not.toHaveBeenCalled()
    })

    test('toast.error and stays open when the mutation fails', async () => {
      mockMutate.mockRejectedValueOnce(new Error('rejected'))
      renderDialog()
      await pick('jo', /John Doe/)
      await screen.findByText('S001')

      fireEvent.click(screen.getByRole('button', { name: /enroll$/i }))

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith('An error occurred'),
      )
      expect(mockOnOpenChange).not.toHaveBeenCalledWith(false)
    })
  })

  test('Cancel button closes the dialog', () => {
    renderDialog()
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(mockOnOpenChange).toHaveBeenCalledWith(false)
  })

  test('ignores keyboard shortcuts when closed', () => {
    renderDialog({ isOpen: false })
    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true })
    expect(mockMutate).not.toHaveBeenCalled()
  })
})
