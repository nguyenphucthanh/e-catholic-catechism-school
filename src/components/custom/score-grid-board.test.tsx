import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { ScoreGridBoard } from './score-grid-board'
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
const col1 = 'col1' as Id<'scoreColumns'> // scale_10, semester1
const col2 = 'col2' as Id<'scoreColumns'> // pass_fail, semester1
const col3 = 'col3' as Id<'scoreColumns'> // letter_af, semester1
const col4 = 'col4' as Id<'scoreColumns'> // scale_10, semester2
const semesterId1 = 'sem1' as Id<'semesters'>
const semesterId2 = 'sem2' as Id<'semesters'>

function makeGridData() {
  return {
    // Declared out of name-sorted order to verify the export sorts by name.
    students: [
      {
        studentClassId: studentClassId2,
        studentId: studentId2,
        fullName: 'Tran Thi B',
        saintName: null as string | null,
        studentCode: 'STU002',
      },
      {
        studentClassId: studentClassId1,
        studentId: studentId1,
        fullName: 'Nguyen Van A',
        saintName: 'Peter' as string | null,
        studentCode: 'STU001',
      },
    ],
    scoreColumns: [
      {
        _id: col1,
        columnName: 'Kiểm tra 15 phút',
        columnType: 'short_quiz',
        scaleType: 'scale_10' as const,
        weight: 1,
        sortOrder: 1,
        semesterId: semesterId1,
        examDate: '2026-03-15',
      },
      {
        _id: col2,
        columnName: 'Hạnh kiểm',
        columnType: 'conduct',
        scaleType: 'pass_fail' as const,
        weight: 1,
        sortOrder: 2,
        semesterId: semesterId1,
      },
      {
        _id: col3,
        columnName: 'Xếp loại',
        columnType: 'classification',
        scaleType: 'letter_af' as const,
        weight: 1,
        sortOrder: 3,
        semesterId: semesterId1,
      },
      {
        _id: col4,
        columnName: 'Kiểm tra HK2',
        columnType: 'short_quiz',
        scaleType: 'scale_10' as const,
        weight: 2,
        sortOrder: 1,
        semesterId: semesterId2,
      },
    ],
    scoreEntriesMap: {
      [`${studentClassId1}_${col1}`]: { _id: 'e1', scoreValue: 8.5 },
      [`${studentClassId1}_${col2}`]: { _id: 'e2', scoreLabel: 'pass' },
      [`${studentClassId2}_${col2}`]: { _id: 'e3', scoreLabel: 'fail' },
      [`${studentClassId2}_${col3}`]: { _id: 'e4', scoreLabel: 'B+' },
      [`${studentClassId1}_${col4}`]: { _id: 'e5', scoreValue: 9 },
      // studentClassId2 has no col4 entry -> annual avg should be null for it.
    },
  }
}

const semestersFixture = [
  { _id: semesterId1, name: 'HK1', semesterNumber: 1 },
  { _id: semesterId2, name: null as string | null, semesterNumber: 2 },
]

interface MockQueryOptions {
  gridData?: ReturnType<typeof makeGridData> | undefined
  appConfig?: { nameFormat?: string } | undefined
  semesters?: Array<{
    _id: Id<'semesters'>
    name: string | null
    semesterNumber: number
  }>
  history?: Array<Record<string, unknown>> | undefined
}

function mockQueries(opts: MockQueryOptions = {}) {
  const { gridData, appConfig, semesters = [] } = opts
  // Distinguish "not passed" (defaults to []) from an explicit `undefined`
  // (used to simulate the query still loading) -- a default parameter value
  // can't tell those apart, so check for the key directly.
  const history = 'history' in opts ? opts.history : []
  vi.mocked(useQuery).mockImplementation(((queryRef: any, args?: any) => {
    const path = queryRef?.[Symbol.for('functionName')]
    if (path === 'grading:getScoresGrid') return gridData
    if (path === 'appConfig:get') return appConfig
    if (path === 'academicYears:listSemesters') return semesters
    if (path === 'grading:listScoreEntryHistory') {
      if (args === 'skip') return undefined
      return history
    }
    return undefined
  }) as any)
}

