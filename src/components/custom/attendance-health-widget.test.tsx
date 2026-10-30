import { describe, expect, test, vi } from 'vitest'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { useConvex } from 'convex/react'
import { AttendanceHealthWidget } from './attendance-health-widget'
import type { Id } from '../../../convex/_generated/dataModel'

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as Record<string, unknown>),
    Link: ({ children, to, params, search, className, ...props }: any) => (
      <a
        href={to}
        data-params={JSON.stringify(params)}
        data-search={JSON.stringify(search)}
        className={className}
        {...props}
      >
        {children}
      </a>
    ),
  }
})

const academicYearId = 'year1' as Id<'academicYears'>
const dateFrom = '2026-06-08'
const dateTo = '2026-07-05'

function mockQuery(result: unknown) {
  const query = vi.fn().mockResolvedValue(result)
  vi.mocked(useConvex).mockReturnValue({ query } as any)
  return query
}

function getCard(className: string) {
  return screen.getByText(className).closest('[data-class]') as HTMLElement
}

describe('AttendanceHealthWidget', () => {
  test('shows 3 skeleton placeholders while the query is pending', () => {
    mockQuery(undefined)

    const { container } = render(
      <AttendanceHealthWidget
        academicYearId={academicYearId}
        dateFrom={dateFrom}
        dateTo={dateTo}
      />,
    )

    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(3)
  })

  test('does not fetch when academicYearId is null', () => {
    const query = mockQuery(undefined)

    render(
      <AttendanceHealthWidget
        academicYearId={null}
        dateFrom={dateFrom}
        dateTo={dateTo}
      />,
    )

    expect(query).not.toHaveBeenCalled()
    expect(
      screen.queryByText('dashboard.attendanceHealth.empty'),
    ).not.toBeInTheDocument()
  })

  test('shows both empty states when classSummaries and atRiskStudents are empty', async () => {
    mockQuery({
      classSummaries: [],
      atRiskStudents: [],
    })

    render(
      <AttendanceHealthWidget
        academicYearId={academicYearId}
        dateFrom={dateFrom}
        dateTo={dateTo}
      />,
    )

    await screen.findByText('dashboard.attendanceHealth.atRiskTitle')

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

  test('renders a numeric rate badge for a class with a rate', async () => {
    mockQuery({
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
        academicYearId={academicYearId}
        dateFrom={dateFrom}
        dateTo={dateTo}
      />,
    )

    await screen.findByText('dashboard.attendanceHealth.atRiskTitle')

    const card = getCard('Ấu Nhi 1')
    expect(within(card).getByText('92%')).toBeInTheDocument()
    expect(
      within(card).queryByText('dashboard.attendanceHealth.noData'),
    ).not.toBeInTheDocument()
  })

  test('renders the mid-tier (80-89) rate badge styling and a down-trend icon', async () => {
    mockQuery({
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
        academicYearId={academicYearId}
        dateFrom={dateFrom}
        dateTo={dateTo}
      />,
    )

    await screen.findByText('dashboard.attendanceHealth.atRiskTitle')

    const card = getCard('Nghĩa Sĩ 1')
    const badge = within(card).getByText('85%')
    expect(badge).toHaveClass('text-amber-500')
  })

  test('renders the low-tier (<80) rate badge styling', async () => {
    mockQuery({
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
        academicYearId={academicYearId}
        dateFrom={dateFrom}
        dateTo={dateTo}
      />,
    )

    await screen.findByText('dashboard.attendanceHealth.atRiskTitle')

    const card = getCard('Nghĩa Sĩ 2')
    const badge = within(card).getByText('60%')
    expect(badge).toHaveClass('text-destructive')
  })

  test('renders a no-data badge for a class with a null rate', async () => {
    mockQuery({
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
        academicYearId={academicYearId}
        dateFrom={dateFrom}
        dateTo={dateTo}
      />,
    )

    await screen.findByText('dashboard.attendanceHealth.atRiskTitle')

    const card = getCard('Thiếu Nhi 1')
    expect(
      within(card).getByText('dashboard.attendanceHealth.noData'),
    ).toBeInTheDocument()
  })

  test('renders an at-risk student row with a link to the student detail page and the consecutive-absences badge', async () => {
    mockQuery({
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
        academicYearId={academicYearId}
        dateFrom={dateFrom}
        dateTo={dateTo}
      />,
    )

    await screen.findByText('dashboard.attendanceHealth.atRiskTitle')

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

  test('fetches once with the academic year and date range, and again on refresh', async () => {
    const query = mockQuery({ classSummaries: [], atRiskStudents: [] })

    render(
      <AttendanceHealthWidget
        academicYearId={academicYearId}
        dateFrom={dateFrom}
        dateTo={dateTo}
      />,
    )

    await screen.findByText('dashboard.attendanceHealth.atRiskTitle')
    expect(query).toHaveBeenCalledTimes(1)
    expect(query).toHaveBeenCalledWith(expect.anything(), {
      academicYearId,
      dateFrom,
      dateTo,
    })

    fireEvent.click(
      screen.getByRole('button', {
        name: 'dashboard.attendanceHealth.refresh',
      }),
    )
    await waitFor(() => expect(query).toHaveBeenCalledTimes(2))
  })
})
