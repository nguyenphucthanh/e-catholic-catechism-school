import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { useQuery } from 'convex/react'
import { AttendanceSummaryReport } from './attendance-summary-report'
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
const sessionId3 = 'session3' as Id<'classSessions'>
const sessionId4 = 'session4' as Id<'classSessions'>
const sessionId5 = 'session5' as Id<'classSessions'>

const semesterId1 = 'sem1' as Id<'semesters'>
const semesterId2 = 'sem2' as Id<'semesters'>

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
    sessionType: string
    isCancelled: boolean
    notes?: string
    semesterId: Id<'semesters'>
  }>
  attendanceMap?: Record<
    string,
    { _id: string; status: string; notes?: string }
  >
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
    // 5 non-cancelled sessions in semester 1, all attributed to sem1 by default.
    sessions: [
      {
        _id: sessionId1,
        sessionDate: '2026-06-01',
        sessionType: 'regular',
        isCancelled: false,
        semesterId: semesterId1,
      },
      {
        _id: sessionId2,
        sessionDate: '2026-06-08',
        sessionType: 'regular',
        isCancelled: false,
        semesterId: semesterId1,
      },
      {
        _id: sessionId3,
        sessionDate: '2026-06-15',
        sessionType: 'regular',
        isCancelled: false,
        semesterId: semesterId1,
      },
      {
        _id: sessionId4,
        sessionDate: '2026-06-22',
        sessionType: 'regular',
        isCancelled: false,
        semesterId: semesterId1,
      },
      {
        _id: sessionId5,
        sessionDate: '2026-06-29',
        sessionType: 'regular',
        isCancelled: false,
        semesterId: semesterId1,
      },
    ],
    attendanceMap: {
      // Student 1 (STU001): present, present, late, excused_absence,
      // unexcused_absence -> present=2, late=1, excused=1, unexcused=1, unset=0
      sc1_session1: { _id: 'a1', status: 'present' },
      sc1_session2: { _id: 'a2', status: 'present' },
      sc1_session3: { _id: 'a3', status: 'late' },
      sc1_session4: { _id: 'a4', status: 'excused_absence' },
      sc1_session5: { _id: 'a5', status: 'unexcused_absence' },
      // Student 2 (STU002): all 5 sessions present -> 100% rate
      sc2_session1: { _id: 'a6', status: 'present' },
      sc2_session2: { _id: 'a7', status: 'present' },
      sc2_session3: { _id: 'a8', status: 'present' },
      sc2_session4: { _id: 'a9', status: 'present' },
      sc2_session5: { _id: 'a10', status: 'present' },
    } as Record<string, { _id: string; status: string; notes?: string }>,
    ...overrides,
  }
}

function makeSemesters() {
  return [
    {
      _id: semesterId1,
      academicYearId,
      semesterNumber: 1,
      name: 'Semester 1',
      isDeleted: false,
    },
    {
      _id: semesterId2,
      academicYearId,
      semesterNumber: 2,
      name: 'Semester 2',
      isDeleted: false,
    },
  ]
}

/** Mocks both queries used by the component in one shot, branching by function path. */
function mockQueries(
  gridData: ReturnType<typeof makeGridData> | undefined,
  semesters: ReturnType<typeof makeSemesters> | undefined,
) {
  vi.mocked(useQuery).mockImplementation(((queryRef: any) => {
    const path = queryRef?.[Symbol.for('functionName')]
    if (path === 'attendance:getAttendanceGrid') return gridData
    if (path === 'academicYears:listSemesters') return semesters
    return undefined
  }) as any)
}

function renderReport() {
  return render(
    <AttendanceSummaryReport
      classId={classId}
      academicYearId={academicYearId}
      requesterId={requesterId}
    />,
  )
}

/**
 * Opens the semester Select and picks the option with the given accessible
 * name. The DataTable's own page-size Select also renders a combobox, so the
 * semester Select (rendered first, in the filter row above the table) is
 * targeted by index rather than a bare getByRole('combobox').
 */
