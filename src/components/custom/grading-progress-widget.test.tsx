import { describe, expect, test, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { useQuery } from 'convex/react'
import { GradingProgressWidget } from './grading-progress-widget'
import type { Id } from '../../../convex/_generated/dataModel'

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as Record<string, unknown>),
    Link: ({ children, to, params, search, className }: any) => (
      <a
        href={to}
        data-params={JSON.stringify(params)}
        data-search={JSON.stringify(search)}
        className={className}
      >
        {children}
      </a>
    ),
  }
})

const requesterId = 'catechist1' as Id<'catechists'>
const academicYearId = 'year1' as Id<'academicYears'>

const columnsFixture = [
  {
    scoreColumnId: 'col1' as Id<'scoreColumns'>,
    classId: 'class1' as Id<'classes'>,
    className: 'Ấu Nhi 1',
    columnName: 'Kiểm tra 15 phút',
    columnType: 'numeric',
    semesterNumber: 1,
    enteredCount: 5,
    studentCount: 20,
  },
  {
    scoreColumnId: 'col2' as Id<'scoreColumns'>,
    classId: 'class2' as Id<'classes'>,
    className: 'Thiếu Nhi 1',
    columnName: 'Kiểm tra miệng',
    columnType: 'qualitative',
    semesterNumber: 2,
    enteredCount: 10,
    studentCount: 10,
  },
]

function renderWidget(
  academicYear: Id<'academicYears'> | null = academicYearId,
) {
  return render(
    <GradingProgressWidget
      requesterId={requesterId}
      academicYearId={academicYear}
    />,
  )
}

describe('GradingProgressWidget', () => {
  test('shows skeleton placeholders while the query is pending', () => {
    vi.mocked(useQuery).mockReturnValue(undefined)

    const { container } = renderWidget()

    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(3)
  })

  test('shows the empty state when there are no columns', () => {
    vi.mocked(useQuery).mockReturnValue([])

    renderWidget()

    expect(
      screen.getByText('dashboard.gradingProgress.empty'),
    ).toBeInTheDocument()
  })

  test('skips the query when academicYearId is null and stays in loading state', () => {
    vi.mocked(useQuery).mockReturnValue(undefined)

    renderWidget(null)

    expect(useQuery).toHaveBeenCalledWith(expect.anything(), 'skip')
    expect(
      screen.queryByText('dashboard.gradingProgress.empty'),
    ).not.toBeInTheDocument()
  })

  test('renders a row per column with class name, type badge, entered count and a link to the class exams tab', () => {
    vi.mocked(useQuery).mockReturnValue(columnsFixture)

    renderWidget()

    expect(screen.getByText('Ấu Nhi 1')).toBeInTheDocument()
    expect(screen.getByText('Thiếu Nhi 1')).toBeInTheDocument()

    const row1 = screen.getByText('Ấu Nhi 1').closest('.px-4') as HTMLElement
    const link1 = within(row1).getByText(
      'dashboard.gradingProgress.enterScores',
    )

    expect(link1).toHaveAttribute('href', '/classes/$id')
    expect(link1).toHaveAttribute('data-params', '{"id":"class1"}')
    expect(link1).toHaveAttribute('data-search', '{"tab":"exams"}')
  })

  test('renders the column type badge and semester/entered-count text', () => {
    vi.mocked(useQuery).mockReturnValue(columnsFixture)

    renderWidget()

    expect(screen.getByText('exams.create.type.numeric')).toBeInTheDocument()
    expect(
      screen.getByText('exams.create.type.qualitative'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Kiểm tra 15 phút', { exact: false }),
    ).toBeInTheDocument()
  })
})
