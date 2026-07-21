import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useQuery } from 'convex/react'
import { UpcomingEventsWidget } from './upcoming-events-widget'
import type { Id } from '../../../convex/_generated/dataModel'
import { formatDate } from '~/lib/locale'

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as Record<string, unknown>),
    Link: ({ children, to, className }: any) => (
      <a href={to} className={className}>
        {children}
      </a>
    ),
  }
})

const requesterId = 'catechist1' as Id<'catechists'>
const academicYearId = 'year1' as Id<'academicYears'>

// System time: 2026-07-08. Next 4 weeks: 2026-07-08 to 2026-08-05.
const TODAY = '2026-07-08'
const DATE_TO = '2026-08-05'

describe('UpcomingEventsWidget', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-08T09:00:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('shows skeleton placeholders while the query is pending', () => {
    vi.mocked(useQuery).mockReturnValue(undefined)

    const { container } = render(
      <UpcomingEventsWidget
        requesterId={requesterId}
        academicYearId={academicYearId}
      />,
    )

    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(3)
  })

  test('shows the empty state when there are no events', () => {
    vi.mocked(useQuery).mockReturnValue([])

    render(
      <UpcomingEventsWidget
        requesterId={requesterId}
        academicYearId={academicYearId}
      />,
    )

    expect(
      screen.getByText('dashboard.upcomingEvents.empty'),
    ).toBeInTheDocument()
  })

  test('skips the query when academicYearId is null', () => {
    vi.mocked(useQuery).mockReturnValue(undefined)

    render(
      <UpcomingEventsWidget requesterId={requesterId} academicYearId={null} />,
    )

    expect(useQuery).toHaveBeenCalledWith(expect.anything(), 'skip')
    expect(
      screen.queryByText('dashboard.upcomingEvents.empty'),
    ).not.toBeInTheDocument()
  })

  test('renders upcoming events list with correct details', () => {
    const mockEvents = [
      {
        _id: 'event1' as Id<'calendarEvents'>,
        academicYearId,
        date: '2026-07-15',
        liturgicalDate: 'Chúa Nhật XV Thường Niên',
        description: JSON.stringify({
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Giỗ tổ Hùng Vương' }],
            },
          ],
        }),
        severity: 'high' as const,
        scope: 'board' as const,
        createdBy: 'catechist1' as Id<'catechists'>,
        createdAt: 123456789,
        isDeleted: false,
      },
      {
        _id: 'event2' as Id<'calendarEvents'>,
        academicYearId,
        date: '2026-07-20',
        description: 'Plain text description',
        severity: 'medium' as const,
        scope: 'branch' as const,
        branchId: 'branch1' as Id<'branches'>,
        branchName: 'Ngành Nghĩa',
        createdBy: 'catechist1' as Id<'catechists'>,
        createdAt: 123456789,
        isDeleted: false,
      },
      {
        _id: 'event3' as Id<'calendarEvents'>,
        academicYearId,
        date: '2026-07-25',
        description: 'Class-scoped event description',
        severity: 'low' as const,
        scope: 'class' as const,
        classYearId: 'classYear1' as Id<'classYears'>,
        className: 'Ấu Nhi 1A',
        createdBy: 'catechist1' as Id<'catechists'>,
        createdAt: 123456789,
        isDeleted: false,
      },
    ]

    vi.mocked(useQuery).mockReturnValue(mockEvents)

    render(
      <UpcomingEventsWidget
        requesterId={requesterId}
        academicYearId={academicYearId}
      />,
    )

    // Verify query arguments
    expect(useQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        requesterId,
        academicYearId,
        dateFrom: TODAY,
        dateTo: DATE_TO,
      }),
    )

    // Verify headers & link
    expect(
      screen.getByText('dashboard.upcomingEvents.title'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('dashboard.upcomingEvents.viewAll'),
    ).toBeInTheDocument()

    // Event 1 assertions
    expect(
      screen.getByText(
        formatDate('2026-07-15', {
          day: 'numeric',
          month: 'numeric',
          year: '2-digit',
        }),
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('Chúa Nhật XV Thường Niên')).toBeInTheDocument()
    expect(screen.getByText('Giỗ tổ Hùng Vương')).toBeInTheDocument()
    expect(screen.getByText('calendarEvents.scope.board')).toBeInTheDocument()

    // Event 2 assertions
    expect(
      screen.getByText(
        formatDate('2026-07-20', {
          day: 'numeric',
          month: 'numeric',
          year: '2-digit',
        }),
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('Plain text description')).toBeInTheDocument()
    expect(screen.getByText('calendarEvents.scope.branch')).toBeInTheDocument()
    expect(screen.getByText('Ngành Nghĩa')).toBeInTheDocument()

    // Event 3 assertions
    expect(
      screen.getByText(
        formatDate('2026-07-25', {
          day: 'numeric',
          month: 'numeric',
          year: '2-digit',
        }),
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Class-scoped event description'),
    ).toBeInTheDocument()
    expect(screen.getByText('calendarEvents.scope.class')).toBeInTheDocument()
    expect(screen.getByText('Ấu Nhi 1A')).toBeInTheDocument()
  })
})
