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

function renderBoard() {
  return render(
    <AttendanceGridBoard
      classId={classId}
      academicYearId={academicYearId}
      requesterId={requesterId}
    />,
  )
}

/** Opens the attendance popover for the given student's first visible cell and returns the row. */
function openPopoverForStudent(studentCode: string, cellIndex = 0) {
  const row = screen.getByText(studentCode).closest('tr')!
  const triggers = within(row).getAllByRole('button')
  fireEvent.click(triggers[cellIndex])
  return row
}

describe('AttendanceGridBoard', () => {
  beforeEach(() => {
    vi.mocked(useQuery).mockReset()
    vi.mocked(useMutation).mockReset()
    vi.mocked(useMutation).mockReturnValue(
      vi.fn().mockResolvedValue(undefined) as any,
    )
    vi.mocked(toast.success).mockClear()
    vi.mocked(toast.error).mockClear()
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
      expect(screen.getByText('STU001')).toBeInTheDocument()
      // No saint name -> fullName rendered alone
      expect(screen.getByText('Tran Thi B')).toBeInTheDocument()
      expect(screen.getByText('STU002')).toBeInTheDocument()
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

      expect(screen.getByText('May 2026')).toHaveAttribute('colspan', '2')
      expect(screen.getByText('Jun 2026')).toHaveAttribute('colspan', '1')
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

      const row = screen.getByText('STU001').closest('tr')!
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

      openPopoverForStudent('STU001')

      expect(screen.getByText('attendance.popover.title')).toBeInTheDocument()
      const presentBtn = screen.getByRole('button', {
        name: 'attendance.status.present',
      })
      expect(presentBtn.className).toMatch(/border-2/)
    })

    test('toggles the highlighted status when a different status button is clicked', () => {
      vi.mocked(useQuery).mockReturnValue(makeGridData())
      renderBoard()

      openPopoverForStudent('STU001')

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

      openPopoverForStudent('STU001')

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

      openPopoverForStudent('STU001')

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
      const saveMock = vi.fn().mockResolvedValue(undefined)
      vi.mocked(useMutation).mockReturnValue(saveMock as any)
      vi.mocked(useQuery).mockReturnValue(makeGridData())
      renderBoard()

      openPopoverForStudent('STU001')

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
        expect(saveMock).toHaveBeenCalledWith({
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
      const saveMock = vi.fn().mockResolvedValue(undefined)
      vi.mocked(useMutation).mockReturnValue(saveMock as any)
      vi.mocked(useQuery).mockReturnValue(makeGridData())
      renderBoard()

      openPopoverForStudent('STU001')

      fireEvent.click(
        screen.getByRole('button', { name: 'attendance.popover.clearBtn' }),
      )

      await waitFor(() =>
        expect(saveMock).toHaveBeenCalledWith({
          requesterId,
          sessionId: sessionId1,
          studentId: studentId1,
          status: undefined,
          notes: undefined,
        }),
      )
    })

    test('shows an error toast and logs the error when saving fails', async () => {
      const saveMock = vi.fn().mockRejectedValue(new Error('network error'))
      vi.mocked(useMutation).mockReturnValue(saveMock as any)
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
      const saveMock = vi.fn().mockReturnValue(savePromise)
      vi.mocked(useMutation).mockReturnValue(saveMock as any)
      vi.mocked(useQuery).mockReturnValue(makeGridData())

      renderBoard()
      openPopoverForStudent('STU001')

      const saveBtn = screen.getByRole('button', {
        name: 'attendance.popover.saveBtn',
      })
      fireEvent.click(saveBtn)

      expect(saveBtn).toBeDisabled()

      resolveSave()
      await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1))
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

      const outerWrapper = container.querySelector('.rounded-lg.border')
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
        // The specifically-set cell (sc1/session1) must not use the unset color
        const row = screen.getByText('STU001').closest('tr')!
        const firstCellIcon = within(row)
          .getAllByRole('button')[0]
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
      const row = screen.getByText('STU001').closest('tr')!
      const firstCellIcon = within(row)
        .getAllByRole('button')[0]
        .querySelector('svg')
      expect(firstCellIcon).toHaveClass('text-gray-400')
    })
  })
})