function selectSemesterOption(name: string | RegExp) {
  fireEvent.click(screen.getAllByRole('combobox')[0])
  const option = screen.getByRole('option', { name })
  fireEvent.pointerDown(option)
  fireEvent.click(option)
}

/**
 * Reads the big numeric value rendered in a summary card, scoped by its
 * CardTitle text (an i18n key). Numeric values also appear in table cells,
 * so summary-card assertions must go through this helper rather than a bare
 * `screen.getByText(...)` to avoid "found multiple elements" failures.
 */
function cardValue(titleKey: string): string {
  const title = screen.getByText(titleKey)
  const card = title.closest('[data-slot="card"]') as HTMLElement
  const valueEl = card.querySelector('.text-3xl') as HTMLElement
  return valueEl.textContent
}

describe('AttendanceSummaryReport', () => {
  describe('loading state', () => {
    test('renders skeletons while either query has not loaded, without crashing or rendering the table', () => {
      mockQueries(undefined, undefined)
      const { container } = renderReport()

      expect(
        container.querySelector('[data-slot="skeleton"]'),
      ).toBeInTheDocument()
      expect(screen.queryByRole('table')).not.toBeInTheDocument()
    })

    test('renders the full report (not skeletons) once gridData has loaded, even if semesters has not', () => {
      // The summary useMemo only depends on gridData (semesterOptions falls
      // back to `semesters ?? []`), so an undefined `semesters` query alone
      // does not gate the loading state -- only `gridData` does.
      mockQueries(makeGridData(), undefined)
      renderReport()

      expect(screen.getByRole('table')).toBeInTheDocument()
      expect(cardValue('attendance.summary.totalSessions')).toBe('5')
    })
  })

  describe('populated summary', () => {
    test('renders top summary cards and per-student rows with correct counts and rates', () => {
      mockQueries(makeGridData(), makeSemesters())
      renderReport()

      // Total Sessions: 5 non-cancelled sessions
      expect(cardValue('attendance.summary.totalSessions')).toBe('5')

      // STU001: present=2, late=1 -> rate = 3/5*100 = 60.0%
      const row1 = screen
        .getByText('students.col.studentCode: STU001')
        .closest('tr')!
      expect(within(row1).getByText('60.0%')).toBeInTheDocument()
      expect(within(row1).getByText('Peter Nguyen Van A')).toBeInTheDocument()
      const cells1 = within(row1).getAllByRole('cell')
      // columns: name, rate, present, late, excused, unexcused, unset
      expect(cells1[2]).toHaveTextContent('2')
      expect(cells1[3]).toHaveTextContent('1')
      expect(cells1[4]).toHaveTextContent('1')
      expect(cells1[5]).toHaveTextContent('1')
      expect(cells1[6]).toHaveTextContent('0')

      // STU002: present=5 -> rate = 100%
      const row2 = screen
        .getByText('students.col.studentCode: STU002')
        .closest('tr')!
      expect(within(row2).getByText('100.0%')).toBeInTheDocument()
      expect(within(row2).getByText('Tran Thi B')).toBeInTheDocument()

      // Class average rate = (60 + 100) / 2 = 80.0%
      expect(cardValue('attendance.summary.averageRate')).toBe('80.0%')

      // Perfect attendance: only STU002 has rate === 100 -> "1 / 2"
      expect(cardValue('attendance.summary.perfectAttendance')).toBe('1/ 2')
    })

    test('excludes cancelled sessions from session count and per-student status tallies', () => {
      const data = makeGridData({
        sessions: [
          {
            _id: sessionId1,
            sessionDate: '2026-06-01',
            sessionType: 'regular',
            isCancelled: false,
            semesterId: semesterId1,
          },
          {
            _id: sessionId2,
            sessionDate: '2026-06-08',
            sessionType: 'regular',
            isCancelled: true,
            semesterId: semesterId1,
          },
        ],
        attendanceMap: {
          sc1_session1: { _id: 'a1', status: 'present' },
          // This record exists for the cancelled session but must not be counted.
          sc1_session2: { _id: 'a2', status: 'unexcused_absence' },
        },
      })
      mockQueries(data, makeSemesters())
      renderReport()

      // Total Sessions: only session1 counts
      expect(cardValue('attendance.summary.totalSessions')).toBe('1')

      const row1 = screen
        .getByText('students.col.studentCode: STU001')
        .closest('tr')!
      const cells1 = within(row1).getAllByRole('cell')
      expect(cells1[2]).toHaveTextContent('1') // present
      expect(cells1[3]).toHaveTextContent('0') // late
      expect(cells1[4]).toHaveTextContent('0') // excused
      expect(cells1[5]).toHaveTextContent('0') // unexcused (cancelled session excluded)
      expect(cells1[6]).toHaveTextContent('0') // unset
    })
  })

  describe('rate badge styling thresholds', () => {
    test('renders emerald classes for a rate >= 90', () => {
      // Student with 5/5 present -> 100%
      mockQueries(makeGridData(), makeSemesters())
      renderReport()

      const row2 = screen
        .getByText('students.col.studentCode: STU002')
        .closest('tr')!
      const badge = within(row2).getByText('100.0%')
      expect(badge.className).toMatch(/bg-emerald-500\/10/)
      expect(badge.className).toMatch(/text-emerald-500/)
    })

    test('renders amber classes for a rate between 80 and 89', () => {
      const data = makeGridData({
        sessions: [
          {
            _id: sessionId1,
            sessionDate: '2026-06-01',
            sessionType: 'regular',
            isCancelled: false,
            semesterId: semesterId1,
          },
          {
            _id: sessionId2,
            sessionDate: '2026-06-08',
            sessionType: 'regular',
            isCancelled: false,
            semesterId: semesterId1,
          },
          {
            _id: sessionId3,
            sessionDate: '2026-06-15',
            sessionType: 'regular',
            isCancelled: false,
            semesterId: semesterId1,
          },
          {
            _id: sessionId4,
            sessionDate: '2026-06-22',
            sessionType: 'regular',
            isCancelled: false,
            semesterId: semesterId1,
          },
          {
            _id: sessionId5,
            sessionDate: '2026-06-29',
            sessionType: 'regular',
            isCancelled: false,
            semesterId: semesterId1,
          },
        ],
        // 4/5 present -> 80.0%
        attendanceMap: {
          sc1_session1: { _id: 'a1', status: 'present' },
          sc1_session2: { _id: 'a2', status: 'present' },
          sc1_session3: { _id: 'a3', status: 'present' },
          sc1_session4: { _id: 'a4', status: 'present' },
          sc1_session5: { _id: 'a5', status: 'unexcused_absence' },
        },
      })
      mockQueries(data, makeSemesters())
      renderReport()

      const row1 = screen
        .getByText('students.col.studentCode: STU001')
        .closest('tr')!
      const badge = within(row1).getByText('80.0%')
      expect(badge.className).toMatch(/bg-amber-500\/10/)
      expect(badge.className).toMatch(/text-amber-500/)
    })

    test('renders destructive classes for a rate below 80', () => {
      const data = makeGridData({
        attendanceMap: {
          // Only 1/5 present -> 20.0%
          sc1_session1: { _id: 'a1', status: 'present' },
          sc1_session2: { _id: 'a2', status: 'unexcused_absence' },
          sc1_session3: { _id: 'a3', status: 'unexcused_absence' },
          sc1_session4: { _id: 'a4', status: 'unexcused_absence' },
          sc1_session5: { _id: 'a5', status: 'unexcused_absence' },
        },
      })
      mockQueries(data, makeSemesters())
      renderReport()

      const row1 = screen
        .getByText('students.col.studentCode: STU001')
        .closest('tr')!
      const badge = within(row1).getByText('20.0%')
      expect(badge.className).toMatch(/bg-destructive\/10/)
      expect(badge.className).toMatch(/text-destructive/)
    })
  })

  describe('search filtering', () => {
    test('filters rows by case-insensitive partial match on student name', () => {
      mockQueries(makeGridData(), makeSemesters())
      renderReport()

      const search = screen.getByPlaceholderText(
        'attendance.summary.searchPlaceholder',
      )
      fireEvent.change(search, { target: { value: 'nguyen' } })

      expect(
        screen.getByText('students.col.studentCode: STU001'),
      ).toBeInTheDocument()
      expect(
        screen.queryByText('students.col.studentCode: STU002'),
      ).not.toBeInTheDocument()
    })

    test('filters rows by case-insensitive partial match on student code', () => {
      mockQueries(makeGridData(), makeSemesters())
      renderReport()

      const search = screen.getByPlaceholderText(
        'attendance.summary.searchPlaceholder',
      )
      fireEvent.change(search, { target: { value: 'stu002' } })

      expect(
        screen.getByText('students.col.studentCode: STU002'),
      ).toBeInTheDocument()
      expect(
        screen.queryByText('students.col.studentCode: STU001'),
      ).not.toBeInTheDocument()
    })

    test('shows no rows when the search matches nothing', () => {
      mockQueries(makeGridData(), makeSemesters())
      renderReport()

      const search = screen.getByPlaceholderText(
        'attendance.summary.searchPlaceholder',
      )
      fireEvent.change(search, { target: { value: 'zzz-no-match' } })

      expect(
        screen.queryByText('students.col.studentCode: STU001'),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByText('students.col.studentCode: STU002'),
      ).not.toBeInTheDocument()
    })
  })

  describe('semester filter', () => {
    test('selecting a specific semester recomputes counts/rate scoped to that semester only, and switching back to All Semesters restores unscoped counts', () => {
      const data = makeGridData({
        sessions: [
          {
            _id: sessionId1,
            sessionDate: '2026-06-01',
            sessionType: 'regular',
            isCancelled: false,
            semesterId: semesterId1,
          },
          {
            _id: sessionId2,
            sessionDate: '2026-06-08',
            sessionType: 'regular',
            isCancelled: false,
            semesterId: semesterId1,
          },
          {
            _id: sessionId3,
            sessionDate: '2026-11-01',
            sessionType: 'regular',
            isCancelled: false,
            semesterId: semesterId2,
          },
        ],
        attendanceMap: {
          // sem1 sessions: present, present -> 2/2 = 100%
          sc1_session1: { _id: 'a1', status: 'present' },
          sc1_session2: { _id: 'a2', status: 'present' },
          // sem2 session: unexcused -> 0/1 = 0%
          sc1_session3: { _id: 'a3', status: 'unexcused_absence' },
        },
      })
      mockQueries(data, makeSemesters())
      renderReport()

      // Unscoped (All Semesters, default): 3 total sessions
      expect(cardValue('attendance.summary.totalSessions')).toBe('3')

      selectSemesterOption('Semester 2')

      // Scoped to semester 2: only 1 session
      expect(cardValue('attendance.summary.totalSessions')).toBe('1')
      const row1 = screen
        .getByText('students.col.studentCode: STU001')
        .closest('tr')!
      expect(within(row1).getByText('0.0%')).toBeInTheDocument()

      selectSemesterOption('attendance.summary.allSemesters')

      // Restored: 3 total sessions again
      expect(cardValue('attendance.summary.totalSessions')).toBe('3')
    })
  })

  describe('zero-sessions edge case', () => {
    test('shows "—" for rate/avg instead of NaN or 0%, and Perfect Attendance shows 0 / totalStudents', () => {
      const data = makeGridData({ sessions: [] })
      mockQueries(data, makeSemesters())
      renderReport()

      // Total Sessions: 0
      expect(cardValue('attendance.summary.totalSessions')).toBe('0')

      // Class Avg Rate renders an em dash rather than NaN/0%
      expect(cardValue('attendance.summary.averageRate')).toBe('—')

      // Both students' rate cells render an em dash too (sessionCount === 0)
      const row1 = screen
        .getByText('students.col.studentCode: STU001')
        .closest('tr')!
      const row2 = screen
        .getByText('students.col.studentCode: STU002')
        .closest('tr')!
      expect(within(row1).getByText('—')).toBeInTheDocument()
      expect(within(row2).getByText('—')).toBeInTheDocument()

      // Perfect Attendance: 0 / 2
      expect(cardValue('attendance.summary.perfectAttendance')).toBe('0/ 2')
    })
  })

  describe('zero-students edge case', () => {
    test('renders without crashing and shows an empty table body when no students are enrolled', () => {
      const data = makeGridData({ students: [] })
      mockQueries(data, makeSemesters())

      expect(() => renderReport()).not.toThrow()

      // DataTable renders a single "No results." placeholder row when there
      // are no rows, rather than an empty tbody.
      const table = screen.getByRole('table')
      const bodyRows = within(table.querySelector('tbody')!).queryAllByRole(
        'row',
      )
      expect(bodyRows).toHaveLength(1)
      expect(bodyRows[0]).toHaveTextContent('No results.')

      // Perfect Attendance: 0 / 0
      expect(screen.getByText('/ 0')).toBeInTheDocument()
    })
  })

  describe('CSV export', () => {
    beforeEach(() => {
      vi.mocked(exportCsv).mockClear()
    })

    test('exports name-sorted rows with rate and per-status counts', () => {
      // Declared out of name-sorted order to verify the export sorts by
      // name. attendanceMap keys stay tied to studentClassId1/2 (unaffected
      // by declaration order here), matching the default fixture's tallies.
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
      })
      mockQueries(data, makeSemesters())
      renderReport()

      fireEvent.click(screen.getByText('classes.export.csv'))

      expect(exportCsv).toHaveBeenCalledTimes(1)
      const [rows, filename, headers] = vi.mocked(exportCsv).mock.calls[0]

      expect(filename).toBe('bao-cao-diem-danh.csv')
      expect(headers).toEqual([
        'attendance.grid.studentName',
        'students.col.studentCode',
        'attendance.summary.rate',
        'attendance.summary.present',
        'attendance.summary.late',
        'attendance.summary.excused',
        'attendance.summary.unexcused',
        'attendance.summary.unset',
      ])

      // Name-sorted: "Peter Nguyen Van A" before "Tran Thi B", even though
      // gridData.students declared them in the opposite order above.
      expect(rows).toHaveLength(2)
      expect(rows[0]['attendance.grid.studentName']).toBe('Peter Nguyen Van A')
      expect(rows[1]['attendance.grid.studentName']).toBe('Tran Thi B')

      // STU001: present=2, late=1, excused=1, unexcused=1 -> rate 60.0%
      expect(rows[0]['attendance.summary.rate']).toBe('60.0%')
      expect(rows[0]['attendance.summary.present']).toBe(2)
      expect(rows[0]['attendance.summary.late']).toBe(1)
      expect(rows[0]['attendance.summary.excused']).toBe(1)
      expect(rows[0]['attendance.summary.unexcused']).toBe(1)
      expect(rows[0]['attendance.summary.unset']).toBe(0)

      // STU002: all 5 sessions present -> 100.0%
      expect(rows[1]['attendance.summary.rate']).toBe('100.0%')
      expect(rows[1]['attendance.summary.present']).toBe(5)
    })

    test('renders an em dash for the rate cell when sessionCount is 0', () => {
      const data = makeGridData({ sessions: [] })
      mockQueries(data, makeSemesters())
      renderReport()

      fireEvent.click(screen.getByText('classes.export.csv'))

      const [rows] = vi.mocked(exportCsv).mock.calls[0]
      expect(rows[0]['attendance.summary.rate']).toBe('—')
    })

    test('does not call exportCsv on render, only after clicking the button', () => {
      mockQueries(makeGridData(), makeSemesters())
      renderReport()

      expect(exportCsv).not.toHaveBeenCalled()
    })
  })
})
