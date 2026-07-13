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
import { AttendanceGridBoard } from './attendance-grid-board'
import type { Id } from '../../../convex/_generated/dataModel'
import { exportCsv } from '~/lib/export'

vi.mock('~/lib/export', () => ({
  exportCsv: vi.fn(),
}))

const classId = 'class1' as Id<'classes'>
const academicYearId = 'year1' as Id<'academicYears'>
const requesterId = 'catechist1' as Id<'catechists'>

const studentClassId1 = 'sc1' as Id<'studentClasses'>
const studentClassId2 = 'sc2' as Id<'studentClasses'>
const studentId1 = 'student1' as Id<'students'>
const studentId2 = 'student2' as Id<'students'>
const sessionId1 = 'session1' as Id<'classSessions'>
const sessionId2 = 'session2' as Id<'classSessions'>

interface GridDataOverrides {
  students?: Array<{
    studentClassId: Id<'studentClasses'>
    studentId: Id<'students'>
    fullName: string
    saintName: string | null
    studentCode: string
  }>
  sessions?: Array<{
    _id: Id<'classSessions'>
    sessionDate: string
    isCancelled: boolean
    notes?: string
    semesterId?: Id<'semesters'>
  }>
  attendanceMap?: Record<string, { status: string; notes?: string }>
}

function makeGridData(overrides: GridDataOverrides = {}) {
  return {
    students: [
      {
        studentClassId: studentClassId1,
        studentId: studentId1,
        fullName: 'Nguyen Van A',
        saintName: 'Peter' as string | null,
        studentCode: 'STU001',
      },
      {
        studentClassId: studentClassId2,
        studentId: studentId2,
        fullName: 'Tran Thi B',
        saintName: null as string | null,
        studentCode: 'STU002',
      },
    ],
    // NOTE: default dateOrder is 'desc' (newest first), so with these two
    // sessions the DEFAULT rendered order is session2 (06-14) then
    // session1 (06-07) -- the reverse of this array's declaration order.
    sessions: [
      { _id: sessionId1, sessionDate: '2026-06-07', isCancelled: false },
      { _id: sessionId2, sessionDate: '2026-06-14', isCancelled: false },
    ],
    attendanceMap: {
      sc1_session1: { status: 'present', notes: 'On time' },
    } as Record<string, { status: string; notes?: string }>,
    ...overrides,
  }
}

/** Branches useQuery by Convex function path so gridData and semesters can differ. */
function mockQueries(
  gridData: ReturnType<typeof makeGridData>,
  semesters: Array<{
    _id: Id<'semesters'>
    name: string
    semesterNumber: number
  }>,
) {
  vi.mocked(useQuery).mockImplementation(((queryRef: any) => {
    const path = queryRef?.[Symbol.for('functionName')]
    if (path === 'attendance:getAttendanceGrid') return gridData
    if (path === 'appConfig:get') return undefined
    if (path === 'academicYears:listSemesters') return semesters
    return undefined
  }) as any)
}

function renderBoard(canManage = true) {
  return render(
    <AttendanceGridBoard
      classId={classId}
      academicYearId={academicYearId}
      requesterId={requesterId}
      canManage={canManage}
    />,
  )
}

/** Opens the attendance popover for the given student's Nth visible cell (DOM order) and returns the row. */
function openPopoverForStudent(studentCode: string, cellIndex = 0) {
  const row = screen
    .getByText(`students.col.studentCode: ${studentCode}`)
    .closest('tr')!
  const triggers = within(row).getAllByRole('button')
  fireEvent.click(triggers[cellIndex])
  return row
}

/** Opens the SessionActionsPopover by clicking the date-header cell showing the given day-of-month text (e.g. '07'). */
function openSessionPopover(dayText: string) {
  const trigger = screen.getByText(dayText).closest('button')!
  fireEvent.click(trigger)
  return trigger
}

/** Returns the day-of-month header text nodes in DOM order (reflects current sort order). */
function getHeaderDayOrder(container: HTMLElement, rowIndex = 2) {
  return Array.from(
    container.querySelectorAll(
      `thead tr:nth-child(${rowIndex}) button > div:first-child`,
    ),
  ).map((el) => el.textContent)
}

/** Finds the open confirmation AlertDialog and clicks its confirm ("common.save") action button. */
function confirmDialog(name = 'common.save') {
  const dialog = screen.getByRole('alertdialog')
  fireEvent.click(within(dialog).getByRole('button', { name }))
}

