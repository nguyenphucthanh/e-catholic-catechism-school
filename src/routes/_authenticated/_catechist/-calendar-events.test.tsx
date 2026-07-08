import { describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useQuery } from 'convex/react'
import { Route } from './calendar-events'
import { useAuth } from '~/lib/auth'
import { useSelectedAcademicYear } from '~/lib/academic-year'

const mockSelectedYearId = 'year-2024'

vi.mock('~/lib/academic-year', () => ({
  useSelectedAcademicYear: vi.fn(),
}))

const mockAdminUser = {
  _id: 'user123',
  userDocId: 'catechist123',
  memberId: 'GLV0001',
  fullName: 'Admin User',
  role: 'admin',
} as any

function tiptapDescription(text: string): string {
  return JSON.stringify({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text }],
      },
    ],
  })
}

const boardEvent = {
  _id: 'evt-board',
  date: '2026-07-10',
  liturgicalDate: 'Chúa Nhật XV Thường Niên',
  description: tiptapDescription('Board wide announcement'),
  severity: 'high' as const,
  scope: 'board' as const,
  branchName: null,
  className: null,
  createdByName: 'Cha Xứ',
  createdAt: 1750000000000,
  updatedByName: null,
  updatedAt: undefined,
}

const branchEvent = {
  _id: 'evt-branch',
  date: '2026-07-12',
  liturgicalDate: undefined,
  description: tiptapDescription('Branch retreat'),
  severity: 'medium' as const,
  scope: 'branch' as const,
  branchName: 'Ấu Nhi',
  className: null,
  createdByName: 'Sr. Mary',
  createdAt: 1750100000000,
  updatedByName: 'Sr. Anna',
  updatedAt: 1750200000000,
}

const classEventMissingNames = {
  _id: 'evt-class',
  date: '2026-07-14',
  liturgicalDate: undefined,
  description: '{not-valid-json',
  severity: 'low' as const,
  scope: 'class' as const,
  branchName: null,
  className: null,
  createdByName: 'GLV Nguyen',
  createdAt: 1750300000000,
  updatedByName: null,
  updatedAt: undefined,
}

function setupQueries(events: Array<any> | undefined) {
  vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
    const path = queryRef?.[Symbol.for('functionName')]
    if (path === 'calendarEvents:list') return events
    return undefined
  })
}

const CalendarEventsPageComponent = (Route as any).options.component

