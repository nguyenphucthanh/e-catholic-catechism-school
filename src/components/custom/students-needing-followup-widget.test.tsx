import { describe, expect, test, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { useQuery } from 'convex/react'
import { StudentsNeedingFollowupWidget } from './students-needing-followup-widget'
import type { Id } from '../../../convex/_generated/dataModel'

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as Record<string, unknown>),
    Link: ({ children, to, params, className }: any) => (
      <a href={to} data-params={JSON.stringify(params)} className={className}>
        {children}
      </a>
    ),
  }
})

const requesterId = 'catechist1' as Id<'catechists'>
const academicYearId = 'year1' as Id<'academicYears'>

const studentsFixture = [
  {
    studentClassId: 'sc1' as Id<'studentClasses'>,
    studentId: 'student1' as Id<'students'>,
    fullName: 'Nguyễn Văn A',
    className: 'Ấu Nhi 1',
    attendanceRate: 40,
    scoreEntriesCount: 1,
  },
  {
    studentClassId: 'sc2' as Id<'studentClasses'>,
    studentId: 'student2' as Id<'students'>,
    fullName: 'Trần Thị B',
    className: 'Thiếu Nhi 1',
    attendanceRate: 55,
    scoreEntriesCount: 2,
  },
]

function renderWidget(
  academicYear: Id<'academicYears'> | null = academicYearId,
) {
  return render(
    <StudentsNeedingFollowupWidget
      requesterId={requesterId}
      academicYearId={academicYear}
    />,
  )
}

describe('StudentsNeedingFollowupWidget', () => {
  test('shows skeleton placeholders while the query is pending', () => {
    vi.mocked(useQuery).mockReturnValue(undefined)

    const { container } = renderWidget()

    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(3)
  })

  test('shows the empty state when there are no students needing follow-up', () => {
    vi.mocked(useQuery).mockReturnValue([])

    renderWidget()

    expect(screen.getByText('dashboard.followUp.empty')).toBeInTheDocument()
  })

  test('skips the query when academicYearId is null and stays in loading state', () => {
    vi.mocked(useQuery).mockReturnValue(undefined)

    renderWidget(null)

    expect(useQuery).toHaveBeenCalledWith(expect.anything(), 'skip')
    expect(
      screen.queryByText('dashboard.followUp.empty'),
    ).not.toBeInTheDocument()
  })

  test('renders a row per student with name link, class name, and reason badges', () => {
    vi.mocked(useQuery).mockReturnValue(studentsFixture)

    renderWidget()

    const nameLink = screen.getByText('Nguyễn Văn A')
    expect(nameLink).toHaveAttribute('href', '/students/$id')
    expect(nameLink).toHaveAttribute('data-params', '{"id":"student1"}')

    const row1 = nameLink.closest('div')!.parentElement as HTMLElement
    expect(within(row1).getByText('Ấu Nhi 1')).toBeInTheDocument()
    expect(
      within(row1).getByText('dashboard.followUp.reasons.lowAttendance'),
    ).toBeInTheDocument()
    expect(
      within(row1).getByText('dashboard.followUp.reasons.missingScores'),
    ).toBeInTheDocument()

    expect(screen.getByText('Trần Thị B')).toBeInTheDocument()
    expect(screen.getByText('Thiếu Nhi 1')).toBeInTheDocument()
  })

  test('conditionally renders only applicable reason badges', () => {
    vi.mocked(useQuery).mockReturnValue([
      {
        studentClassId: 'sc3' as Id<'studentClasses'>,
        studentId: 'student3' as Id<'students'>,
        fullName: 'Lê Văn C',
        className: 'Nghĩa Sĩ 1',
        attendanceRate: 50,
        scoreEntriesCount: 4, // >= 3, so no missingScores badge
      },
      {
        studentClassId: 'sc4' as Id<'studentClasses'>,
        studentId: 'student4' as Id<'students'>,
        fullName: 'Phạm Thị D',
        className: 'Hiệp Sĩ 1',
        attendanceRate: 85, // >= 75, so no lowAttendance badge
        scoreEntriesCount: 1,
      },
    ])

    renderWidget()

    const studentC = screen.getByText('Lê Văn C').closest('div')!
      .parentElement as HTMLElement
    expect(
      within(studentC).getByText('dashboard.followUp.reasons.lowAttendance'),
    ).toBeInTheDocument()
    expect(
      within(studentC).queryByText('dashboard.followUp.reasons.missingScores'),
    ).not.toBeInTheDocument()

    const studentD = screen.getByText('Phạm Thị D').closest('div')!
      .parentElement as HTMLElement
    expect(
      within(studentD).queryByText('dashboard.followUp.reasons.lowAttendance'),
    ).not.toBeInTheDocument()
    expect(
      within(studentD).getByText('dashboard.followUp.reasons.missingScores'),
    ).toBeInTheDocument()
  })
})