let upsertScoreEntryMock: ReturnType<typeof vi.fn>
let updateScoreColumnMock: ReturnType<typeof vi.fn>
let softDeleteScoreColumnMock: ReturnType<typeof vi.fn>

function mockMutations() {
  upsertScoreEntryMock = vi.fn().mockResolvedValue(undefined)
  updateScoreColumnMock = vi.fn().mockResolvedValue(undefined)
  softDeleteScoreColumnMock = vi.fn().mockResolvedValue(undefined)
  vi.mocked(useMutation).mockImplementation(((fnRef: any) => {
    const path = fnRef?.[Symbol.for('functionName')]
    if (path === 'grading:upsertScoreEntry') return upsertScoreEntryMock
    if (path === 'grading:updateScoreColumn') return updateScoreColumnMock
    if (path === 'grading:softDeleteScoreColumn')
      return softDeleteScoreColumnMock
    return vi.fn().mockResolvedValue(undefined)
  }) as any)
}

function renderBoard(canManage = false) {
  return render(
    <ScoreGridBoard
      classId={classId}
      academicYearId={academicYearId}
      requesterId={requesterId}
      canManage={canManage}
    />,
  )
}

describe('ScoreGridBoard', () => {
  beforeEach(() => {
    vi.mocked(useQuery).mockReset()
    vi.mocked(exportCsv).mockClear()
    vi.mocked(toast.success).mockClear()
    vi.mocked(toast.error).mockClear()
    mockMutations()
  })

  describe('loading and empty states', () => {
    test('renders a skeleton while gridData is loading', () => {
      mockQueries({ gridData: undefined })
      renderBoard()
      expect(screen.queryByRole('table')).not.toBeInTheDocument()
      expect(document.querySelector('[data-slot="skeleton"]')).toBeTruthy()
    })

    test('renders empty state message when there are no students', () => {
      const gridData = makeGridData()
      gridData.students = []
      mockQueries({ gridData })
      renderBoard()
      expect(screen.getByText('exams.grid.noStudents')).toBeInTheDocument()
    })
  })

  describe('CSV export', () => {
    test('exports name-sorted rows with per-column values formatted per scaleType', () => {
      mockQueries({ gridData: makeGridData() })
      renderBoard()

      fireEvent.click(screen.getByText('classes.export.csv'))

      expect(exportCsv).toHaveBeenCalledTimes(1)
      const [rows, filename, headers] = vi.mocked(exportCsv).mock.calls[0]

      expect(filename).toBe('bang-diem.csv')
      expect(headers).toEqual([
        'exams.grid.studentName',
        'students.col.studentCode',
        'Kiểm tra 15 phút',
        'Kiểm tra HK2',
        'Hạnh kiểm',
        'Xếp loại',
      ])

      expect(rows).toHaveLength(2)
      expect(rows[0]['exams.grid.studentName']).toBe('Peter Nguyen Van A')
      expect(rows[0]['students.col.studentCode']).toBe('STU001')
      expect(rows[1]['exams.grid.studentName']).toBe('Tran Thi B')
      expect(rows[1]['students.col.studentCode']).toBe('STU002')

      expect(rows[0]['Kiểm tra 15 phút']).toBe('8.5')
      expect(rows[1]['Kiểm tra 15 phút']).toBe('—')

      expect(rows[0]['Hạnh kiểm']).toBe('exams.grid.passBadge')
      expect(rows[1]['Hạnh kiểm']).toBe('exams.grid.failBadge')

      expect(rows[0]['Xếp loại']).toBe('—')
      expect(rows[1]['Xếp loại']).toBe('B+')
    })

    test('does not call exportCsv on render, only after clicking the button', () => {
      mockQueries({ gridData: makeGridData() })
      renderBoard()

      expect(exportCsv).not.toHaveBeenCalled()
    })
  })

  describe('search and sorting', () => {
    test('filters students by full name, saint name, and student code', () => {
      mockQueries({ gridData: makeGridData() })
      renderBoard()
      const search = screen.getByPlaceholderText(
        'exams.grid.toolbar.searchPlaceholder',
      )

      fireEvent.change(search, { target: { value: 'peter' } })
      expect(screen.getByText('Peter Nguyen Van A')).toBeInTheDocument()
      expect(screen.queryByText('Tran Thi B')).not.toBeInTheDocument()

      fireEvent.change(search, { target: { value: 'stu002' } })
      expect(screen.getByText('Tran Thi B')).toBeInTheDocument()
      expect(screen.queryByText('Peter Nguyen Van A')).not.toBeInTheDocument()

      fireEvent.change(search, { target: { value: 'no-such-student' } })
      expect(screen.queryByText('Tran Thi B')).not.toBeInTheDocument()
      expect(screen.queryByText('Peter Nguyen Van A')).not.toBeInTheDocument()
    })

    test('sorts by last name when nameFormat is lastName_firstName', () => {
      mockQueries({
        gridData: makeGridData(),
        appConfig: { nameFormat: 'lastName_firstName' },
      })
      renderBoard()
      const names = screen
        .getAllByText(/Nguyen Van A|Tran Thi B/)
        .map((el) => el.textContent)
      // "A" < "B" by last name, so Peter Nguyen Van A (last name "A") sorts first.
      expect(names[0]).toContain('Nguyen Van A')
    })
  })

  describe('semester filter', () => {
    test('filtering to a single semester hides other semesters columns and the annual avg column', () => {
      mockQueries({
        gridData: makeGridData(),
        semesters: semestersFixture,
      })
      renderBoard()

      // Both semester avg columns + annual avg visible before filtering.
      expect(screen.getByText('exams.grid.annualAvg')).toBeInTheDocument()

      const trigger = screen
        .getByText('attendance.summary.allSemesters')
        .closest('button')!
      fireEvent.click(trigger)
      const option = screen.getByRole('option', { name: 'HK1' })
      fireEvent.pointerDown(option)
      fireEvent.click(option)

      // Only semester1 columns remain, annual avg column disappears.
      expect(screen.getByText('Kiểm tra 15 phút')).toBeInTheDocument()
      expect(screen.queryByText('Kiểm tra HK2')).not.toBeInTheDocument()
      expect(screen.queryByText('exams.grid.annualAvg')).not.toBeInTheDocument()
    })
  })

  describe('cell display without manage permission', () => {
    test('renders read-only score cells for each scale type', () => {
      mockQueries({ gridData: makeGridData() })
      renderBoard(false)

      // scale_10 -> formatted value.
      expect(screen.getByText('8.5')).toBeInTheDocument()
      // pass_fail -> translated badges.
      expect(screen.getByText('exams.grid.passBadge')).toBeInTheDocument()
      expect(screen.getByText('exams.grid.failBadge')).toBeInTheDocument()
      // letter_af -> raw label.
      expect(screen.getByText('B+')).toBeInTheDocument()
      // No popover triggers when canManage is false.
      expect(
        screen.queryByText('exams.grid.toolbar.createExam'),
      ).not.toBeInTheDocument()
    })
  })

  describe('semester averages', () => {
    test('does not throw when a student has no score entry for a column in the semester', () => {
      const gridData = makeGridData()
      mockQueries({
        gridData,
        semesters: [{ _id: semesterId1, name: 'HK1', semesterNumber: 1 }],
      })
      expect(() => renderBoard()).not.toThrow()
    })

    test('shows annual avg only for students with a score in every semester', () => {
      mockQueries({
        gridData: makeGridData(),
        semesters: semestersFixture,
      })
      renderBoard()
      // studentClassId1 (Peter Nguyen Van A) has scores in both semesters -> avg present.
      // studentClassId2 (Tran Thi B) is missing col4 (semester2) -> annual avg null (em dash).
      const rows = document.querySelectorAll('tbody tr')
      expect(rows.length).toBe(2)
    })
  })

  describe('column management (canManage=true)', () => {
    function openColumnPopover(columnName: string) {
      fireEvent.click(screen.getByText(columnName))
    }

    test('shows create exam link and export button', () => {
      mockQueries({ gridData: makeGridData(), semesters: semestersFixture })
      renderBoard(true)
      expect(
        screen.getByText('exams.grid.toolbar.createExam'),
      ).toBeInTheDocument()
    })

    test('rejects saving a column with an empty name', async () => {
      mockQueries({ gridData: makeGridData(), semesters: semestersFixture })
      renderBoard(true)
      openColumnPopover('Kiểm tra 15 phút')

      const nameInput = screen.getByDisplayValue('Kiểm tra 15 phút')
      fireEvent.change(nameInput, { target: { value: '   ' } })
      fireEvent.click(screen.getByText('exams.columnActions.updateBtn'))

      await vi.waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith(
          'exams.columnActions.nameRequired',
        ),
      )
      expect(updateScoreColumnMock).not.toHaveBeenCalled()
    })

    test('saves column field changes successfully', async () => {
      mockQueries({ gridData: makeGridData(), semesters: semestersFixture })
      renderBoard(true)
      openColumnPopover('Kiểm tra 15 phút')

      const nameInput = screen.getByDisplayValue('Kiểm tra 15 phút')
      fireEvent.change(nameInput, { target: { value: 'Kiểm tra mới' } })
      fireEvent.click(screen.getByText('exams.columnActions.updateBtn'))

      await vi.waitFor(() =>
        expect(updateScoreColumnMock).toHaveBeenCalledWith(
          expect.objectContaining({
            requesterId,
            id: col1,
            columnName: 'Kiểm tra mới',
          }),
        ),
      )
      await vi.waitFor(() =>
        expect(toast.success).toHaveBeenCalledWith('common.saved'),
      )
    })

    test('shows a translated error toast when updating a column fails', async () => {
      updateScoreColumnMock.mockRejectedValueOnce(
        new Error('SCORE_COLUMN_NOT_FOUND'),
      )
      mockQueries({ gridData: makeGridData(), semesters: semestersFixture })
      renderBoard(true)
      openColumnPopover('Kiểm tra 15 phút')

      fireEvent.click(screen.getByText('exams.columnActions.updateBtn'))

      await vi.waitFor(() => expect(toast.error).toHaveBeenCalled())
    })

    test('deletes a column after confirming in the alert dialog', async () => {
      mockQueries({ gridData: makeGridData(), semesters: semestersFixture })
      renderBoard(true)
      openColumnPopover('Kiểm tra 15 phút')

      fireEvent.click(screen.getByText('common.delete'))

      const dialog = await screen.findByRole('alertdialog')
      expect(
        within(dialog).getByText('exams.columnActions.confirmDeleteTitle'),
      ).toBeInTheDocument()

      fireEvent.click(
        within(dialog).getByRole('button', { name: 'common.delete' }),
      )

      await vi.waitFor(() =>
        expect(softDeleteScoreColumnMock).toHaveBeenCalledWith({
          requesterId,
          id: col1,
        }),
      )
      await vi.waitFor(() =>
        expect(toast.success).toHaveBeenCalledWith(
          'exams.columnActions.deleteSuccess',
        ),
      )
    })

    test('cancelling the delete confirmation dialog does not call the mutation', async () => {
      mockQueries({ gridData: makeGridData(), semesters: semestersFixture })
      renderBoard(true)
      openColumnPopover('Kiểm tra 15 phút')
      fireEvent.click(screen.getByText('common.delete'))

      const dialog = await screen.findByRole('alertdialog')
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'common.cancel' }),
      )

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      expect(softDeleteScoreColumnMock).not.toHaveBeenCalled()
    })

    test('shows a translated error toast when deleting a column fails', async () => {
      softDeleteScoreColumnMock.mockRejectedValueOnce(new Error('boom'))
      mockQueries({ gridData: makeGridData(), semesters: semestersFixture })
      renderBoard(true)
      openColumnPopover('Kiểm tra 15 phút')
      fireEvent.click(screen.getByText('common.delete'))

      const dialog = await screen.findByRole('alertdialog')
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'common.delete' }),
      )

      await vi.waitFor(() => expect(toast.error).toHaveBeenCalled())
    })

    test('moving a column right swaps sort order with the next column', async () => {
      mockQueries({ gridData: makeGridData(), semesters: semestersFixture })
      renderBoard(true)

      const row = screen.getByText('Kiểm tra 15 phút').closest('th')!
      const moveRight = within(row).getByRole('button', {
        name: 'exams.grid.toolbar.moveColumnRight',
      })
      fireEvent.click(moveRight)

      await vi.waitFor(() =>
        expect(updateScoreColumnMock).toHaveBeenCalledWith({
          requesterId,
          id: col1,
          sortOrder: 2,
        }),
      )
      expect(updateScoreColumnMock).toHaveBeenCalledWith({
        requesterId,
        id: col2,
        sortOrder: 1,
      })
    })

    test('the left-move button is disabled for the first column in a semester group', () => {
      mockQueries({ gridData: makeGridData(), semesters: semestersFixture })
      renderBoard(true)

      const row = screen.getByText('Kiểm tra 15 phút').closest('th')!
      const moveLeft = within(row).getByRole('button', {
        name: 'exams.grid.toolbar.moveColumnLeft',
      })
      expect(moveLeft).toBeDisabled()
    })

    test('shows a partial-failure toast when only one of the two swap mutations fails', async () => {
      updateScoreColumnMock.mockImplementation((args: any) => {
        if (args.id === col2) return Promise.reject(new Error('fail'))
        return Promise.resolve(undefined)
      })
      mockQueries({ gridData: makeGridData(), semesters: semestersFixture })
      renderBoard(true)

      const row = screen.getByText('Kiểm tra 15 phút').closest('th')!
      fireEvent.click(
        within(row).getByRole('button', {
          name: 'exams.grid.toolbar.moveColumnRight',
        }),
      )

      await vi.waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith(
          'exams.columnActions.reorderPartialError',
        ),
      )
    })

    test('shows a translated error toast when both swap mutations fail', async () => {
      updateScoreColumnMock.mockRejectedValue(new Error('total-fail'))
      mockQueries({ gridData: makeGridData(), semesters: semestersFixture })
      renderBoard(true)

      const row = screen.getByText('Kiểm tra 15 phút').closest('th')!
      fireEvent.click(
        within(row).getByRole('button', {
          name: 'exams.grid.toolbar.moveColumnRight',
        }),
      )

      await vi.waitFor(() => expect(toast.error).toHaveBeenCalled())
    })
  })

  describe('cell editing (canManage=true)', () => {
    // visibleColumns order for the semestersFixture grid: semester1's columns
    // (sortOrder 1,2,3) followed by semester2's column (sortOrder 1).
    const columnOrder = [
      'Kiểm tra 15 phút',
      'Hạnh kiểm',
      'Xếp loại',
      'Kiểm tra HK2',
    ]

    function openCellPopover(studentFullName: string, columnName: string) {
      const row = screen.getByText(studentFullName).closest('tr')!
      const colIndex = columnOrder.indexOf(columnName)
      const cell = within(row).getAllByRole('button')[colIndex]
      fireEvent.click(cell)
    }

    test('shows a skeleton while the score history query is loading', () => {
      mockQueries({
        gridData: makeGridData(),
        semesters: semestersFixture,
        history: undefined,
      })
      renderBoard(true)
      openCellPopover('Peter Nguyen Van A', 'Kiểm tra 15 phút')

      expect(document.querySelector('[data-slot="skeleton"]')).toBeTruthy()
    })

    test('shows "no history" text when history array is empty', () => {
      mockQueries({
        gridData: makeGridData(),
        semesters: semestersFixture,
        history: [],
      })
      renderBoard(true)
      openCellPopover('Peter Nguyen Van A', 'Kiểm tra 15 phút')

      expect(screen.getByText('exams.popover.historyEmpty')).toBeInTheDocument()
    })

    test('renders history entries with old/new value fallbacks and reason', () => {
      mockQueries({
        gridData: makeGridData(),
        semesters: semestersFixture,
        history: [
          {
            _id: 'h1',
            changedByName: 'Admin',
            changedAt: '2026-03-01T10:00:00.000Z',
            oldScoreValue: 7,
            newScoreValue: 8.5,
            reason: 'Recalculated',
          },
          {
            _id: 'h2',
            changedByName: 'Admin2',
            changedAt: '2026-03-02T10:00:00.000Z',
            oldScoreLabel: undefined,
            newScoreLabel: undefined,
          },
        ],
      })
      renderBoard(true)
      openCellPopover('Peter Nguyen Van A', 'Kiểm tra 15 phút')

      expect(screen.getByText('Admin')).toBeInTheDocument()
      expect(screen.getByText(/Recalculated/)).toBeInTheDocument()
    })

    test('shows "no score yet" text when the cell has never been scored', () => {
      mockQueries({
        gridData: makeGridData(),
        semesters: semestersFixture,
      })
      renderBoard(true)
      // studentClassId2 has no col1 entry.
      openCellPopover('Tran Thi B', 'Kiểm tra 15 phút')

      expect(screen.getByText('exams.popover.noScoreYet')).toBeInTheDocument()
    })

    test('rejects an out-of-range scale_10 score', async () => {
      mockQueries({ gridData: makeGridData(), semesters: semestersFixture })
      renderBoard(true)
      openCellPopover('Peter Nguyen Van A', 'Kiểm tra 15 phút')

      const scoreInput = screen.getByPlaceholderText('0.0 - 10.0')
      fireEvent.change(scoreInput, { target: { value: '15' } })
      const reasonInput = screen.getByPlaceholderText(
        'exams.popover.notesPlaceholder',
      )
      fireEvent.change(reasonInput, { target: { value: 'Test reason' } })
      // The score input carries a native `max={10}` constraint, which would
      // block a plain button click from ever reaching the form's onSubmit in
      // jsdom (native constraint validation). Dispatch `submit` directly on
      // the form to exercise the component's own JS-level range check.
      fireEvent.submit(scoreInput.closest('form')!)

      await vi.waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith(
          'exams.popover.scoreRangeError',
        ),
      )
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })

    test('saves a valid scale_10 score after confirmation', async () => {
      mockQueries({ gridData: makeGridData(), semesters: semestersFixture })
      renderBoard(true)
      openCellPopover('Peter Nguyen Van A', 'Kiểm tra 15 phút')

      const scoreInput = screen.getByPlaceholderText('0.0 - 10.0')
      fireEvent.change(scoreInput, { target: { value: '9.5' } })
      const reasonInput = screen.getByPlaceholderText(
        'exams.popover.notesPlaceholder',
      )
      fireEvent.change(reasonInput, { target: { value: 'Re-graded' } })
      fireEvent.click(screen.getByText('exams.popover.saveBtn'))

      const dialog = await screen.findByRole('alertdialog')
      expect(
        within(dialog).getByText('exams.popover.confirmSaveTitle'),
      ).toBeInTheDocument()
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'common.save' }),
      )

      await vi.waitFor(() =>
        expect(upsertScoreEntryMock).toHaveBeenCalledWith(
          expect.objectContaining({
            requesterId,
            studentClassId: studentClassId1,
            scoreColumnId: col1,
            scoreValue: 9.5,
            reason: 'Re-graded',
          }),
        ),
      )
      await vi.waitFor(() =>
        expect(toast.success).toHaveBeenCalledWith('common.saved'),
      )
    })

    test('shows a translated error toast when saving a score fails', async () => {
      upsertScoreEntryMock.mockRejectedValueOnce(new Error('boom'))
      mockQueries({ gridData: makeGridData(), semesters: semestersFixture })
      renderBoard(true)
      openCellPopover('Peter Nguyen Van A', 'Kiểm tra 15 phút')

      fireEvent.change(screen.getByPlaceholderText('0.0 - 10.0'), {
        target: { value: '9' },
      })
      fireEvent.change(
        screen.getByPlaceholderText('exams.popover.notesPlaceholder'),
        { target: { value: 'reason' } },
      )
      fireEvent.click(screen.getByText('exams.popover.saveBtn'))

      const dialog = await screen.findByRole('alertdialog')
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'common.save' }),
      )

      await vi.waitFor(() => expect(toast.error).toHaveBeenCalled())
    })

    test('cancelling the save confirmation dialog does not call the mutation', async () => {
      mockQueries({ gridData: makeGridData(), semesters: semestersFixture })
      renderBoard(true)
      openCellPopover('Peter Nguyen Van A', 'Kiểm tra 15 phút')

      fireEvent.change(screen.getByPlaceholderText('0.0 - 10.0'), {
        target: { value: '9' },
      })
      fireEvent.change(
        screen.getByPlaceholderText('exams.popover.notesPlaceholder'),
        { target: { value: 'reason' } },
      )
      fireEvent.click(screen.getByText('exams.popover.saveBtn'))

      const dialog = await screen.findByRole('alertdialog')
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'common.cancel' }),
      )

      expect(upsertScoreEntryMock).not.toHaveBeenCalled()
    })

    test('rejects submitting a pass_fail cell without choosing pass or fail', async () => {
      // Add a third student with no scoreEntries at all so its pass_fail
      // cell starts genuinely unset (every existing fixture student/column
      // combo already has a label chosen).
      const gridData = makeGridData()
      const studentClassId3 = 'sc3' as Id<'studentClasses'>
      gridData.students.push({
        studentClassId: studentClassId3,
        studentId: 'student3' as Id<'students'>,
        fullName: 'Le Van C',
        saintName: null,
        studentCode: 'STU003',
      })
      mockQueries({ gridData, semesters: semestersFixture })
      renderBoard(true)
      openCellPopover('Le Van C', 'Hạnh kiểm')

      fireEvent.change(
        screen.getByPlaceholderText('exams.popover.notesPlaceholder'),
        { target: { value: 'reason' } },
      )
      fireEvent.click(screen.getByText('exams.popover.saveBtn'))

      await vi.waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith(
          'exams.popover.passFailRequired',
        ),
      )
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })

    test('typing an empty letter grade still allows submission (label optional)', async () => {
      mockQueries({ gridData: makeGridData(), semesters: semestersFixture })
      renderBoard(true)
      openCellPopover('Tran Thi B', 'Xếp loại')

      fireEvent.change(
        screen.getByPlaceholderText('exams.popover.letterPlaceholder'),
        { target: { value: '' } },
      )
      fireEvent.change(
        screen.getByPlaceholderText('exams.popover.notesPlaceholder'),
        { target: { value: 'reason' } },
      )
      fireEvent.click(screen.getByText('exams.popover.saveBtn'))

      expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    })

    test('selecting pass then submitting a pass_fail cell opens the confirm dialog', async () => {
      mockQueries({ gridData: makeGridData(), semesters: semestersFixture })
      renderBoard(true)
      openCellPopover('Tran Thi B', 'Hạnh kiểm')

      fireEvent.click(screen.getByText('exams.popover.passLabel'))
      fireEvent.change(
        screen.getByPlaceholderText('exams.popover.notesPlaceholder'),
        { target: { value: 'Changed to pass' } },
      )
      fireEvent.click(screen.getByText('exams.popover.saveBtn'))

      const dialog = await screen.findByRole('alertdialog')
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'common.save' }),
      )

      await vi.waitFor(() =>
        expect(upsertScoreEntryMock).toHaveBeenCalledWith(
          expect.objectContaining({
            studentClassId: studentClassId2,
            scoreColumnId: col2,
            scoreLabel: 'pass',
            reason: 'Changed to pass',
          }),
        ),
      )
    })

    test('typing a letter grade and submitting opens the confirm dialog', async () => {
      mockQueries({ gridData: makeGridData(), semesters: semestersFixture })
      renderBoard(true)
      openCellPopover('Peter Nguyen Van A', 'Xếp loại')

      fireEvent.change(
        screen.getByPlaceholderText('exams.popover.letterPlaceholder'),
        { target: { value: 'A+' } },
      )
      fireEvent.change(
        screen.getByPlaceholderText('exams.popover.notesPlaceholder'),
        { target: { value: 'Excellent' } },
      )
      fireEvent.click(screen.getByText('exams.popover.saveBtn'))

      const dialog = await screen.findByRole('alertdialog')
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'common.save' }),
      )

      await vi.waitFor(() =>
        expect(upsertScoreEntryMock).toHaveBeenCalledWith(
          expect.objectContaining({
            studentClassId: studentClassId1,
            scoreColumnId: col3,
            scoreLabel: 'A+',
          }),
        ),
      )
    })
  })
})
