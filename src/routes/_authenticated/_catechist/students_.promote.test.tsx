import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { ENROLLMENT_ERRORS } from '../../../../convex/lib/errors'
import { Route } from './students_.promote'
import { useAuth } from '~/lib/auth'

beforeEach(() => {
  vi.mocked(toast.success).mockClear()
  vi.mocked(toast.error).mockClear()
})

const mockUser = {
  _id: 'user123',
  userDocId: 'catechist123',
  memberId: 'GLV0001',
  fullName: 'Test Catechist',
  role: 'user',
} as any

const sourceYearId = 'year2024'
const activeYearId = 'year2025'

const sampleAcademicYears = [
  { _id: sourceYearId, name: '2024-2025', isActive: false },
]

const sampleActiveYear = {
  _id: activeYearId,
  name: '2025-2026',
  isActive: true,
}

const sampleSourceClasses = [
  { classYearId: 'cy-src-1', classId: 'c1', className: 'Lop Chien 1' },
]

const sampleTargetClasses = [
  { classYearId: 'cy-tgt-1', classId: 'c2', className: 'Lop Chien 2' },
]

const sampleRoster = [
  {
    studentClassId: 'sc1',
    studentId: 's1',
    studentCode: 'HS001',
    fullName: 'Nguyen Van A',
    saintName: 'Peter',
    gender: 'male' as const,
    alreadyEnrolledInTargetYear: false,
  },
  {
    studentClassId: 'sc2',
    studentId: 's2',
    studentCode: 'HS002',
    fullName: 'Tran Thi B',
    saintName: 'Maria',
    gender: 'female' as const,
    alreadyEnrolledInTargetYear: true,
  },
]

function setupQueries(
  overrides: {
    academicYears?: Array<any>
    activeYear?: any
    sourceClasses?: Array<any>
    targetClasses?: Array<any>
    roster?: Array<any> | undefined
  } = {},
) {
  const {
    academicYears = sampleAcademicYears,
    activeYear = sampleActiveYear,
    sourceClasses = sampleSourceClasses,
    targetClasses = sampleTargetClasses,
    roster,
  } = overrides

  vi.mocked(useQuery).mockImplementation((queryRef: any, args?: any) => {
    const path = queryRef?.[Symbol.for('functionName')]
    if (path === 'academicYears:list') return academicYears
    if (path === 'academicYears:getActive') return activeYear
    if (path === 'classes:listClassYears') {
      if (args === 'skip') return undefined
      if (args.academicYearId === sourceYearId) return sourceClasses
      if (activeYear && args.academicYearId === activeYear._id) {
        return targetClasses
      }
      return undefined
    }
    if (path === 'students:getEligibleForTransfer') {
      if (args === 'skip') return undefined
      return roster
    }
    return undefined
  })
}

function renderPromotePage() {
  const PromoteComponent = (Route as any).options.component
  return render(<PromoteComponent />)
}

function selectOption(placeholderKey: string, optionName: string | RegExp) {
  // BaseUI's Select trigger has role="combobox" but per the ARIA accname
  // spec a combobox's accessible name is NOT computed from its content, so
  // it can't be queried by getByRole(..., { name }). Find the trigger via
  // its still-visible placeholder text instead (only valid before a value
  // has been picked, which is how this helper is always used).
  const trigger = screen.getByText(placeholderKey).closest('button')
  if (!trigger) throw new Error(`No trigger button found for ${placeholderKey}`)
  fireEvent.click(trigger)
  const option = screen.getByRole('option', { name: optionName })
  fireEvent.pointerDown(option)
  fireEvent.click(option)
}

function pickSourceClass() {
  selectOption('students.promote.sourceYearPlaceholder', '2024-2025')
  selectOption('students.promote.sourceClassPlaceholder', 'Lop Chien 1')
}

function pickTargetClass() {
  selectOption('students.promote.targetClassPlaceholder', 'Lop Chien 2')
}

function rowCheckbox(studentCode: string) {
  const row = screen.getByText(studentCode).closest('tr') as HTMLElement
  return within(row).getByRole('checkbox', { name: 'Select row' })
}

// DataTable's built-in "N of M row(s) selected." footer is plain text (not
// i18n-gated), unlike this page's own `{{count}} students selected` label
// which the globally mocked t() renders as the raw key regardless of the
// actual count. Use the DataTable footer to assert the selection count
// actually changed.
function dataTableSelectionSummary() {
  return Array.from(document.querySelectorAll('.flex-1')).find((el) =>
    el.textContent.includes('row(s) selected'),
  )?.textContent
}

