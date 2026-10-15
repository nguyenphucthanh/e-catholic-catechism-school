import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { Route } from './attendance_.catechists'
import { useAuth } from '~/lib/auth'

const mockSearch = vi.hoisted(() => ({
  value: {},
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: vi.fn(() => (options: any) => ({
    options,
    useSearch: () => mockSearch.value,
  })),
}))

vi.mock('~/lib/academic-year', () => ({
  useSelectedAcademicYear: () => ({ selectedYearId: 'ay-1' }),
}))

const recordMock = vi.fn()
const deleteMock = vi.fn()

type Overrides = {
  yearActive?: boolean
  sessions?: Array<unknown> | undefined
  roster?: unknown
  meetings?: Array<unknown> | undefined
  meetingRoster?: unknown
}

const sessions = [
  { sessionId: 'sess-1', className: 'Class A', sessionType: 'catechism' },
  { sessionId: 'sess-2', className: 'Class B', sessionType: 'supplemental' },
]

const row = (over: Record<string, unknown>) => ({
  catechistId: 'cat-1',
  memberId: 'GLV1',
  fullName: 'Nguyen A',
  saintName: 'Maria',
  roleAtSession: 'homeroom',
  status: null,
  recordId: null,
  ...over,
})

const defaultRoster = {
  roster: [
    row({}),
    row({
      catechistId: 'cat-2',
      fullName: 'Tran B',
      saintName: 'Joseph',
      roleAtSession: 'co_teacher',
      status: 'late',
      recordId: 'rec-2',
    }),
  ],
  substitutes: [
    row({
      catechistId: 'cat-3',
      fullName: 'Le C',
      saintName: 'Anna',
      roleAtSession: 'substitute',
      status: 'present',
      recordId: 'rec-3',
    }),
  ],
  summary: {
    totalExpected: 2,
    present: 1,
    late: 1,
    excused: 0,
    unexcused: 0,
    unrecorded: 1,
  },
}

const meetings = [
  { meetingId: 'meet-1', title: 'Board meeting', scope: 'board' },
  { meetingId: 'meet-2', title: 'Branch meeting', scope: 'branch' },
]

const meetingRosterData = {
  roster: [
    row({
      catechistId: 'cat-5',
      fullName: 'Vo M',
      saintName: 'Paul',
      roleAtSession: 'attendee',
    }),
    row({
      catechistId: 'cat-6',
      fullName: 'Do N',
      saintName: 'Luke',
      roleAtSession: 'attendee',
      status: 'present',
      recordId: 'rec-6',
    }),
  ],
  substitutes: [],
  summary: {
    totalExpected: 2,
    present: 1,
    late: 0,
    excused: 0,
    unexcused: 0,
    unrecorded: 1,
  },
}

const allCatechists = [
  { _id: 'cat-1', saintName: 'Maria', fullName: 'Nguyen A' },
  { _id: 'cat-9', saintName: 'Peter', fullName: 'Pham Z' },
]

function mockQueries(o: Overrides = {}) {
  const sess = 'sessions' in o ? o.sessions : sessions
  const roster = 'roster' in o ? o.roster : defaultRoster
  vi.mocked(useQuery).mockImplementation((ref: any, args?: any) => {
    const path = ref?.[Symbol.for('functionName')]
    if (path === 'academicYears:getActiveYearContext')
      return {
        recentYears: [
          { _id: 'ay-1', name: '2024', isActive: o.yearActive ?? true },
        ],
      }
    if (path === 'catechistAttendance:listRecordableSessions') return sess
    if (path === 'catechistAttendance:getSessionAttendanceRoster')
      return args === 'skip' ? undefined : roster
    if (path === 'catechistMeetings:listRecordableMeetings')
      return args === 'skip'
        ? undefined
        : 'meetings' in o
          ? o.meetings
          : meetings
    if (path === 'catechistAttendance:getMeetingAttendanceRoster')
      return args === 'skip'
        ? undefined
        : 'meetingRoster' in o
          ? o.meetingRoster
          : meetingRosterData
    if (path === 'catechists:listAllActive')
      return args === 'skip' ? undefined : allCatechists
    return undefined
  })
  vi.mocked(useMutation).mockImplementation(((ref: any) => {
    const path = ref?.[Symbol.for('functionName')]
    if (path === 'catechistAttendance:recordAttendance') return recordMock
    if (path === 'catechistAttendance:deleteAttendanceRecord') return deleteMock
    return vi.fn()
  }) as any)
}

