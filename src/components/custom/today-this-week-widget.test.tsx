import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { useQuery } from 'convex/react'
import { TodayThisWeekWidget } from './today-this-week-widget'
import type { Id } from '../../../convex/_generated/dataModel'
import { formatDate } from '~/lib/locale'

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

// Fixed "now" is Wednesday 2026-07-08, so the Mon-Sun week is
// 2026-07-06 .. 2026-07-12.
const TODAY = '2026-07-08'
const PAST_DATE = '2026-07-06'
const FUTURE_DATE = '2026-07-10'

function getRow(className: string) {
  return screen.getByText(className).closest('[data-class]') as HTMLElement
}

describe('TodayThisWeekWidget', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-08T09:00:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('shows 3 skeleton placeholders while the query is pending', () => {
    vi.mocked(useQuery).mockReturnValue(undefined)

    const { container } = render(
      <TodayThisWeekWidget
        requesterId={requesterId}
        academicYearId={academicYearId}
      />,
    )

    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(3)
  })

  test('shows the empty state when there are no sessions', () => {
    vi.mocked(useQuery).mockReturnValue([])

    render(
      <TodayThisWeekWidget
        requesterId={requesterId}
        academicYearId={academicYearId}
      />,
    )

    expect(
      screen.getByText('dashboard.todayThisWeek.empty'),
    ).toBeInTheDocument()
  })

  test('skips the query when academicYearId is null', () => {
    vi.mocked(useQuery).mockReturnValue(undefined)

    render(
      <TodayThisWeekWidget requesterId={requesterId} academicYearId={null} />,
    )

    expect(useQuery).toHaveBeenCalledWith(expect.anything(), 'skip')
    expect(
      screen.queryByText('dashboard.todayThisWeek.empty'),
    ).not.toBeInTheDocument()
  })

  test('renders a "done" badge when all students are recorded', () => {
    vi.mocked(useQuery).mockReturnValue([
      {
        sessionId: 'session1' as Id<'classSessions'>,
        classId: 'class1' as Id<'classes'>,
        classYearId: 'classYear1' as Id<'classYears'>,
        className: 'Ấu Nhi 1',
        sessionDate: PAST_DATE,
        sessionType: 'catechism' as const,
        studentCount: 10,
        recordedCount: 10,
      },
    ])

    render(
      <TodayThisWeekWidget
        requesterId={requesterId}
        academicYearId={academicYearId}
      />,
    )

    const row = getRow('Ấu Nhi 1')
    expect(
      within(row).getByText('dashboard.todayThisWeek.done'),
    ).toBeInTheDocument()
    expect(
      within(row).queryByText('dashboard.todayThisWeek.overdue'),
    ).not.toBeInTheDocument()
    expect(
      within(row).queryByText('dashboard.todayThisWeek.pending'),
    ).not.toBeInTheDocument()
  })

  test('renders an "overdue" badge when not done and the session date is in the past', () => {
    vi.mocked(useQuery).mockReturnValue([
      {
        sessionId: 'session2' as Id<'classSessions'>,
        classId: 'class2' as Id<'classes'>,
        classYearId: 'classYear2' as Id<'classYears'>,
        className: 'Thiếu Nhi 1',
        sessionDate: PAST_DATE,
        sessionType: 'supplemental' as const,
        studentCount: 10,
        recordedCount: 4,
      },
    ])

    render(
      <TodayThisWeekWidget
        requesterId={requesterId}
        academicYearId={academicYearId}
      />,
    )

    const row = getRow('Thiếu Nhi 1')
    expect(
      within(row).getByText('dashboard.todayThisWeek.overdue'),
    ).toBeInTheDocument()
    expect(
      within(row).queryByText('dashboard.todayThisWeek.done'),
    ).not.toBeInTheDocument()
    expect(
      within(row).queryByText('dashboard.todayThisWeek.pending'),
    ).not.toBeInTheDocument()
  })

  test('renders a "pending" badge when not done and the session date is today or in the future', () => {
    vi.mocked(useQuery).mockReturnValue([
      {
        sessionId: 'session3' as Id<'classSessions'>,
        classId: 'class3' as Id<'classes'>,
        classYearId: 'classYear3' as Id<'classYears'>,
        className: 'Nghĩa Sĩ 1',
        sessionDate: FUTURE_DATE,
        sessionType: 'catechism' as const,
        studentCount: 10,
        recordedCount: 0,
      },
    ])

    render(
      <TodayThisWeekWidget
        requesterId={requesterId}
        academicYearId={academicYearId}
      />,
    )

    const row = getRow('Nghĩa Sĩ 1')
    expect(
      within(row).getByText('dashboard.todayThisWeek.pending'),
    ).toBeInTheDocument()
    expect(
      within(row).queryByText('dashboard.todayThisWeek.done'),
    ).not.toBeInTheDocument()
    expect(
      within(row).queryByText('dashboard.todayThisWeek.overdue'),
    ).not.toBeInTheDocument()
  })

  test('treats a session with zero students as not done, even if scheduled today', () => {
    vi.mocked(useQuery).mockReturnValue([
      {
        sessionId: 'session4' as Id<'classSessions'>,
        classId: 'class4' as Id<'classes'>,
        classYearId: 'classYear4' as Id<'classYears'>,
        className: 'Empty Class',
        sessionDate: TODAY,
        sessionType: 'catechism' as const,
        studentCount: 0,
        recordedCount: 0,
      },
    ])

    render(
      <TodayThisWeekWidget
        requesterId={requesterId}
        academicYearId={academicYearId}
      />,
    )

    const row = getRow('Empty Class')
    expect(
      within(row).getByText('dashboard.todayThisWeek.pending'),
    ).toBeInTheDocument()
  })

  test('renders className, session type badge, formatted date, and recorded counts', () => {
    vi.mocked(useQuery).mockReturnValue([
      {
        sessionId: 'session5' as Id<'classSessions'>,
        classId: 'class5' as Id<'classes'>,
        classYearId: 'classYear5' as Id<'classYears'>,
        className: 'Ấu Nhi 2',
        sessionDate: TODAY,
        sessionType: 'supplemental' as const,
        studentCount: 8,
        recordedCount: 3,
      },
    ])

    render(
      <TodayThisWeekWidget
        requesterId={requesterId}
        academicYearId={academicYearId}
      />,
    )

    const row = getRow('Ấu Nhi 2')
    expect(
      within(row).getByText('attendance.sessionType.supplemental'),
    ).toBeInTheDocument()
    expect(within(row).getByText(formatDate(TODAY))).toBeInTheDocument()
    expect(
      within(row).getByText('dashboard.todayThisWeek.recorded'),
    ).toBeInTheDocument()
  })

  test('renders a take-attendance link with the correct params and search', () => {
    vi.mocked(useQuery).mockReturnValue([
      {
        sessionId: 'session6' as Id<'classSessions'>,
        classId: 'class6' as Id<'classes'>,
        classYearId: 'classYear6' as Id<'classYears'>,
        className: 'Ấu Nhi 3',
        sessionDate: TODAY,
        sessionType: 'catechism' as const,
        studentCount: 5,
        recordedCount: 5,
      },
    ])

    render(
      <TodayThisWeekWidget
        requesterId={requesterId}
        academicYearId={academicYearId}
      />,
    )

    const row = getRow('Ấu Nhi 3')
    const link = within(row)
      .getByText('dashboard.myClasses.takeAttendance')
      .closest('a') as HTMLAnchorElement

    expect(link).toHaveAttribute('href', '/classes/$id')
    expect(link).toHaveAttribute('data-params', '{"id":"class6"}')
    expect(link).toHaveAttribute('data-search', '{"tab":"attendance"}')
  })
})
