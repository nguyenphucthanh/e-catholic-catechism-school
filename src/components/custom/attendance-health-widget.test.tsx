import { describe, expect, test, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { useQuery } from 'convex/react'
import { AttendanceHealthWidget } from './attendance-health-widget'
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
const dateFrom = '2026-06-08'
const dateTo = '2026-07-05'

function getCard(className: string) {
  return screen.getByText(className).closest('.rounded-lg') as HTMLElement
}

describe('AttendanceHealthWidget', () => {
  test('shows 3 skeleton placeholders while the query is pending', () => {
    vi.mocked(useQuery).mockReturnValue(undefined)

    const { container } = render(
      <AttendanceHealthWidget
        requesterId={requesterId}
        academicYearId={academicYearId}
        dateFrom={dateFrom}
        dateTo={dateTo}
      />,
    )

    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(3)
  })

  test('skips the query when academicYearId is null', () => {
    vi.mocked(useQuery).mockReturnValue(undefined)

    render(
      <AttendanceHealthWidget
        requesterId={requesterId}
        academicYearId={null}
        dateFrom={dateFrom}
        dateTo={dateTo}
      />,
    )

    expect(useQuery).toHaveBeenCalledWith(expect.anything(), 'skip')
    expect(
      screen.queryByText('dashboard.attendanceHealth.empty'),
    ).not.toBeInTheDocument()
  })

  test('shows both empty states when classSummaries and atRiskStudents are empty', () => {
    vi.mocked(useQuery).mockReturnValue({
      classSummaries: [],
      atRiskStudents: [],
    })

    render(
      <AttendanceHealthWidget
        requesterId={requesterId}
        academicYearId={academicYearId}
        dateFrom={dateFrom}
        dateTo={dateTo}
      />,
    )

    expect(
      screen.getByText('dashboard.attendanceHealth.empty'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('dashboard.attendanceHealth.atRiskTitle'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('dashboard.attendanceHealth.atRiskEmpty'),
    ).toBeInTheDocument()
  })

  test('renders a numeric rate badge for a class with a rate', () => {
    vi.mocked(useQuery).mockReturnValue({
      classSummaries: [
        {
          classId: 'class1' as Id<'classes'>,
          classYearId: 'classYear1' as Id<'classYears'>,
          className: 'Ấu Nhi 1',
          rate: 92,
          trend: 'up' as const,
        },
      ],
      atRiskStudents: [],
    })

    render(
      <AttendanceHealthWidget
        requesterId={requesterId}
        academicYearId={academicYearId}
        dateFrom={dateFrom}
        dateTo={dateTo}
      />,
    )

    const card = getCard('Ấu Nhi 1')
    expect(within(card).getByText('92%')).toBeInTheDocument()
    expect(
      within(card).queryByText('dashboard.attendanceHealth.noData'),
    ).not.toBeInTheDocument()
  })

  test('renders the mid-tier (80-89) rate badge styling and a down-trend icon', () => {
    vi.mocked(useQuery).mockReturnValue({
      classSummaries: [
        {
          classId: 'class4' as Id<'classes'>,
          classYearId: 'classYear4' as Id<'classYears'>,
          className: 'Nghĩa Sĩ 1',
          rate: 85,
          trend: 'down' as const,
        },
      ],
      atRiskStudents: [],
    })

    render(
      <AttendanceHealthWidget
        requesterId={requesterId}
        academicYearId={academicYearId}
        dateFrom={dateFrom}
        dateTo={dateTo}
      />,
    )

    const card = getCard('Nghĩa Sĩ 1')
    const badge = within(card).getByText('85%')
    expect(badge).toHaveClass('text-amber-500')
  })

  test('renders the low-tier (<80) rate badge styling', () => {
    vi.mocked(useQuery).mockReturnValue({
      classSummaries: [
        {
          classId: 'class5' as Id<'classes'>,
          classYearId: 'classYear5' as Id<'classYears'>,
          className: 'Nghĩa Sĩ 2',
          rate: 60,
          trend: 'flat' as const,
        },
      ],
      atRiskStudents: [],
    })

    render(
      <AttendanceHealthWidget
        requesterId={requesterId}
        academicYearId={academicYearId}
        dateFrom={dateFrom}
        dateTo={dateTo}
      />,
    )

    const card = getCard('Nghĩa Sĩ 2')
    const badge = within(card).getByText('60%')
    expect(badge).toHaveClass('text-destructive')
  })

  test('renders a no-data badge for a class with a null rate', () => {
    vi.mocked(useQuery).mockReturnValue({
      classSummaries: [
        {
          classId: 'class2' as Id<'classes'>,
          classYearId: 'classYear2' as Id<'classYears'>,
          className: 'Thiếu Nhi 1',
          rate: null,
          trend: 'flat' as const,
        },
      ],
      atRiskStudents: [],
    })

    render(
      <AttendanceHealthWidget
        requesterId={requesterId}
        academicYearId={academicYearId}
        dateFrom={dateFrom}
        dateTo={dateTo}
      />,
    )

    const card = getCard('Thiếu Nhi 1')
    expect(
      within(card).getByText('dashboard.attendanceHealth.noData'),
    ).toBeInTheDocument()
  })

  test('renders an at-risk student row with a link to the student detail page and the consecutive-absences badge', () => {
    vi.mocked(useQuery).mockReturnValue({
      classSummaries: [],
      atRiskStudents: [
        {
          studentId: 'student1' as Id<'students'>,
          studentClassId: 'studentClass1' as Id<'studentClasses'>,
          classId: 'class1' as Id<'classes'>,
          className: 'Ấu Nhi 1',
          fullName: 'Nguyễn Văn A',
          studentCode: 'AN001',
          consecutiveAbsences: 3,
        },
      ],
    })

    render(
      <AttendanceHealthWidget
        requesterId={requesterId}
        academicYearId={academicYearId}
        dateFrom={dateFrom}
        dateTo={dateTo}
      />,
    )

    expect(
      screen.queryByText('dashboard.attendanceHealth.atRiskEmpty'),
    ).not.toBeInTheDocument()

    const link = screen
      .getByText('Nguyễn Văn A')
      .closest('a') as HTMLAnchorElement
    expect(link).toHaveAttribute('href', '/students/$id')
    expect(link).toHaveAttribute('data-params', '{"id":"student1"}')

    expect(screen.getByText('Ấu Nhi 1')).toBeInTheDocument()
    expect(
      screen.getByText('dashboard.attendanceHealth.consecutiveAbsences'),
    ).toBeInTheDocument()
  })

  test('calls useQuery with the requester, academic year, and date range when academicYearId is set', () => {
    vi.mocked(useQuery).mockReturnValue({
      classSummaries: [],
      atRiskStudents: [],
    })

    render(
      <AttendanceHealthWidget
        requesterId={requesterId}
        academicYearId={academicYearId}
        dateFrom={dateFrom}
        dateTo={dateTo}
      />,
    )

    expect(useQuery).toHaveBeenCalledWith(expect.anything(), {
      requesterId,
      academicYearId,
      dateFrom,
      dateTo,
    })
  })
})
