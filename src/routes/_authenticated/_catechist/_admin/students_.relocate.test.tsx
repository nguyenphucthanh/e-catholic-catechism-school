import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useQuery } from 'convex/react'
import { Route } from './students_.relocate'
import { useAuth } from '~/lib/auth'
import { useInactiveYear, useSelectedAcademicYear } from '~/lib/academic-year'

vi.mock('~/lib/academic-year', () => ({
  useSelectedAcademicYear: vi.fn(),
  useInactiveYear: vi.fn(),
}))

const RelocatePageComponent = (Route as any).options.component

function mockQueries({
  classYears = [],
  roster = {},
}: {
  classYears?: Array<{ classYearId: string; className: string }>
  roster?: Partial<Record<string, Array<Record<string, unknown>>>>
} = {}) {
  vi.mocked(useQuery).mockImplementation(((fnRef: any, args: any) => {
    const path = fnRef?.[Symbol.for('functionName')]
    if (path === 'classes:listClassYears') return classYears
    if (path === 'students:listActiveRosterByClassYear') {
      if (args === 'skip') return undefined
      return roster[args.classYearId] ?? []
    }
    return undefined
  }) as any)
}

describe('RelocateStudentsPage', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: { userDocId: 'catechist1' } as any,
    })
    vi.mocked(useSelectedAcademicYear).mockReturnValue({
      selectedYearId: 'year-2024' as any,
      setSelectedYearId: vi.fn(),
    })
    vi.mocked(useInactiveYear).mockReturnValue({
      isInactive: false,
      yearName: '2024-2025',
    })
  })

  test('shows empty state when no columns have been added', () => {
    mockQueries({ classYears: [{ classYearId: 'cy1', className: 'Class A' }] })
    render(<RelocatePageComponent />)

    expect(screen.getByText('students.relocate.emptyState')).toBeInTheDocument()
  })

  test('adding a class from the combobox renders it as a board column with its roster', () => {
    mockQueries({
      classYears: [{ classYearId: 'cy1', className: 'Class A' }],
      roster: {
        cy1: [
          {
            studentId: 's1',
            studentCode: 'STU001',
            fullName: 'Nguyen Van A',
            saintName: undefined,
          },
        ],
      },
    })
    render(<RelocatePageComponent />)

    fireEvent.mouseDown(
      screen.getByPlaceholderText('students.relocate.addClassPlaceholder'),
    )
    fireEvent.pointerDown(screen.getByRole('option', { name: /Class A/ }))
    fireEvent.click(screen.getByRole('option', { name: /Class A/ }))

    expect(screen.getByText('Class A')).toBeInTheDocument()
    expect(screen.getByText('Nguyen Van A')).toBeInTheDocument()
  })

  test('add-class combobox excludes classes that are already added as columns', () => {
    mockQueries({
      classYears: [
        { classYearId: 'cy1', className: 'Class A' },
        { classYearId: 'cy2', className: 'Class B' },
      ],
      roster: { cy1: [], cy2: [] },
    })
    render(<RelocatePageComponent />)

    fireEvent.mouseDown(
      screen.getByPlaceholderText('students.relocate.addClassPlaceholder'),
    )
    const optionA = screen.getByRole('option', { name: /Class A/ })
    fireEvent.pointerDown(optionA)
    fireEvent.click(optionA)

    fireEvent.mouseDown(
      screen.getByPlaceholderText('students.relocate.addClassPlaceholder'),
    )
    expect(
      screen.queryByRole('option', { name: /Class A/ }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Class B/ })).toBeInTheDocument()
  })

  test('submit button is disabled when no moves have been made', () => {
    mockQueries({
      classYears: [{ classYearId: 'cy1', className: 'Class A' }],
      roster: { cy1: [] },
    })
    render(<RelocatePageComponent />)

    expect(
      screen.getByRole('button', { name: 'students.relocate.submit' }),
    ).toBeDisabled()
  })

  test('renders inactive-year warning and disables the add-class combobox when year is inactive', () => {
    vi.mocked(useInactiveYear).mockReturnValue({
      isInactive: true,
      yearName: '2023-2024',
    })
    mockQueries({ classYears: [{ classYearId: 'cy1', className: 'Class A' }] })
    render(<RelocatePageComponent />)

    expect(
      screen.getByText('students.relocate.inactiveYearWarning'),
    ).toBeInTheDocument()
    expect(
      screen.getByPlaceholderText('students.relocate.addClassPlaceholder'),
    ).toHaveAttribute('data-disabled')
    expect(
      screen.getByRole('button', { name: 'students.relocate.submit' }),
    ).toBeDisabled()
  })
})
