import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { Route } from './calendar'
import { useAuth } from '~/lib/auth'
import { useSelectedAcademicYear } from '~/lib/academic-year'

vi.mock('~/lib/romcal', () => ({
  getLiturgicalDateLabel: vi.fn().mockImplementation((isoDate: string) => {
    return Promise.resolve(`Mass on ${isoDate}`)
  }),
}))

const mockSelectedYearId = 'year-2024'

vi.mock('~/lib/academic-year', () => ({
  useSelectedAcademicYear: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('~/components/forms/calendar-event-dialog', () => ({
  CalendarEventDialog: (props: any) => (
    <div
      data-testid="calendar-event-dialog"
      data-open={String(props.isOpen)}
      data-event-id={props.event?._id ?? ''}
      data-default-date={props.defaultDate ?? ''}
    />
  ),
}))

const mockUser = {
  _id: 'user123',
  userDocId: 'catechist123',
  memberId: 'GLV0001',
  fullName: 'Admin User',
  role: 'admin',
} as any

function tiptapDescription(text: string): string {
  return JSON.stringify({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  })
}

const todayEvent = {
  _id: 'evt-today',
  date: '2026-07-08',
  liturgicalDate: 'Some Feast',
  description: tiptapDescription('Today event'),
  severity: 'high' as const,
  scope: 'board' as const,
  branchName: null,
  className: null,
  createdByName: 'Admin User',
  createdAt: 1750000000000,
  updatedByName: null,
  updatedAt: undefined,
}

const otherDayBranchEvent = {
  _id: 'evt-other',
  date: '2026-07-15',
  liturgicalDate: undefined,
  description: tiptapDescription('Branch retreat'),
  severity: 'medium' as const,
  scope: 'branch' as const,
  branchName: 'Ấu Nhi',
  className: null,
  createdByName: 'Sr. Mary',
  createdAt: 1750100000000,
  updatedByName: null,
  updatedAt: undefined,
}

function setupQueries(events: Array<any> | undefined) {
  ;(useQuery as any).mockImplementation((queryRef: any) => {
    const path = queryRef?.[Symbol.for('functionName')]
    if (path === 'calendarEvents:list') return events
    if (path === 'appConfig:get') {
      return {
        epiphanyOnSunday: true,
        corpusChristiOnSunday: true,
        ascensionOnSunday: true,
      }
    }
    return undefined
  })
}

let removeMock: ReturnType<typeof vi.fn>

const ManageCalendarPageComponent = (Route as any).options.component

describe('ManageCalendarPage', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-08T09:00:00'))

    removeMock = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useMutation).mockReturnValue(removeMock as any)

    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockUser,
    })
    vi.mocked(useSelectedAcademicYear).mockReturnValue({
      selectedYearId: mockSelectedYearId as any,
      setSelectedYearId: vi.fn(),
    })
    vi.mocked(toast.success).mockClear()
    vi.mocked(toast.error).mockClear()

    setupQueries([todayEvent, otherDayBranchEvent])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('renders the two-panel layout with calendar and event list', () => {
    render(<ManageCalendarPageComponent />)

    expect(screen.getByText('calendarEvents.manage.title')).toBeInTheDocument()
    // calendar grid (react-day-picker)
    expect(screen.getByRole('grid')).toBeInTheDocument()
    // right panel shows today's event by default (selectedDate = today)
    expect(screen.getByText('Today event')).toBeInTheDocument()
  })

  test('day cells show an event-count indicator only on dates with events', () => {
    const { container } = render(<ManageCalendarPageComponent />)

    const todayCell = container.querySelector('[data-day="2026-07-08"]')
    const otherEventCell = container.querySelector('[data-day="2026-07-15"]')
    const emptyCell = container.querySelector('[data-day="2026-07-20"]')

    expect(todayCell?.querySelector('.bg-primary')).toBeTruthy()
    expect(otherEventCell?.querySelector('.bg-primary')).toBeTruthy()
    expect(emptyCell?.querySelector('.bg-primary')).toBeFalsy()
  })

  test('scope filter narrows day-cell indicators to the selected scope', () => {
    const { container } = render(<ManageCalendarPageComponent />)

    // filter to 'branch' scope — todayEvent (board) should lose its indicator,
    // the branch-scoped event on the 15th should keep it.
    const trigger = screen
      .getByText('calendarEvents.filter.scope.all')
      .closest('button')!
    fireEvent.click(trigger)
    const option = screen.getByRole('option', {
      name: 'calendarEvents.scope.branch',
    })
    fireEvent.pointerDown(option)
    fireEvent.click(option)

    const todayCell = container.querySelector('[data-day="2026-07-08"]')
    const otherEventCell = container.querySelector('[data-day="2026-07-15"]')
    expect(todayCell?.querySelector('.bg-primary')).toBeFalsy()
    expect(otherEventCell?.querySelector('.bg-primary')).toBeTruthy()
  })

  test('renders a month timeline showing all events grouped by date, with a total-count badge', () => {
    render(<ManageCalendarPageComponent />)

    // both events fall within the displayed month (July 2026) and render
    // simultaneously, no longer filtered to a single selected date.
    expect(screen.getByText('Today event')).toBeInTheDocument()
    expect(screen.getByText('Branch retreat')).toBeInTheDocument()

    // total-count badge sits next to the month heading, not inside the
    // day-picker grid (which also renders plain day-number text nodes).
    const monthHeading = document.querySelector('h3.capitalize')!
    const badge = monthHeading.parentElement!.querySelector('span')
    expect(badge).toHaveTextContent('2')
  })

  test('clicking a date group button updates the selected date used as the new-event default', () => {
    const { container } = render(<ManageCalendarPageComponent />)

    const dialog = screen.getByTestId('calendar-event-dialog')
    expect(dialog).toHaveAttribute('data-default-date', '2026-07-08')

    // the timeline's round date-group button for the 15th — distinct from
    // the day-picker's own day-number button, which lives in a separate
    // panel and carries a `data-day` attribute.
    const timelineDateButtons = Array.from(
      container.querySelectorAll('button.rounded-full'),
    )
    const otherDateButton = timelineDateButtons.find((btn) =>
      btn.textContent.includes('15'),
    ) as HTMLElement
    expect(otherDateButton).toBeTruthy()
    fireEvent.click(otherDateButton)

    expect(dialog).toHaveAttribute('data-default-date', '2026-07-15')
  })

  test('shows the month-empty state when there are no events in the current month', () => {
    setupQueries([])
    render(<ManageCalendarPageComponent />)

    expect(
      screen.getByText('calendarEvents.manage.monthEmpty'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Today event')).not.toBeInTheDocument()
  })

  test('Add Event button opens the create dialog with no editing event', () => {
    render(<ManageCalendarPageComponent />)

    const dialog = screen.getByTestId('calendar-event-dialog')
    expect(dialog).toHaveAttribute('data-open', 'false')

    fireEvent.click(
      screen.getByRole('button', { name: /calendarEvents.manage.addEvent/ }),
    )

    expect(dialog).toHaveAttribute('data-open', 'true')
    expect(dialog).toHaveAttribute('data-event-id', '')
  })

  test('edit icon button opens the dialog pre-filled with the selected event', () => {
    render(<ManageCalendarPageComponent />)

    // multiple events now render at once (whole-month timeline), so scope
    // the edit button to the specific event card.
    const todayCard = screen.getByText('Today event').closest('.rounded-lg')!
    fireEvent.click(
      within(todayCard as HTMLElement).getByRole('button', {
        name: 'common.edit',
      }),
    )

    const dialog = screen.getByTestId('calendar-event-dialog')
    expect(dialog).toHaveAttribute('data-open', 'true')
    expect(dialog).toHaveAttribute('data-event-id', 'evt-today')
  })

  test('delete icon button opens a confirm AlertDialog, and confirming calls api.calendarEvents.remove', async () => {
    render(<ManageCalendarPageComponent />)

    const todayCard = screen.getByText('Today event').closest('.rounded-lg')!
    fireEvent.click(
      within(todayCard as HTMLElement).getByRole('button', {
        name: 'common.delete',
      }),
    )

    const alertDialog = screen.getByRole('alertdialog')
    expect(alertDialog).toBeInTheDocument()

    fireEvent.click(
      within(alertDialog).getByRole('button', { name: 'common.delete' }),
    )

    // `removeMutation` resolves via a real microtask; switch off fake timers
    // (already used above only to pin "today" for date matching) so
    // `waitFor`'s internal polling can run normally.
    vi.useRealTimers()
    await waitFor(() => {
      expect(removeMock).toHaveBeenCalledWith({
        requesterId: 'catechist123',
        id: 'evt-today',
      })
      expect(toast.success).toHaveBeenCalledWith(
        'calendarEvents.manage.deleteSuccess',
      )
    })
  })

  test('shows an error toast when removal fails', async () => {
    removeMock.mockRejectedValueOnce(new Error('CALENDAR_EVENT_UNAUTHORIZED'))
    render(<ManageCalendarPageComponent />)

    const todayCard = screen.getByText('Today event').closest('.rounded-lg')!
    fireEvent.click(
      within(todayCard as HTMLElement).getByRole('button', {
        name: 'common.delete',
      }),
    )
    const alertDialog = screen.getByRole('alertdialog')
    fireEvent.click(
      within(alertDialog).getByRole('button', { name: 'common.delete' }),
    )

    vi.useRealTimers()
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'errors.calendarEventUnauthorized',
      )
    })
  })

  test('renders nothing when requester or selected year is not ready', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: null,
    })
    const { container } = render(<ManageCalendarPageComponent />)
    expect(container).toBeEmptyDOMElement()
  })

  test('renders the Sundays of the month with their romcal mass dates under the small calendar', async () => {
    vi.useRealTimers()
    render(<ManageCalendarPageComponent />)

    // Verify header is present
    expect(
      screen.getByText('calendarEvents.manage.sundays'),
    ).toBeInTheDocument()

    // Wait for the async list items to render. July 2026 has Sundays on 5, 12, 19, 26.
    await waitFor(() => {
      expect(screen.getByText(/5\/7\/2026|05\/07\/2026/)).toBeInTheDocument()
      expect(screen.getByText(/12\/7\/2026|12\/07\/2026/)).toBeInTheDocument()
      expect(screen.getByText(/19\/7\/2026|19\/07\/2026/)).toBeInTheDocument()
      expect(screen.getByText(/26\/7\/2026|26\/07\/2026/)).toBeInTheDocument()
    })
  })
})