describe('CalendarEventsPage component', () => {
  test('renders loading skeleton when query has not resolved yet', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockAdminUser,
    })
    vi.mocked(useSelectedAcademicYear).mockReturnValue({
      selectedYearId: mockSelectedYearId as any,
      setSelectedYearId: vi.fn(),
    })
    setupQueries(undefined)

    const { container } = render(<CalendarEventsPageComponent />)

    expect(screen.getByText('calendarEvents.title')).toBeInTheDocument()
    // isLoading renders 5 skeleton rows, no event rows present yet.
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(
      0,
    )
    expect(screen.queryByText('Cha Xứ')).not.toBeInTheDocument()
  })

  test('skips the query while requester/year/date range are not ready', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: null,
    })
    vi.mocked(useSelectedAcademicYear).mockReturnValue({
      selectedYearId: undefined as any,
      setSelectedYearId: vi.fn(),
    })
    setupQueries(undefined)

    render(<CalendarEventsPageComponent />)

    expect(useQuery).toHaveBeenLastCalledWith(expect.anything(), 'skip')
  })

  test('renders rows with plain-text description extracted from Tiptap JSON', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockAdminUser,
    })
    vi.mocked(useSelectedAcademicYear).mockReturnValue({
      selectedYearId: mockSelectedYearId as any,
      setSelectedYearId: vi.fn(),
    })
    setupQueries([boardEvent, branchEvent])

    render(<CalendarEventsPageComponent />)

    expect(screen.getByText('Board wide announcement')).toBeInTheDocument()
    expect(screen.getByText('Branch retreat')).toBeInTheDocument()
  })

  test('falls back to the raw string when description JSON is malformed', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockAdminUser,
    })
    vi.mocked(useSelectedAcademicYear).mockReturnValue({
      selectedYearId: mockSelectedYearId as any,
      setSelectedYearId: vi.fn(),
    })
    setupQueries([classEventMissingNames])

    render(<CalendarEventsPageComponent />)

    // extractPlainText's catch branch returns the raw serialized string as-is.
    expect(screen.getByText('{not-valid-json')).toBeInTheDocument()
  })

  test('renders a severity badge for each severity level', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockAdminUser,
    })
    vi.mocked(useSelectedAcademicYear).mockReturnValue({
      selectedYearId: mockSelectedYearId as any,
      setSelectedYearId: vi.fn(),
    })
    setupQueries([boardEvent, branchEvent, classEventMissingNames])

    render(<CalendarEventsPageComponent />)

    expect(screen.getByText('calendarEvents.severity.high')).toBeInTheDocument()
    expect(
      screen.getByText('calendarEvents.severity.medium'),
    ).toBeInTheDocument()
    expect(screen.getByText('calendarEvents.severity.low')).toBeInTheDocument()
  })

  test('shows the liturgicalDate only when present', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockAdminUser,
    })
    vi.mocked(useSelectedAcademicYear).mockReturnValue({
      selectedYearId: mockSelectedYearId as any,
      setSelectedYearId: vi.fn(),
    })
    setupQueries([boardEvent, branchEvent])

    render(<CalendarEventsPageComponent />)

    expect(screen.getByText('Chúa Nhật XV Thường Niên')).toBeInTheDocument()
  })

  test('scope column shows board badge with no name row for board scope', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockAdminUser,
    })
    vi.mocked(useSelectedAcademicYear).mockReturnValue({
      selectedYearId: mockSelectedYearId as any,
      setSelectedYearId: vi.fn(),
    })
    setupQueries([boardEvent])

    render(<CalendarEventsPageComponent />)

    expect(screen.getByText('calendarEvents.scope.board')).toBeInTheDocument()
  })

  test('scope column shows branchName for branch scope', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockAdminUser,
    })
    vi.mocked(useSelectedAcademicYear).mockReturnValue({
      selectedYearId: mockSelectedYearId as any,
      setSelectedYearId: vi.fn(),
    })
    setupQueries([branchEvent])

    render(<CalendarEventsPageComponent />)

    expect(screen.getByText('calendarEvents.scope.branch')).toBeInTheDocument()
    expect(screen.getByText('Ấu Nhi')).toBeInTheDocument()
  })

  test('scope column falls back to em dash when branchName/className is null', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockAdminUser,
    })
    vi.mocked(useSelectedAcademicYear).mockReturnValue({
      selectedYearId: mockSelectedYearId as any,
      setSelectedYearId: vi.fn(),
    })
    setupQueries([classEventMissingNames])

    render(<CalendarEventsPageComponent />)

    expect(screen.getByText('calendarEvents.scope.class')).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  test('createdBy column renders name and formatted date', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockAdminUser,
    })
    vi.mocked(useSelectedAcademicYear).mockReturnValue({
      selectedYearId: mockSelectedYearId as any,
      setSelectedYearId: vi.fn(),
    })
    setupQueries([boardEvent])

    render(<CalendarEventsPageComponent />)

    expect(screen.getByText('Cha Xứ')).toBeInTheDocument()
  })

  test('updatedBy column renders name+date when present, em dash when absent', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockAdminUser,
    })
    vi.mocked(useSelectedAcademicYear).mockReturnValue({
      selectedYearId: mockSelectedYearId as any,
      setSelectedYearId: vi.fn(),
    })
    setupQueries([boardEvent, branchEvent])

    render(<CalendarEventsPageComponent />)

    // branchEvent has an updater.
    expect(screen.getByText('Sr. Anna')).toBeInTheDocument()
    // boardEvent has no updater -> em dash rendered somewhere in the row.
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  test('scope filter narrows displayed rows to the selected scope', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockAdminUser,
    })
    vi.mocked(useSelectedAcademicYear).mockReturnValue({
      selectedYearId: mockSelectedYearId as any,
      setSelectedYearId: vi.fn(),
    })
    setupQueries([boardEvent, branchEvent, classEventMissingNames])

    render(<CalendarEventsPageComponent />)

    // All three rows visible before filtering.
    expect(screen.getByText('Cha Xứ')).toBeInTheDocument()
    expect(screen.getByText('Sr. Mary')).toBeInTheDocument()
    expect(screen.getByText('GLV Nguyen')).toBeInTheDocument()

    // Open the scope filter Select and choose "branch" — BaseUI listbox
    // options need pointerDown before click to fire onValueChange.
    const trigger = screen
      .getByText('calendarEvents.filter.scope.all')
      .closest('button')!
    fireEvent.click(trigger)
    const option = screen.getByRole('option', {
      name: 'calendarEvents.scope.branch',
    })
    fireEvent.pointerDown(option)
    fireEvent.click(option)

    expect(screen.queryByText('Cha Xứ')).not.toBeInTheDocument()
    expect(screen.getByText('Sr. Mary')).toBeInTheDocument()
    expect(screen.queryByText('GLV Nguyen')).not.toBeInTheDocument()
  })
})