function renderPage() {
  const Component = (Route as any).options.component
  return render(<Component />)
}

const rowOf = (name: string) =>
  screen.getByText(name).closest('tr') as HTMLElement

const cardValue = (statusKey: string) =>
  screen
    .getAllByText(statusKey)
    .map((el) => el.closest('[data-slot="card"]'))
    .find(Boolean)!.lastElementChild!.lastElementChild!.textContent

describe('CatechistAttendancePage', () => {
  beforeEach(() => {
    mockSearch.value = {}
    mockQueries()
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: {
        userDocId: 'cat-admin',
        accountType: 'catechist',
        role: 'admin',
      } as any,
    })
    recordMock.mockReset().mockResolvedValue(undefined)
    deleteMock.mockReset().mockResolvedValue(undefined)
    vi.mocked(toast.success).mockClear()
    vi.mocked(toast.error).mockClear()
  })

  test('renders title, year badge, session select and roster incl. substitutes', () => {
    renderPage()
    expect(screen.getByText('catechistAttendance.title')).toBeInTheDocument()
    expect(
      screen.getByText(/2024.*catechistAttendance\.yearActive/),
    ).toBeInTheDocument()
    expect(screen.getByText('Class A')).toBeInTheDocument()
    expect(screen.getByText('Maria Nguyen A')).toBeInTheDocument()
    expect(screen.getByText('Joseph Tran B')).toBeInTheDocument()
    expect(screen.getByText('Anna Le C')).toBeInTheDocument()
    expect(
      screen.getByText('catechistAttendance.role.substitute'),
    ).toBeInTheDocument()
  })

  test('skips queries when the user is not a catechist', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: { accountType: 'guardian' } as any,
    })
    renderPage()
    expect(useQuery).toHaveBeenCalledWith(expect.anything(), 'skip')
    expect(screen.queryByText('Maria Nguyen A')).not.toBeInTheDocument()
  })

  test('selecting another session switches the roster query target', async () => {
    renderPage()
    fireEvent.click(screen.getAllByRole('combobox')[1])
    const option = await screen.findByRole('option', { name: /Class B/ })
    fireEvent.pointerDown(option)
    fireEvent.click(option)
    await waitFor(() => {
      const calls = vi
        .mocked(useQuery)
        .mock.calls.filter(
          ([ref]: any) =>
            ref?.[Symbol.for('functionName')] ===
            'catechistAttendance:getSessionAttendanceRoster',
        )
      expect(calls[calls.length - 1][1]).toMatchObject({ sessionId: 'sess-2' })
    })
  })

  test('clicking a status records manual attendance', async () => {
    renderPage()
    fireEvent.click(
      within(rowOf('Maria Nguyen A')).getByRole('button', {
        name: 'attendance.status.present',
      }),
    )
    await waitFor(() => expect(recordMock).toHaveBeenCalledTimes(1))
    expect(recordMock).toHaveBeenCalledWith({
      requesterId: 'cat-admin',
      sessionId: 'sess-1',
      catechistId: 'cat-1',
      status: 'present',
      checkInMethod: 'manual',
      roleAtSession: undefined,
    })
    expect(deleteMock).not.toHaveBeenCalled()
  })

  test('changing a substitute row status keeps the substitute role', async () => {
    renderPage()
    fireEvent.click(
      within(rowOf('Anna Le C')).getByRole('button', {
        name: 'attendance.status.late',
      }),
    )
    await waitFor(() =>
      expect(recordMock).toHaveBeenCalledWith(
        expect.objectContaining({
          catechistId: 'cat-3',
          status: 'late',
          roleAtSession: 'substitute',
        }),
      ),
    )
  })

  test('clicking the active status deletes the record', async () => {
    renderPage()
    const btn = within(rowOf('Joseph Tran B')).getByRole('button', {
      name: 'attendance.status.late',
    })
    expect(btn).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(btn)
    await waitFor(() =>
      expect(deleteMock).toHaveBeenCalledWith({
        requesterId: 'cat-admin',
        recordId: 'rec-2',
      }),
    )
    expect(recordMock).not.toHaveBeenCalled()
    expect(toast.success).toHaveBeenCalledWith('catechistAttendance.cleared')
  })

  test('shows summary counts and the unrecorded card', () => {
    renderPage()
    expect(cardValue('attendance.status.present')).toBe('1')
    expect(cardValue('attendance.status.late')).toBe('1')
    expect(cardValue('attendance.status.excused_absence')).toBe('0')
    expect(cardValue('attendance.status.unexcused_absence')).toBe('0')
    expect(cardValue('catechistAttendance.summary.unrecorded')).toBe('1')
  })

  test('hides the unrecorded card when unrecorded is null', () => {
    mockQueries({
      roster: {
        ...defaultRoster,
        summary: { ...defaultRoster.summary, unrecorded: null },
      },
    })
    renderPage()
    expect(
      screen.queryByText('catechistAttendance.summary.unrecorded'),
    ).not.toBeInTheDocument()
    expect(cardValue('attendance.status.present')).toBe('1')
  })

  test('locked year disables status buttons and substitute action and shows alert', () => {
    mockQueries({ yearActive: false })
    renderPage()
    expect(
      screen.getByText('catechistAttendance.lockedNotice'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/catechistAttendance\.yearLocked/),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('catechistAttendance.addSubstitute'),
    ).not.toBeInTheDocument()
    const buttons = within(rowOf('Maria Nguyen A')).getAllByRole('button', {
      name: /attendance\.status\./,
    })
    expect(buttons).toHaveLength(4)
    buttons.forEach((b) => expect(b).toBeDisabled())
    fireEvent.click(buttons[0])
    expect(recordMock).not.toHaveBeenCalled()
  })

  test('shows empty state when there are no sessions', () => {
    mockQueries({ sessions: [], roster: undefined })
    renderPage()
    expect(
      screen.getByText('catechistAttendance.noSessions'),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('catechistAttendance.addSubstitute'),
    ).not.toBeInTheDocument()
  })

  test('shows a Sonner error toast when recording fails', async () => {
    recordMock.mockRejectedValue(new Error('boom'))
    renderPage()
    fireEvent.click(
      within(rowOf('Maria Nguyen A')).getByRole('button', {
        name: 'attendance.status.present',
      }),
    )
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('common.error'),
    )
  })

  test('shows a Sonner error toast when clearing fails', async () => {
    deleteMock.mockRejectedValue(new Error('boom'))
    renderPage()
    fireEvent.click(
      within(rowOf('Joseph Tran B')).getByRole('button', {
        name: 'attendance.status.late',
      }),
    )
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(toast.success).not.toHaveBeenCalled()
  })

  describe('substitute dialog', () => {
    async function openCombobox() {
      renderPage()
      fireEvent.click(screen.getByText('catechistAttendance.addSubstitute'))
      const input = await screen.findByPlaceholderText(
        'catechistAttendance.substitutePlaceholder',
      )
      fireEvent.mouseDown(input)
      return input
    }

    test('excludes catechists already in the table and records the pick as present substitute', async () => {
      await openCombobox()
      const option = await screen.findByText('Peter Pham Z')
      // cat-1 is already in the roster -> not offered
      expect(
        screen.queryByRole('option', { name: 'Maria Nguyen A' }),
      ).not.toBeInTheDocument()
      fireEvent.pointerDown(option)
      fireEvent.click(option)
      await waitFor(() => expect(recordMock).toHaveBeenCalledTimes(1))
      expect(recordMock).toHaveBeenCalledWith({
        requesterId: 'cat-admin',
        sessionId: 'sess-1',
        catechistId: 'cat-9',
        status: 'present',
        roleAtSession: 'substitute',
        checkInMethod: 'manual',
      })
      await waitFor(() =>
        expect(toast.success).toHaveBeenCalledWith(
          'catechistAttendance.recorded',
        ),
      )
    })

    test('shows an error toast and stays open when the substitute save fails', async () => {
      recordMock.mockRejectedValue(new Error('boom'))
      await openCombobox()
      const option = await screen.findByText('Peter Pham Z')
      fireEvent.pointerDown(option)
      fireEvent.click(option)
      await waitFor(() => expect(toast.error).toHaveBeenCalled())
      expect(toast.success).not.toHaveBeenCalled()
      expect(
        screen.getByText('catechistAttendance.substituteDescription'),
      ).toBeInTheDocument()
    })
  })

  describe('meeting mode', () => {
    const lastCall = (path: string) => {
      const calls = vi
        .mocked(useQuery)
        .mock.calls.filter(
          ([ref]: any) => ref?.[Symbol.for('functionName')] === path,
        )
      return calls[calls.length - 1]
    }

    async function switchToMeetings() {
      renderPage()
      fireEvent.click(screen.getAllByRole('combobox')[0])
      const option = await screen.findByRole('option', {
        name: 'catechistAttendance.category.meeting',
      })
      fireEvent.pointerDown(option)
      fireEvent.click(option)
      await screen.findByText('Paul Vo M')
    }

    test('category select switches to meetings and the meeting list drives the roster', async () => {
      await switchToMeetings()
      expect(lastCall('catechistMeetings:listRecordableMeetings')[1]).toEqual({
        requesterId: 'cat-admin',
        academicYearId: 'ay-1',
        date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      })
      expect(
        lastCall('catechistAttendance:getMeetingAttendanceRoster')[1],
      ).toEqual({
        requesterId: 'cat-admin',
        meetingId: 'meet-1',
      })
      expect(screen.getByText('Luke Do N')).toBeInTheDocument()
      expect(screen.queryByText('Maria Nguyen A')).not.toBeInTheDocument()
      expect(lastCall('catechistAttendance:listRecordableSessions')[1]).toBe(
        'skip',
      )
      expect(
        screen.getByText('catechistAttendance.meeting'),
      ).toBeInTheDocument()
    })

    test('picking another meeting switches the roster target', async () => {
      await switchToMeetings()
      fireEvent.click(screen.getAllByRole('combobox')[1])
      const option = await screen.findByRole('option', {
        name: 'Branch meeting',
      })
      fireEvent.pointerDown(option)
      fireEvent.click(option)
      await waitFor(() =>
        expect(
          lastCall('catechistAttendance:getMeetingAttendanceRoster')[1],
        ).toMatchObject({ meetingId: 'meet-2' }),
      )
    })

    test('status click records with the meeting id and no sessionId', async () => {
      await switchToMeetings()
      fireEvent.click(
        within(rowOf('Paul Vo M')).getByRole('button', {
          name: 'attendance.status.excused_absence',
        }),
      )
      await waitFor(() => expect(recordMock).toHaveBeenCalledTimes(1))
      expect(recordMock).toHaveBeenCalledWith({
        requesterId: 'cat-admin',
        meetingId: 'meet-1',
        catechistId: 'cat-5',
        status: 'excused_absence',
        checkInMethod: 'manual',
        roleAtSession: undefined,
      })
    })

    test('clicking the active status clears the record', async () => {
      await switchToMeetings()
      fireEvent.click(
        within(rowOf('Luke Do N')).getByRole('button', {
          name: 'attendance.status.present',
        }),
      )
      await waitFor(() =>
        expect(deleteMock).toHaveBeenCalledWith({
          requesterId: 'cat-admin',
          recordId: 'rec-6',
        }),
      )
      expect(recordMock).not.toHaveBeenCalled()
    })

    test('has no substitute action', async () => {
      await switchToMeetings()
      expect(
        screen.queryByText('catechistAttendance.addSubstitute'),
      ).not.toBeInTheDocument()
    })

    test('locked year makes the meeting roster read-only', async () => {
      mockQueries({ yearActive: false })
      await switchToMeetings()
      const buttons = within(rowOf('Paul Vo M')).getAllByRole('button', {
        name: /attendance\.status\./,
      })
      buttons.forEach((b) => expect(b).toBeDisabled())
      fireEvent.click(buttons[0])
      expect(recordMock).not.toHaveBeenCalled()
      expect(
        screen.getByText('catechistAttendance.lockedNotice'),
      ).toBeInTheDocument()
    })

    test('shows the no-meetings empty state', async () => {
      mockQueries({ meetings: [], meetingRoster: undefined })
      renderPage()
      fireEvent.click(screen.getAllByRole('combobox')[0])
      const option = await screen.findByRole('option', {
        name: 'catechistAttendance.category.meeting',
      })
      fireEvent.pointerDown(option)
      fireEvent.click(option)
      expect(
        await screen.findByText('catechistAttendance.noMeetings'),
      ).toBeInTheDocument()
    })

    test('deep link search params preselect category, date and meeting', () => {
      mockSearch.value = {
        category: 'meeting',
        date: '2024-10-21',
        meetingId: 'meet-2',
      }
      renderPage()
      expect(screen.getByText('Paul Vo M')).toBeInTheDocument()
      expect(
        lastCall('catechistMeetings:listRecordableMeetings')[1],
      ).toMatchObject({
        date: '2024-10-21',
      })
      expect(
        lastCall('catechistAttendance:getMeetingAttendanceRoster')[1],
      ).toEqual({
        requesterId: 'cat-admin',
        meetingId: 'meet-2',
      })
    })
  })
})