describe('PromoteStudentsPage component', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockUser,
    })
  })

  test('renders source/target selects and the select-source-class prompt initially', () => {
    setupQueries()
    renderPromotePage()

    expect(
      screen.getByText('students.promote.sourceYearPlaceholder'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('students.promote.sourceClassPlaceholder'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('students.promote.targetClassPlaceholder'),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('combobox')).toHaveLength(3)
    expect(
      screen.getByText('students.promote.selectSourceClassPrompt'),
    ).toBeInTheDocument()
  })

  test('renders roster rows once a source class is picked', () => {
    setupQueries({ roster: sampleRoster })
    renderPromotePage()

    pickSourceClass()

    expect(screen.getByText('HS001')).toBeInTheDocument()
    expect(screen.getByText('Nguyen Van A')).toBeInTheDocument()
    expect(screen.getByText('HS002')).toBeInTheDocument()
    expect(screen.getByText('Tran Thi B')).toBeInTheDocument()
    expect(
      screen.queryByText('students.promote.selectSourceClassPrompt'),
    ).not.toBeInTheDocument()
  })

  test('renders a disabled checkbox for a student already enrolled in the target year, and clicking it does not select it', () => {
    setupQueries({ roster: sampleRoster })
    renderPromotePage()
    pickSourceClass()

    const alreadyEnrolledCheckbox = rowCheckbox('HS002')
    expect(alreadyEnrolledCheckbox).toHaveAttribute('aria-disabled', 'true')

    fireEvent.click(alreadyEnrolledCheckbox)

    expect(
      screen.getByText('students.promote.alreadyEnrolledBadge'),
    ).toBeInTheDocument()
    expect(dataTableSelectionSummary()).toBe('0 of 2 row(s) selected.')
    expect(
      screen.getByRole('button', { name: 'students.promote.submit' }),
    ).toBeDisabled()
  })

  test('selecting an eligible checkbox updates the selected count and enables submit once a target class is chosen', () => {
    setupQueries({ roster: sampleRoster })
    renderPromotePage()
    pickSourceClass()

    const submitButton = screen.getByRole('button', {
      name: 'students.promote.submit',
    })
    expect(submitButton).toBeDisabled()

    expect(dataTableSelectionSummary()).toBe('0 of 2 row(s) selected.')

    fireEvent.click(rowCheckbox('HS001'))

    expect(dataTableSelectionSummary()).toBe('1 of 2 row(s) selected.')
    // Still disabled: no target class chosen yet.
    expect(submitButton).toBeDisabled()

    pickTargetClass()

    expect(submitButton).not.toBeDisabled()
  })

  test('submits enrollStudents with only the selected, eligible student ids and shows a success toast, resetting selection', async () => {
    const enrollMock = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useMutation).mockReturnValue(enrollMock as any)
    setupQueries({ roster: sampleRoster })
    renderPromotePage()
    pickSourceClass()

    // Select all (both the eligible and already-enrolled rows) via header
    // checkbox to prove only the eligible student id is submitted.
    const headerCheckbox = screen.getByRole('checkbox', { name: 'Select all' })
    fireEvent.click(headerCheckbox)

    pickTargetClass()

    fireEvent.click(
      screen.getByRole('button', { name: 'students.promote.submit' }),
    )

    await vi.waitFor(() => {
      expect(enrollMock).toHaveBeenCalledWith({
        requesterId: 'catechist123',
        studentIds: ['s1'],
        classYearId: 'cy-tgt-1',
        isPrimaryClass: true,
        enrolledDate: expect.any(String),
      })
    })

    expect(toast.success).toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()

    await vi.waitFor(() => {
      expect(
        screen.getByText('students.promote.selectSourceClassPrompt'),
      ).toBeInTheDocument()
    })
  })

  test('shows the conflict-specific toast when enrollStudents rejects with PRIMARY_CLASS_CONFLICT', async () => {
    const enrollMock = vi
      .fn()
      .mockRejectedValue(new Error(ENROLLMENT_ERRORS.PRIMARY_CLASS_CONFLICT))
    vi.mocked(useMutation).mockReturnValue(enrollMock as any)
    setupQueries({ roster: sampleRoster })
    renderPromotePage()
    pickSourceClass()
    fireEvent.click(rowCheckbox('HS001'))
    pickTargetClass()

    fireEvent.click(
      screen.getByRole('button', { name: 'students.promote.submit' }),
    )

    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('students.promote.conflictError')
    })
    expect(toast.success).not.toHaveBeenCalled()
  })

  test('shows the generic error toast for a non-conflict rejection', async () => {
    const enrollMock = vi.fn().mockRejectedValue(new Error('boom'))
    vi.mocked(useMutation).mockReturnValue(enrollMock as any)
    setupQueries({ roster: sampleRoster })
    renderPromotePage()
    pickSourceClass()
    fireEvent.click(rowCheckbox('HS001'))
    pickTargetClass()

    fireEvent.click(
      screen.getByRole('button', { name: 'students.promote.submit' }),
    )

    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('students.promote.error')
    })
    expect(toast.success).not.toHaveBeenCalled()
  })

  test('submit is disabled and a no-op when no student is selected', () => {
    const enrollMock = vi.fn()
    vi.mocked(useMutation).mockReturnValue(enrollMock as any)
    setupQueries({ roster: sampleRoster })
    renderPromotePage()
    pickSourceClass()
    pickTargetClass()

    const submitButton = screen.getByRole('button', {
      name: 'students.promote.submit',
    })
    expect(submitButton).toBeDisabled()
    fireEvent.click(submitButton)

    expect(enrollMock).not.toHaveBeenCalled()
  })

  test('submit is disabled and a no-op when no target class is chosen', () => {
    const enrollMock = vi.fn()
    vi.mocked(useMutation).mockReturnValue(enrollMock as any)
    setupQueries({ roster: sampleRoster })
    renderPromotePage()
    pickSourceClass()
    fireEvent.click(rowCheckbox('HS001'))

    const submitButton = screen.getByRole('button', {
      name: 'students.promote.submit',
    })
    expect(submitButton).toBeDisabled()
    fireEvent.click(submitButton)

    expect(enrollMock).not.toHaveBeenCalled()
  })
})