describe('AttendanceGridBoard', () => {
  let saveAttendanceMock: ReturnType<typeof vi.fn>
  let updateSessionMock: ReturnType<typeof vi.fn>
  let deleteSessionMock: ReturnType<typeof vi.fn>
  let bulkSaveMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.mocked(useQuery).mockReset()
    vi.mocked(useMutation).mockReset()

    saveAttendanceMock = vi.fn().mockResolvedValue(undefined)
    updateSessionMock = vi.fn().mockResolvedValue(undefined)
    deleteSessionMock = vi.fn().mockResolvedValue(undefined)
    bulkSaveMock = vi.fn().mockResolvedValue(undefined)

    // The component now calls useMutation for four distinct mutations per
    // render. Branch on the Convex function reference's registered path
    // (via the global `functionName` symbol) to return a distinct spy per
    // mutation -- see .claude/agent-memory/unit-test-writer for the pattern.
    vi.mocked(useMutation).mockImplementation(((fnRef: any) => {
      const path = fnRef?.[Symbol.for('functionName')]
      if (path === 'attendance:saveGridAttendance') return saveAttendanceMock
      if (path === 'classSessions:update') return updateSessionMock
      if (path === 'classSessions:softDelete') return deleteSessionMock
      if (path === 'attendance:bulkSaveGridAttendance') return bulkSaveMock
      return vi.fn().mockResolvedValue(undefined)
    }) as any)

    vi.mocked(toast.success).mockClear()
    vi.mocked(toast.error).mockClear()
    vi.mocked(exportCsv).mockClear()
  })

  describe('loading state', () => {
    test('renders a skeleton placeholder while grid data has not loaded', () => {
      vi.mocked(useQuery).mockReturnValue(undefined)
      const { container } = renderBoard()

      expect(
        container.querySelector('[data-slot="skeleton"]'),
      ).toBeInTheDocument()
      expect(screen.queryByRole('table')).not.toBeInTheDocument()
    })
  })

  describe('empty state', () => {
    test('renders a "no students" message when the class has no enrolled students', () => {
      vi.mocked(useQuery).mockReturnValue({
        students: [],
        sessions: [],
        attendanceMap: {},
      })
      renderBoard()

      expect(screen.getByText('attendance.grid.noStudents')).toBeInTheDocument()
      expect(screen.queryByRole('table')).not.toBeInTheDocument()
    })
  })

  describe('rendering with attendance data', () => {
    test('renders student names (with saint name prefix when present) and student codes', () => {
      vi.mocked(useQuery).mockReturnValue(makeGridData())
      renderBoard()

      expect(screen.getByText('Peter Nguyen Van A')).toBeInTheDocument()
      expect(
        screen.getByText('students.col.studentCode: STU001'),
      ).toBeInTheDocument()
      // No saint name -> fullName rendered alone
      expect(screen.getByText('Tran Thi B')).toBeInTheDocument()
      expect(
        screen.getByText('students.col.studentCode: STU002'),
      ).toBeInTheDocument()
    })

    test('renders month-year group header and day/weekday headers for each session', () => {
      vi.mocked(useQuery).mockReturnValue(makeGridData())
      renderBoard()

      expect(screen.getByText('Jun 2026')).toBeInTheDocument()
      expect(screen.getByText('07')).toBeInTheDocument()
      expect(screen.getByText('14')).toBeInTheDocument()
      expect(screen.getAllByText('Sun')).toHaveLength(2)
    })

    test('groups sessions spanning multiple months into separate header columns with correct colSpan', () => {
      const data = makeGridData({
        sessions: [
          { _id: sessionId1, sessionDate: '2026-05-03', isCancelled: false },
          { _id: sessionId2, sessionDate: '2026-05-10', isCancelled: false },
          {
            _id: 'session3' as Id<'classSessions'>,
            sessionDate: '2026-06-07',
            isCancelled: false,
          },
        ],
        attendanceMap: {},
      })
      vi.mocked(useQuery).mockReturnValue(data)
      renderBoard()

      // Order-independent: colSpan is attributed per group regardless of
      // which month-year group renders first in DOM.
      expect(screen.getByText('May 2026')).toHaveAttribute('colspan', '2')
      expect(screen.getByText('Jun 2026')).toHaveAttribute('colspan', '1')
    })
  })

  describe('semester grouping', () => {
    const semesterId1 = 'sem1' as Id<'semesters'>
    const semesterId2 = 'sem2' as Id<'semesters'>

    test("renders a semester header row with colSpan matching each semester's session count", () => {
      const data = makeGridData({
        sessions: [
          {
            _id: sessionId1,
            sessionDate: '2026-01-11',
            isCancelled: false,
            semesterId: semesterId1,
          },
          {
            _id: sessionId2,
            sessionDate: '2026-01-18',
            isCancelled: false,
            semesterId: semesterId1,
          },
          {
            _id: 'session3' as Id<'classSessions'>,
            sessionDate: '2026-08-02',
            isCancelled: false,
            semesterId: semesterId2,
          },
        ],
        attendanceMap: {},
      })
      mockQueries(data, [
        { _id: semesterId1, name: 'HK1', semesterNumber: 1 },
        { _id: semesterId2, name: 'HK2', semesterNumber: 2 },
      ])
      renderBoard()

      expect(screen.getByText('HK1')).toHaveAttribute('colspan', '2')
      expect(screen.getByText('HK2')).toHaveAttribute('colspan', '1')
    })

    test('sorts and groups sessions by semester order rather than raw date order', () => {
      // session3 (HK2, earlier calendar date) is declared before session1
      // (HK1, later calendar date) -- semester order must win over date.
      const data = makeGridData({
        sessions: [
          {
            _id: 'session3' as Id<'classSessions'>,
            sessionDate: '2026-01-05',
            isCancelled: false,
            semesterId: semesterId2,
          },
          {
            _id: sessionId1,
            sessionDate: '2026-08-02',
            isCancelled: false,
            semesterId: semesterId1,
          },
        ],
        attendanceMap: {},
      })
      mockQueries(data, [
        { _id: semesterId1, name: 'HK1', semesterNumber: 1 },
        { _id: semesterId2, name: 'HK2', semesterNumber: 2 },
      ])
      const { container } = renderBoard()

      // Row structure with semester grouping: semester row, month-year row,
      // day/date row (day headers now on the 3rd header row).
      const dayHeaders = getHeaderDayOrder(container, 3)
      expect(dayHeaders).toEqual(['02', '05'])
    })

    test('does not render a semester header row when the class has no semesters', () => {
      vi.mocked(useQuery).mockReturnValue(makeGridData())
      const { container } = renderBoard()

      expect(container.querySelectorAll('thead tr')).toHaveLength(2)
    })
  })

  describe('grid structure and cell content', () => {
    test('renders one row per student and one cell per student/session pairing', () => {
      vi.mocked(useQuery).mockReturnValue(makeGridData())
      const { container } = renderBoard()

      const table = container.querySelector('table')!
      const bodyRows = within(table.querySelector('tbody')!).getAllByRole('row')
      expect(bodyRows).toHaveLength(2)

      const cells = within(table).getAllByRole('cell')
      // 2 students * (1 name cell + 2 session cells) = 6
      expect(cells).toHaveLength(6)
    })

    test('renders a disabled, visually distinct trigger for cancelled sessions', () => {
      const data = makeGridData({
        sessions: [
          { _id: sessionId1, sessionDate: '2026-06-07', isCancelled: true },
        ],
        attendanceMap: {},
      })
      vi.mocked(useQuery).mockReturnValue(data)
      const { container } = renderBoard()

      const row = screen
        .getByText('students.col.studentCode: STU001')
        .closest('tr')!
      const trigger = within(row).getAllByRole('button')[0]
      expect(trigger).toBeDisabled()

      const cancelledCell = container.querySelector('.line-through')
      expect(cancelledCell).toBeInTheDocument()
      expect(cancelledCell).toHaveClass('opacity-50')
    })

    test('does not render an editable popover for a cancelled session', () => {
      const data = makeGridData({
        sessions: [
          { _id: sessionId1, sessionDate: '2026-06-07', isCancelled: true },
        ],
        attendanceMap: {},
      })
      vi.mocked(useQuery).mockReturnValue(data)
      renderBoard()

      openPopoverForStudent('STU001')
      expect(
        screen.queryByText('attendance.popover.title'),
      ).not.toBeInTheDocument()
    })
  })

  describe('status icon display and styling', () => {
    test.each([
      ['present', 'text-green-600'],
      ['late', 'text-yellow-500'],
      ['excused_absence', 'text-purple-500'],
      ['unexcused_absence', 'text-red-500'],
    ])(
      'renders the %s status with its distinct icon color class',
      (status, colorClass) => {
        const data = makeGridData({
          attendanceMap: { sc1_session1: { status, notes: undefined } },
        })
        vi.mocked(useQuery).mockReturnValue(data)
        const { container } = renderBoard()

        expect(container.querySelector(`.${colorClass}`)).toBeInTheDocument()
      },
    )

    test('renders the unset/gray icon for cells with no attendance record', () => {
      const data = makeGridData({ attendanceMap: {} })
      vi.mocked(useQuery).mockReturnValue(data)
      const { container } = renderBoard()

      // 2 students * 2 sessions = 4 unset cells
      expect(container.querySelectorAll('.text-gray-400')).toHaveLength(4)
    })
  })

  describe('edit mode interactions', () => {
    test('opens the attendance popover with the current status highlighted', () => {
      vi.mocked(useQuery).mockReturnValue(makeGridData())
      renderBoard()

      // Default dateOrder is 'desc': cell index 0 is session2 (06-14, no
      // record), cell index 1 is session1 (06-07, the 'present' record).
      openPopoverForStudent('STU001', 1)

      expect(screen.getByText('attendance.popover.title')).toBeInTheDocument()
      const presentBtn = screen.getByRole('button', {
        name: 'attendance.status.present',
      })
      expect(presentBtn.className).toMatch(/border-2/)
    })

    test('toggles the highlighted status when a different status button is clicked', () => {
      vi.mocked(useQuery).mockReturnValue(makeGridData())
      renderBoard()

      // See note above: cell index 1 holds session1's 'present' record
      // under the default (desc) sort order.
      openPopoverForStudent('STU001', 1)

      const presentBtn = screen.getByRole('button', {
        name: 'attendance.status.present',
      })
      const lateBtn = screen.getByRole('button', {
        name: 'attendance.status.late',
      })

      expect(presentBtn.className).toMatch(/border-2/)
      fireEvent.click(lateBtn)

      expect(lateBtn.className).toMatch(/border-2/)
      expect(presentBtn.className).not.toMatch(/border-2/)
    })

    test('defaults the selected status to "unset" when the cell has no existing record', () => {
      const data = makeGridData({ attendanceMap: {} })
      vi.mocked(useQuery).mockReturnValue(data)
      renderBoard()

      openPopoverForStudent('STU001')

      // None of the four selectable status buttons (unset is excluded) should be highlighted
      for (const status of [
        'present',
        'late',
        'excused_absence',
        'unexcused_absence',
      ]) {
        const btn = screen.getByRole('button', {
          name: `attendance.status.${status}`,
        })
        expect(btn.className).not.toMatch(/border-2/)
      }
    })
  })

  describe('note input behavior', () => {
    test('pre-fills the notes textarea with the existing record note', () => {
      vi.mocked(useQuery).mockReturnValue(makeGridData())
      renderBoard()

      // Cell index 1 holds session1's record ('On time') under the
      // default (desc) sort order -- see makeGridData()'s comment.
      openPopoverForStudent('STU001', 1)

      const textarea = screen.getByPlaceholderText(
        'attendance.popover.notesPlaceholder',
      )
      expect(textarea).toHaveValue('On time')
    })

    test('renders an empty textarea when the cell has no existing notes', () => {
      const data = makeGridData({
        attendanceMap: {
          sc1_session1: { status: 'present', notes: undefined },
        },
      })
      vi.mocked(useQuery).mockReturnValue(data)
      renderBoard()

      openPopoverForStudent('STU001', 1)

      const textarea = screen.getByPlaceholderText(
        'attendance.popover.notesPlaceholder',
      )
      expect(textarea).toHaveValue('')
    })

    test('updates the textarea value as the user types', () => {
      vi.mocked(useQuery).mockReturnValue(makeGridData())
      renderBoard()

      openPopoverForStudent('STU001')

      const textarea = screen.getByPlaceholderText(
        'attendance.popover.notesPlaceholder',
      )
      fireEvent.change(textarea, { target: { value: 'Left early' } })
      expect(textarea).toHaveValue('Left early')
    })
  })

  describe('save/cancel button interactions', () => {
    test('saves the selected status and notes when Save is clicked', async () => {
      vi.mocked(useQuery).mockReturnValue(makeGridData())
      renderBoard()

      // Cell index 1 is session1 under the default (desc) sort order.
      openPopoverForStudent('STU001', 1)

      fireEvent.click(
        screen.getByRole('button', { name: 'attendance.status.late' }),
      )
      fireEvent.change(
        screen.getByPlaceholderText('attendance.popover.notesPlaceholder'),
        { target: { value: 'Left early' } },
      )
      fireEvent.click(
        screen.getByRole('button', { name: 'attendance.popover.saveBtn' }),
      )

      await waitFor(() =>
        expect(saveAttendanceMock).toHaveBeenCalledWith({
          requesterId,
          sessionId: sessionId1,
          studentId: studentId1,
          status: 'late',
          notes: 'Left early',
        }),
      )
      await waitFor(() => expect(toast.success).toHaveBeenCalled())
    })

    test('sends undefined status and notes when the Clear button is clicked', async () => {
      vi.mocked(useQuery).mockReturnValue(makeGridData())
      renderBoard()

      // Cell index 1 is session1 under the default (desc) sort order.
      openPopoverForStudent('STU001', 1)

      fireEvent.click(
        screen.getByRole('button', { name: 'attendance.popover.clearBtn' }),
      )

      await waitFor(() =>
        expect(saveAttendanceMock).toHaveBeenCalledWith({
          requesterId,
          sessionId: sessionId1,
          studentId: studentId1,
          status: undefined,
          notes: undefined,
        }),
      )
    })

    test('shows an error toast and logs the error when saving fails', async () => {
      saveAttendanceMock.mockRejectedValueOnce(new Error('network error'))
      vi.mocked(useQuery).mockReturnValue(makeGridData())
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      renderBoard()
      openPopoverForStudent('STU001')
      fireEvent.click(
        screen.getByRole('button', { name: 'attendance.popover.saveBtn' }),
      )

      await waitFor(() => expect(toast.error).toHaveBeenCalled())
      expect(consoleErrorSpy).toHaveBeenCalled()
      expect(toast.success).not.toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })

    test('disables the save button while the save request is in flight', async () => {
      let resolveSave: () => void = () => {}
      const savePromise = new Promise<void>((resolve) => {
        resolveSave = resolve
      })
      saveAttendanceMock.mockReturnValueOnce(savePromise)
      vi.mocked(useQuery).mockReturnValue(makeGridData())

      renderBoard()
      openPopoverForStudent('STU001')

      const saveBtn = screen.getByRole('button', {
        name: 'attendance.popover.saveBtn',
      })
      fireEvent.click(saveBtn)

      expect(saveBtn).toBeDisabled()

      resolveSave()
      await waitFor(() => expect(saveAttendanceMock).toHaveBeenCalledTimes(1))
    })
  })

  describe('sticky header and scrolling behavior', () => {
    test('applies sticky positioning to the student-name column header', () => {
      vi.mocked(useQuery).mockReturnValue(makeGridData())
      renderBoard()

      const headers = screen.getAllByRole('columnheader')
      expect(headers[0]).toHaveClass('sticky', 'left-0', 'top-0')
    })

    test('applies sticky top positioning to the month-year group header', () => {
      vi.mocked(useQuery).mockReturnValue(makeGridData())
      renderBoard()

      expect(screen.getByText('Jun 2026')).toHaveClass('sticky', 'top-0')
    })

    test('wraps the table in a scrollable, height-constrained container', () => {
      vi.mocked(useQuery).mockReturnValue(makeGridData())
      const { container } = renderBoard()

      const scrollContainer = container.querySelector('.overflow-auto')
      expect(scrollContainer).toBeInTheDocument()
      expect(scrollContainer).toHaveClass('flex-1', 'min-w-0')

      const outerWrapper = container
        .querySelector('table')
        ?.closest('.rounded-lg.border')
      expect(outerWrapper).toHaveStyle({ overflow: 'hidden' })
    })
  })

  describe('type safety for attendance status values', () => {
    test('renders every known attendance status without falling back to the unset icon', () => {
      const statuses = [
        'present',
        'late',
        'excused_absence',
        'unexcused_absence',
      ] as const

      for (const status of statuses) {
        const data = makeGridData({
          attendanceMap: { sc1_session1: { status, notes: undefined } },
        })
        vi.mocked(useQuery).mockReturnValue(data)
        const { container, unmount } = renderBoard()

        expect(container.querySelector('.text-gray-400')).not.toBeNull() // sc2's cell for the same session is still unset
        // The specifically-set cell (sc1/session1) must not use the unset
        // color. Cell index 1 is session1 under the default (desc) order.
        const row = screen
          .getByText('students.col.studentCode: STU001')
          .closest('tr')!
        const firstCellIcon = within(row)
          .getAllByRole('button')[1]
          .querySelector('svg')
        expect(firstCellIcon).not.toHaveClass('text-gray-400')

        unmount()
      }
    })

    test('treats an unrecognized status value as "unset" rather than throwing', () => {
      const data = makeGridData({
        attendanceMap: {
          // Simulates a record whose status doesn't match a known AttendanceStatus key
          sc1_session1: { status: 'unset', notes: undefined },
        },
      })
      vi.mocked(useQuery).mockReturnValue(data)

      expect(() => renderBoard()).not.toThrow()
      // Cell index 1 is session1 (the cell whose record has the
      // unrecognized status) under the default (desc) sort order.
      const row = screen
        .getByText('students.col.studentCode: STU001')
        .closest('tr')!
      const firstCellIcon = within(row)
        .getAllByRole('button')[1]
        .querySelector('svg')
      expect(firstCellIcon).toHaveClass('text-gray-400')
    })
  })

  describe('toolbar controls', () => {
    test('"Hide Cancelled" hides the cancelled session column and swaps the button label to "Show Cancelled"', () => {
      const data = makeGridData({
        sessions: [
          { _id: sessionId1, sessionDate: '2026-06-07', isCancelled: false },
          { _id: sessionId2, sessionDate: '2026-06-14', isCancelled: true },
        ],
      })
      vi.mocked(useQuery).mockReturnValue(data)
      renderBoard()

      expect(screen.getByText('14')).toBeInTheDocument()
      expect(
        screen.getByRole('button', {
          name: 'attendance.grid.toolbar.hideCancelled',
        }),
      ).toBeInTheDocument()

      fireEvent.click(
        screen.getByRole('button', {
          name: 'attendance.grid.toolbar.hideCancelled',
        }),
      )

      expect(screen.queryByText('14')).not.toBeInTheDocument()
      expect(screen.getByText('07')).toBeInTheDocument()
      expect(
        screen.getByRole('button', {
          name: 'attendance.grid.toolbar.showCancelled',
        }),
      ).toBeInTheDocument()
    })

    test('toggling "Show Cancelled" back restores the cancelled session column', () => {
      const data = makeGridData({
        sessions: [
          { _id: sessionId1, sessionDate: '2026-06-07', isCancelled: false },
          { _id: sessionId2, sessionDate: '2026-06-14', isCancelled: true },
        ],
      })
      vi.mocked(useQuery).mockReturnValue(data)
      renderBoard()

      fireEvent.click(
        screen.getByRole('button', {
          name: 'attendance.grid.toolbar.hideCancelled',
        }),
      )
      expect(screen.queryByText('14')).not.toBeInTheDocument()

      fireEvent.click(
        screen.getByRole('button', {
          name: 'attendance.grid.toolbar.showCancelled',
        }),
      )
      expect(screen.getByText('14')).toBeInTheDocument()
      expect(
        screen.getByRole('button', {
          name: 'attendance.grid.toolbar.hideCancelled',
        }),
      ).toBeInTheDocument()
    })

    test('"Sort Order" reverses header column order between newest-first and oldest-first', () => {
      vi.mocked(useQuery).mockReturnValue(makeGridData())
      const { container } = renderBoard()

      // Default dateOrder is 'desc' -> newest session (06-14) first.
      expect(getHeaderDayOrder(container)).toEqual(['14', '07'])
      expect(
        screen.getByRole('button', {
          name: 'attendance.grid.toolbar.newestFirst',
        }),
      ).toBeInTheDocument()

      fireEvent.click(
        screen.getByRole('button', {
          name: 'attendance.grid.toolbar.newestFirst',
        }),
      )

      expect(getHeaderDayOrder(container)).toEqual(['07', '14'])
      expect(
        screen.getByRole('button', {
          name: 'attendance.grid.toolbar.oldestFirst',
        }),
      ).toBeInTheDocument()

      // Clicking again flips it back to newest-first.
      fireEvent.click(
        screen.getByRole('button', {
          name: 'attendance.grid.toolbar.oldestFirst',
        }),
      )
      expect(getHeaderDayOrder(container)).toEqual(['14', '07'])
    })
  })

  describe('session actions popover', () => {
    test('clicking a date header cell opens the session actions popover pre-filled with the session date', () => {
      vi.mocked(useQuery).mockReturnValue(makeGridData())
      renderBoard()

      openSessionPopover('07')

      expect(
        screen.getByText('attendance.session.popover.title'),
      ).toBeInTheDocument()
      const dateInput = document.querySelector(
        'input[type="date"]',
      ) as HTMLInputElement
      expect(dateInput).toHaveValue('2026-06-07')
    })

    test('editing the session date/notes and clicking Save calls the update mutation with the edited values', async () => {
      vi.mocked(useQuery).mockReturnValue(makeGridData())
      renderBoard()

      openSessionPopover('07')

      const dateInput = document.querySelector(
        'input[type="date"]',
      ) as HTMLInputElement
      fireEvent.change(dateInput, { target: { value: '2026-06-08' } })

      const notesTextarea = document.querySelector(
        'textarea',
      ) as HTMLTextAreaElement
      fireEvent.change(notesTextarea, { target: { value: 'Rescheduled' } })

      fireEvent.click(screen.getByRole('button', { name: 'common.save' }))

      await waitFor(() =>
        expect(updateSessionMock).toHaveBeenCalledWith({
          requesterId,
          sessionId: sessionId1,
          sessionDate: '2026-06-08',
          notes: 'Rescheduled',
        }),
      )
      await waitFor(() => expect(toast.success).toHaveBeenCalled())
    })

    test('shows an error toast and logs the error when saving session date/notes fails', async () => {
      updateSessionMock.mockRejectedValueOnce(new Error('network error'))
      vi.mocked(useQuery).mockReturnValue(makeGridData())
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      renderBoard()
      openSessionPopover('07')
      fireEvent.click(screen.getByRole('button', { name: 'common.save' }))

      await waitFor(() => expect(toast.error).toHaveBeenCalled())
      expect(consoleErrorSpy).toHaveBeenCalled()
      expect(toast.success).not.toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })

    test('clicking "Mark All Present" opens a confirm dialog; confirming calls bulkSaveAttendance with status "present" for every student', async () => {
      vi.mocked(useQuery).mockReturnValue(makeGridData())
      renderBoard()

      openSessionPopover('07')
      fireEvent.click(
        screen.getByRole('button', {
          name: 'attendance.session.actions.markAllPresent',
        }),
      )

      const dialog = await screen.findByRole('alertdialog')
      expect(
        within(dialog).getByText('attendance.session.confirm.bulkTitle'),
      ).toBeInTheDocument()

      confirmDialog()

      await waitFor(() =>
        expect(bulkSaveMock).toHaveBeenCalledWith({
          requesterId,
          sessionId: sessionId1,
          studentIds: [studentId1, studentId2],
          status: 'present',
        }),
      )
    })

    test('clicking "Clear All" opens a confirm dialog; confirming calls bulkSaveAttendance with status null', async () => {
      vi.mocked(useQuery).mockReturnValue(makeGridData())
      renderBoard()

      openSessionPopover('07')
      fireEvent.click(
        screen.getByRole('button', {
          name: 'attendance.session.actions.clearAll',
        }),
      )

      const dialog = await screen.findByRole('alertdialog')
      expect(
        within(dialog).getByText('attendance.session.confirm.bulkTitle'),
      ).toBeInTheDocument()

      confirmDialog()

      await waitFor(() =>
        expect(bulkSaveMock).toHaveBeenCalledWith({
          requesterId,
          sessionId: sessionId1,
          studentIds: [studentId1, studentId2],
          status: null,
        }),
      )
    })

    test('clicking "Cancel Session" opens a confirm dialog; confirming calls update with isCancelled: true', async () => {
      vi.mocked(useQuery).mockReturnValue(makeGridData())
      renderBoard()

      openSessionPopover('07')
      fireEvent.click(
        screen.getByRole('button', {
          name: 'attendance.session.actions.cancel',
        }),
      )

      const dialog = await screen.findByRole('alertdialog')
      expect(
        within(dialog).getByText('attendance.session.confirm.cancelTitle'),
      ).toBeInTheDocument()

      confirmDialog('attendance.session.actions.cancel')

      await waitFor(() =>
        expect(updateSessionMock).toHaveBeenCalledWith({
          requesterId,
          sessionId: sessionId1,
          isCancelled: true,
        }),
      )
    })

    test('shows "Restore Session" instead of "Cancel Session" for a cancelled session, and it restores without a confirm dialog', async () => {
      const data = makeGridData({
        sessions: [
          { _id: sessionId1, sessionDate: '2026-06-07', isCancelled: true },
          { _id: sessionId2, sessionDate: '2026-06-14', isCancelled: false },
        ],
      })
      vi.mocked(useQuery).mockReturnValue(data)
      renderBoard()

      openSessionPopover('07')
      expect(
        screen.queryByRole('button', {
          name: 'attendance.session.actions.cancel',
        }),
      ).not.toBeInTheDocument()

      fireEvent.click(
        screen.getByRole('button', {
          name: 'attendance.session.actions.restore',
        }),
      )

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      await waitFor(() =>
        expect(updateSessionMock).toHaveBeenCalledWith({
          requesterId,
          sessionId: sessionId1,
          isCancelled: false,
        }),
      )
    })

    test('clicking "Delete Session" opens a confirm dialog; confirming calls softDelete', async () => {
      vi.mocked(useQuery).mockReturnValue(makeGridData())
      renderBoard()

      openSessionPopover('07')
      fireEvent.click(
        screen.getByRole('button', {
          name: 'attendance.session.actions.delete',
        }),
      )

      const dialog = await screen.findByRole('alertdialog')
      expect(
        within(dialog).getByText('attendance.session.confirm.deleteTitle'),
      ).toBeInTheDocument()

      confirmDialog('common.delete')

      await waitFor(() =>
        expect(deleteSessionMock).toHaveBeenCalledWith({
          requesterId,
          sessionId: sessionId1,
        }),
      )
    })

    test('clicking Cancel in the confirm dialog dismisses it without calling any mutation', async () => {
      vi.mocked(useQuery).mockReturnValue(makeGridData())
      renderBoard()

      openSessionPopover('07')
      fireEvent.click(
        screen.getByRole('button', {
          name: 'attendance.session.actions.delete',
        }),
      )

      const dialog = await screen.findByRole('alertdialog')
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'common.cancel' }),
      )

      await waitFor(() =>
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(),
      )
      expect(deleteSessionMock).not.toHaveBeenCalled()
      expect(updateSessionMock).not.toHaveBeenCalled()
      expect(bulkSaveMock).not.toHaveBeenCalled()
    })

    test('shows an error toast and logs the error when restoring a cancelled session fails', async () => {
      updateSessionMock.mockRejectedValueOnce(new Error('network error'))
      const data = makeGridData({
        sessions: [
          { _id: sessionId1, sessionDate: '2026-06-07', isCancelled: true },
          { _id: sessionId2, sessionDate: '2026-06-14', isCancelled: false },
        ],
      })
      vi.mocked(useQuery).mockReturnValue(data)
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      renderBoard()
      openSessionPopover('07')
      fireEvent.click(
        screen.getByRole('button', {
          name: 'attendance.session.actions.restore',
        }),
      )

      await waitFor(() => expect(toast.error).toHaveBeenCalled())
      expect(consoleErrorSpy).toHaveBeenCalled()
      expect(toast.success).not.toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })

    test('shows an error toast and logs the error when a confirmed session action fails', async () => {
      deleteSessionMock.mockRejectedValueOnce(new Error('network error'))
      vi.mocked(useQuery).mockReturnValue(makeGridData())
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      renderBoard()
      openSessionPopover('07')
      fireEvent.click(
        screen.getByRole('button', {
          name: 'attendance.session.actions.delete',
        }),
      )
      await screen.findByRole('alertdialog')
      confirmDialog('common.delete')

      await waitFor(() => expect(toast.error).toHaveBeenCalled())
      expect(consoleErrorSpy).toHaveBeenCalled()
      expect(toast.success).not.toHaveBeenCalled()
      // finally-block cleanup still dismisses the dialog even on failure
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()

      consoleErrorSpy.mockRestore()
    })
  })

  describe('permissions check', () => {
    test('does not render popover trigger buttons on date headers when canManage is false', () => {
      vi.mocked(useQuery).mockReturnValue(makeGridData())
      const { container } = renderBoard(false)

      // Ensure they don't contain popover trigger buttons
      const headersWithButtons = container.querySelectorAll(
        'thead tr:nth-child(2) th button',
      )
      expect(headersWithButtons).toHaveLength(0)

      // Ensure day headers still contain the text '07' and '14'
      expect(screen.getByText('07')).toBeInTheDocument()
      expect(screen.getByText('14')).toBeInTheDocument()
    })

    test('disables attendance cell buttons when canManage is false', () => {
      vi.mocked(useQuery).mockReturnValue(makeGridData())
      const { container } = renderBoard(false)

      const cellButtons = container.querySelectorAll('tbody tr td button')
      expect(cellButtons.length).toBeGreaterThan(0)
      cellButtons.forEach((button) => {
        expect(button).toBeDisabled()
      })
    })

    test('enables attendance cell buttons when canManage is true (not cancelled)', () => {
      vi.mocked(useQuery).mockReturnValue(makeGridData())
      const { container } = renderBoard(true)

      const cellButtons = container.querySelectorAll('tbody tr td button')
      expect(cellButtons.length).toBeGreaterThan(0)
      cellButtons.forEach((button) => {
        expect(button).not.toBeDisabled()
      })
    })
  })

  describe('CSV export', () => {
    test('exports name-sorted rows with one column per visible session, respecting the current sort/filter', () => {
      // Declared out of name-sorted order to verify the export sorts by
      // name. NOTE: the shared `vi.mocked(useQuery).mockReturnValue(data)`
      // pattern used throughout this file returns the same `data` object for
      // ALL three of the component's useQuery calls (gridData, appConfig,
      // semesters) -- appConfig?.nameFormat and Array.isArray(semesters)
      // both degrade gracefully, matching the rest of this file.
      const data = makeGridData({
        students: [
          {
            studentClassId: studentClassId2,
            studentId: studentId2,
            fullName: 'Tran Thi B',
            saintName: null,
            studentCode: 'STU002',
          },
          {
            studentClassId: studentClassId1,
            studentId: studentId1,
            fullName: 'Nguyen Van A',
            saintName: 'Peter',
            studentCode: 'STU001',
          },
        ],
        sessions: [
          { _id: sessionId1, sessionDate: '2026-06-07', isCancelled: false },
          { _id: sessionId2, sessionDate: '2026-06-14', isCancelled: true },
        ],
        attendanceMap: {
          sc1_session1: { status: 'present', notes: 'On time' },
        },
      })
      vi.mocked(useQuery).mockReturnValue(data)
      renderBoard()

      fireEvent.click(screen.getByText('classes.export.csv'))

      expect(exportCsv).toHaveBeenCalledTimes(1)
      const [rows, filename, headers] = vi.mocked(exportCsv).mock.calls[0]

      expect(filename).toBe('diem-danh.csv')
      // Default dateOrder is 'desc' (newest first) and showCancelled
      // defaults to true, so both sessions appear, newest column first.
      expect(headers).toEqual([
        'attendance.grid.studentName',
        'students.col.studentCode',
        '14/06/2026',
        '07/06/2026',
      ])

      // Name-sorted: "Peter Nguyen Van A" before "Tran Thi B", even though
      // gridData.students declared them in the opposite order above.
      expect(rows).toHaveLength(2)
      expect(rows[0]['attendance.grid.studentName']).toBe('Peter Nguyen Van A')
      expect(rows[0]['students.col.studentCode']).toBe('STU001')
      expect(rows[1]['attendance.grid.studentName']).toBe('Tran Thi B')
      expect(rows[1]['students.col.studentCode']).toBe('STU002')

      // Cancelled session column renders the translated "cancelled" key
      // regardless of any underlying attendance record.
      expect(rows[0]['14/06/2026']).toBe('attendance.status.cancelled')
      expect(rows[1]['14/06/2026']).toBe('attendance.status.cancelled')

      // Non-cancelled session: existing record -> its status key; no record
      // -> the 'unset' status key.
      expect(rows[0]['07/06/2026']).toBe('attendance.status.present')
      expect(rows[1]['07/06/2026']).toBe('attendance.status.unset')
    })

    test('does not call exportCsv on render, only after clicking the button', () => {
      vi.mocked(useQuery).mockReturnValue(makeGridData())
      renderBoard()

      expect(exportCsv).not.toHaveBeenCalled()
    })
  })
})
