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
import { EvaluationsBoard } from './evaluations-board'
import type { Doc, Id } from '../../../convex/_generated/dataModel'

const classYearId = 'classYear1' as Id<'classYears'>
const academicYearId = 'year1' as Id<'academicYears'>
const requesterId = 'catechist1' as Id<'catechists'>

const semesterId1 = 'sem1' as Id<'semesters'>
const semesterId2 = 'sem2' as Id<'semesters'>

const studentClassId1 = 'sc1' as Id<'studentClasses'>
const studentClassId2 = 'sc2' as Id<'studentClasses'>
const studentClassId3 = 'sc3' as Id<'studentClasses'>
const studentClassId4 = 'sc4' as Id<'studentClasses'>

const studentId1 = 'student1' as Id<'students'>
const studentId2 = 'student2' as Id<'students'>
const studentId3 = 'student3' as Id<'students'>

interface StudentRowFixture {
  enrollment: {
    _id: Id<'studentClasses'>
    status: 'active' | 'on_leave' | 'withdrawn'
    enrolledDate: string
  }
  student: Doc<'students'> | null
}

function makeStudent(
  overrides: Partial<Doc<'students'>> = {},
): Doc<'students'> {
  return {
    _id: studentId1,
    _creationTime: 0,
    studentCode: 'STU001',
    fullName: 'Nguyen Van A',
    saintName: 'Peter',
    isActive: true,
    createdAt: 0,
    isDeleted: false,
    ...overrides,
  }
}

const activeStudentRow1 = {
  enrollment: {
    _id: studentClassId1,
    status: 'active' as const,
    enrolledDate: '2026-01-01',
  },
  student: makeStudent({
    _id: studentId1,
    studentCode: 'STU001',
    fullName: 'Nguyen Van A',
    saintName: 'Peter',
  }),
}

const activeStudentRow2 = {
  enrollment: {
    _id: studentClassId2,
    status: 'active' as const,
    enrolledDate: '2026-01-01',
  },
  student: makeStudent({
    _id: studentId2,
    studentCode: 'STU002',
    fullName: 'Tran Thi B',
    saintName: undefined,
  }),
}

const withdrawnStudentRow = {
  enrollment: {
    _id: studentClassId3,
    status: 'withdrawn' as const,
    enrolledDate: '2026-01-01',
  },
  student: makeStudent({
    _id: studentId3,
    studentCode: 'STU003',
    fullName: 'Le Van C',
    saintName: undefined,
  }),
}

const defaultStudents: Array<StudentRowFixture> = [
  activeStudentRow1,
  activeStudentRow2,
  withdrawnStudentRow,
]

function makeSemesters(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    _id: `sem${i + 1}` as Id<'semesters'>,
    semesterNumber: i + 1,
  }))
}

interface SemesterResultFixture {
  semesterId: string
  studentClassId: string
  morality?: string
  teacherNote?: string
  isCompleted?: boolean
}

interface AnnualResultFixture {
  studentClassId: string
  conductGrade?: string
  remark?: string
  isCompleted?: boolean
}

function mockQueries({
  semesters = makeSemesters(2),
  semesterResults = [],
  annualResults = [],
}: {
  semesters?: Array<{ _id: Id<'semesters'>; semesterNumber: number }>
  semesterResults?: Array<SemesterResultFixture>
  annualResults?: Array<AnnualResultFixture>
} = {}) {
  vi.mocked(useQuery).mockImplementation(((queryRef: any, args?: any) => {
    const path = queryRef?.[Symbol.for('functionName')]
    if (path === 'academicYears:listSemesters') return semesters
    if (path === 'grading:listSemesterResultsByClassYear')
      return semesterResults
    if (path === 'grading:listAnnualResults')
      return args === 'skip' ? undefined : annualResults
    return undefined
  }) as any)
}

function renderBoard(
  overrides: {
    canManage?: boolean
    students?: Array<StudentRowFixture>
  } = {},
) {
  return render(
    <EvaluationsBoard
      classYearId={classYearId}
      academicYearId={academicYearId}
      requesterId={requesterId}
      canManage={overrides.canManage ?? true}
      students={overrides.students ?? defaultStudents}
    />,
  )
}

/** Returns the `tr` element for the row displaying the given student code. */
function getRow(studentCode: string) {
  return screen.getByText(studentCode).closest('tr') as HTMLElement
}

describe('EvaluationsBoard', () => {
  let saveSemesterResultMock: ReturnType<typeof vi.fn>
  let saveAnnualResultMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.mocked(useQuery).mockReset()
    vi.mocked(useMutation).mockReset()

    saveSemesterResultMock = vi.fn().mockResolvedValue(undefined)
    saveAnnualResultMock = vi.fn().mockResolvedValue(undefined)

    vi.mocked(useMutation).mockImplementation(((fnRef: any) => {
      const path = fnRef?.[Symbol.for('functionName')]
      if (path === 'grading:upsertSemesterResult') return saveSemesterResultMock
      if (path === 'grading:upsertAnnualResult') return saveAnnualResultMock
      return vi.fn().mockResolvedValue(undefined)
    }) as any)

    vi.mocked(toast.success).mockClear()
    vi.mocked(toast.error).mockClear()
  })

  describe('loading state', () => {
    test('renders a skeleton while any of the three queries has not loaded', () => {
      vi.mocked(useQuery).mockReturnValue(undefined)
      const { container } = renderBoard()

      expect(
        container.querySelector('[data-slot="skeleton"]'),
      ).toBeInTheDocument()
      expect(screen.queryByRole('table')).not.toBeInTheDocument()
    })
  })

  describe('dynamic semester columns', () => {
    test.each([1, 2, 3])(
      'renders exactly %i semester column-group(s), not hardcoded to 2',
      (count) => {
        mockQueries({ semesters: makeSemesters(count) })
        renderBoard()

        expect(screen.getAllByText('evaluations.semesterHeader')).toHaveLength(
          count,
        )
        expect(
          screen.getAllByText('evaluations.completedSemester'),
        ).toHaveLength(count)
        expect(screen.getAllByText('evaluations.morality')).toHaveLength(count)
        expect(screen.getAllByText('evaluations.noteColumn')).toHaveLength(
          count,
        )

        // One combobox (morality) per semester + one for the Annual conduct
        // column, per active student row.
        const row = getRow('STU001')
        expect(within(row).getAllByRole('combobox')).toHaveLength(count + 1)
        // One note textbox per semester + one Annual remark textbox.
        expect(within(row).getAllByRole('textbox')).toHaveLength(count + 1)
        // One completed checkbox per semester + one Annual completed checkbox.
        expect(within(row).getAllByRole('checkbox')).toHaveLength(count + 1)
      },
    )
  })

  describe('grouping flat semesterResults by semesterId', () => {
    test('places each semester result under its own semester column for the same student', async () => {
      mockQueries({
        semesters: makeSemesters(2),
        semesterResults: [
          {
            semesterId: semesterId1,
            studentClassId: studentClassId1,
            morality: 'good',
            teacherNote: 'Sem1 note',
            isCompleted: true,
          },
          {
            semesterId: semesterId2,
            studentClassId: studentClassId1,
            morality: 'average',
            teacherNote: 'Sem2 note',
            isCompleted: false,
          },
        ],
      })
      renderBoard()

      const row = getRow('STU001')
      const noteInputs = within(row).getAllByRole('textbox')
      await waitFor(() => expect(noteInputs[0]).toHaveValue('Sem1 note'))
      expect(noteInputs[1]).toHaveValue('Sem2 note')

      const checkboxes = within(row).getAllByRole('checkbox')
      expect(checkboxes[0]).toHaveAttribute('aria-checked', 'true')
      expect(checkboxes[1]).toHaveAttribute('aria-checked', 'false')

      const comboboxes = within(row).getAllByRole('combobox')
      expect(comboboxes[0]).toHaveTextContent('evaluations.morality.good')
      expect(comboboxes[1]).toHaveTextContent('evaluations.morality.average')
    })

    test("does not leak one student's semester result onto another student", () => {
      mockQueries({
        semesters: makeSemesters(2),
        semesterResults: [
          {
            semesterId: semesterId1,
            studentClassId: studentClassId1,
            teacherNote: 'For student 1 only',
            isCompleted: true,
          },
          // No teacherNote/isCompleted at all -- exercises the `|| ''` /
          // `|| false` fallback paths for a semester result record.
          {
            semesterId: semesterId2,
            studentClassId: studentClassId1,
          },
        ],
      })
      renderBoard()

      const row1 = getRow('STU001')
      const row1Notes = within(row1).getAllByRole('textbox')
      expect(row1Notes[1]).toHaveValue('')
      const row1Checkboxes = within(row1).getAllByRole('checkbox')
      expect(row1Checkboxes[1]).toHaveAttribute('aria-checked', 'false')

      const row2 = getRow('STU002')
      const noteInputs2 = within(row2).getAllByRole('textbox')
      expect(noteInputs2[0]).toHaveValue('')
      const checkboxes2 = within(row2).getAllByRole('checkbox')
      expect(checkboxes2[0]).toHaveAttribute('aria-checked', 'false')
    })
  })

  describe('annual results hydration', () => {
    test('loads existing annual results from the backend into the Annual columns', () => {
      mockQueries({
        semesters: makeSemesters(1),
        annualResults: [
          {
            studentClassId: studentClassId1,
            conductGrade: 'good',
            remark: 'Great year',
            isCompleted: true,
          },
          // No optional fields set -- exercises the `|| undefined` / `|| ''`
          // / `|| false` fallback paths for an annual result record.
          {
            studentClassId: studentClassId2,
          },
        ],
      })
      renderBoard()

      const row1 = getRow('STU001')
      const row1Textboxes = within(row1).getAllByRole('textbox')
      expect(row1Textboxes[row1Textboxes.length - 1]).toHaveValue('Great year')
      const row1Checkboxes = within(row1).getAllByRole('checkbox')
      expect(row1Checkboxes[row1Checkboxes.length - 1]).toHaveAttribute(
        'aria-checked',
        'true',
      )
      const row1Comboboxes = within(row1).getAllByRole('combobox')
      expect(row1Comboboxes[row1Comboboxes.length - 1]).toHaveTextContent(
        'evaluations.morality.good',
      )

      const row2 = getRow('STU002')
      const row2Textboxes = within(row2).getAllByRole('textbox')
      expect(row2Textboxes[row2Textboxes.length - 1]).toHaveValue('')
      const row2Checkboxes = within(row2).getAllByRole('checkbox')
      expect(row2Checkboxes[row2Checkboxes.length - 1]).toHaveAttribute(
        'aria-checked',
        'false',
      )
    })
  })

  describe('independent per-semester local edits', () => {
    test('editing one semester note for a student does not affect another semester for that same student', () => {
      mockQueries({ semesters: makeSemesters(2) })
      renderBoard()

      const row = getRow('STU001')
      const noteInputs = within(row).getAllByRole('textbox')

      fireEvent.change(noteInputs[0], { target: { value: 'Semester 1 edit' } })

      expect(noteInputs[0]).toHaveValue('Semester 1 edit')
      expect(noteInputs[1]).toHaveValue('')
    })

    test('toggling the completed checkbox for one semester does not affect another semester', () => {
      mockQueries({ semesters: makeSemesters(2) })
      renderBoard()

      const row = getRow('STU001')
      const checkboxes = within(row).getAllByRole('checkbox')

      fireEvent.click(checkboxes[0])

      expect(checkboxes[0]).toHaveAttribute('aria-checked', 'true')
      expect(checkboxes[1]).toHaveAttribute('aria-checked', 'false')
    })
  })

  describe('handleSaveAll', () => {
    test('saves one semesterResult per edited (semester, student) pair across all semesters, plus edited annual results, then shows a success toast', async () => {
      // 3 semesters, but only sem1 and sem2 get edited -- sem3 is left
      // completely untouched to exercise the "no edits for this semester"
      // fallback path in handleSaveAll (semesterState[semester._id] ?? {}).
      mockQueries({ semesters: makeSemesters(3) })
      renderBoard()

      // Edit student 1's semester-1 note.
      const row1 = getRow('STU001')
      fireEvent.change(within(row1).getAllByRole('textbox')[0], {
        target: { value: 'Student1 sem1 note' },
      })

      // Edit student 2's semester-2 note.
      const row2 = getRow('STU002')
      fireEvent.change(within(row2).getAllByRole('textbox')[1], {
        target: { value: 'Student2 sem2 note' },
      })

      // Edit student 1's annual remark (last textbox in the row).
      const row1Textboxes = within(row1).getAllByRole('textbox')
      fireEvent.change(row1Textboxes[row1Textboxes.length - 1], {
        target: { value: 'Great year overall' },
      })

      fireEvent.click(
        screen.getByRole('button', { name: 'evaluations.saveBtn' }),
      )

      await waitFor(() =>
        expect(saveSemesterResultMock).toHaveBeenCalledTimes(2),
      )
      expect(saveSemesterResultMock).toHaveBeenCalledWith({
        requesterId,
        studentClassId: studentClassId1,
        semesterId: semesterId1,
        morality: undefined,
        teacherNote: 'Student1 sem1 note',
        isCompleted: false,
      })
      expect(saveSemesterResultMock).toHaveBeenCalledWith({
        requesterId,
        studentClassId: studentClassId2,
        semesterId: semesterId2,
        morality: undefined,
        teacherNote: 'Student2 sem2 note',
        isCompleted: false,
      })

      await waitFor(() =>
        expect(saveAnnualResultMock).toHaveBeenCalledWith({
          requesterId,
          studentClassId: studentClassId1,
          conductGrade: undefined,
          remark: 'Great year overall',
          isCompleted: false,
        }),
      )

      await waitFor(() => expect(toast.success).toHaveBeenCalled())
    })

    test('shows an error toast and logs the error when a save fails', async () => {
      saveSemesterResultMock.mockRejectedValueOnce(new Error('network error'))
      mockQueries({ semesters: makeSemesters(1) })
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      renderBoard()

      const row1 = getRow('STU001')
      fireEvent.change(within(row1).getAllByRole('textbox')[0], {
        target: { value: 'will fail' },
      })
      fireEvent.click(
        screen.getByRole('button', { name: 'evaluations.saveBtn' }),
      )

      await waitFor(() => expect(toast.error).toHaveBeenCalled())
      expect(consoleErrorSpy).toHaveBeenCalled()
      expect(toast.success).not.toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })

    test('falls back to the translated error message when the thrown error has no message', async () => {
      saveSemesterResultMock.mockRejectedValueOnce(new Error(''))
      mockQueries({ semesters: makeSemesters(1) })
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      renderBoard()

      const row1 = getRow('STU001')
      fireEvent.change(within(row1).getAllByRole('textbox')[0], {
        target: { value: 'will fail' },
      })
      fireEvent.click(
        screen.getByRole('button', { name: 'evaluations.saveBtn' }),
      )

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith('evaluations.saveError'),
      )

      consoleErrorSpy.mockRestore()
    })

    test('disables the Save button while a save is in flight', async () => {
      let resolveSave: () => void = () => {}
      const savePromise = new Promise<void>((resolve) => {
        resolveSave = resolve
      })
      saveSemesterResultMock.mockReturnValueOnce(savePromise)
      mockQueries({ semesters: makeSemesters(1) })
      renderBoard()

      const row1 = getRow('STU001')
      fireEvent.change(within(row1).getAllByRole('textbox')[0], {
        target: { value: 'in flight' },
      })

      const saveBtn = screen.getByRole('button', {
        name: 'evaluations.saveBtn',
      })
      fireEvent.click(saveBtn)

      expect(saveBtn).toBeDisabled()

      resolveSave()
      await waitFor(() =>
        expect(saveSemesterResultMock).toHaveBeenCalledTimes(1),
      )
    })
  })

  describe('Select and Checkbox interactions', () => {
    test('choosing a morality option, then resetting it to "Not set", updates only that semester column', () => {
      mockQueries({ semesters: makeSemesters(2) })
      renderBoard()

      const row = getRow('STU001')
      const moralityTrigger = within(row).getAllByRole('combobox')[0]

      fireEvent.click(moralityTrigger)
      const goodOption = screen.getByRole('option', {
        name: 'evaluations.morality.good',
      })
      fireEvent.pointerDown(goodOption)
      fireEvent.click(goodOption)

      expect(moralityTrigger).toHaveTextContent('evaluations.morality.good')
      // The other semester's morality select is unaffected.
      expect(within(row).getAllByRole('combobox')[1]).toHaveTextContent(
        'evaluations.notSet',
      )

      fireEvent.click(moralityTrigger)
      const notSetOption = screen.getByRole('option', {
        name: 'evaluations.notSet',
      })
      fireEvent.pointerDown(notSetOption)
      fireEvent.click(notSetOption)

      expect(moralityTrigger).toHaveTextContent('evaluations.notSet')
    })

    test('choosing an Annual conduct grade, then resetting it, updates the Annual conduct column', () => {
      mockQueries({ semesters: makeSemesters(1) })
      renderBoard()

      const row = getRow('STU001')
      const comboboxes = within(row).getAllByRole('combobox')
      const annualConductTrigger = comboboxes[comboboxes.length - 1]

      fireEvent.click(annualConductTrigger)
      const excellentOption = screen.getByRole('option', {
        name: 'evaluations.morality.excellent',
      })
      fireEvent.pointerDown(excellentOption)
      fireEvent.click(excellentOption)

      expect(annualConductTrigger).toHaveTextContent(
        'evaluations.morality.excellent',
      )

      fireEvent.click(annualConductTrigger)
      const notSetOption = screen.getByRole('option', {
        name: 'evaluations.notSet',
      })
      fireEvent.pointerDown(notSetOption)
      fireEvent.click(notSetOption)

      expect(annualConductTrigger).toHaveTextContent('evaluations.notSet')
    })

    test('toggling the Annual completed checkbox does not affect a semester completed checkbox', () => {
      mockQueries({ semesters: makeSemesters(1) })
      renderBoard()

      const row = getRow('STU001')
      const checkboxes = within(row).getAllByRole('checkbox')
      const semesterCheckbox = checkboxes[0]
      const annualCheckbox = checkboxes[checkboxes.length - 1]

      fireEvent.click(annualCheckbox)

      expect(annualCheckbox).toHaveAttribute('aria-checked', 'true')
      expect(semesterCheckbox).toHaveAttribute('aria-checked', 'false')
    })
  })

  describe('canManage=false (read-only mode)', () => {
    test('disables every select, input, and checkbox and hides the Save button', () => {
      mockQueries({ semesters: makeSemesters(2) })
      renderBoard({ canManage: false })

      expect(
        screen.queryByRole('button', { name: 'evaluations.saveBtn' }),
      ).not.toBeInTheDocument()

      const row = getRow('STU001')
      for (const combobox of within(row).getAllByRole('combobox')) {
        expect(combobox).toBeDisabled()
      }
      for (const textbox of within(row).getAllByRole('textbox')) {
        expect(textbox).toBeDisabled()
      }
      for (const checkbox of within(row).getAllByRole('checkbox')) {
        expect(checkbox).toHaveAttribute('aria-disabled', 'true')
      }
    })
  })

  describe('enrollment status filtering', () => {
    test('only renders active enrollments, excluding withdrawn/on_leave students', () => {
      mockQueries({ semesters: makeSemesters(1) })
      renderBoard()

      expect(screen.getByText('STU001')).toBeInTheDocument()
      expect(screen.getByText('STU002')).toBeInTheDocument()
      expect(screen.queryByText('STU003')).not.toBeInTheDocument()
      expect(screen.queryByText('Le Van C')).not.toBeInTheDocument()
    })

    test('excludes an "on_leave" enrollment as well', () => {
      mockQueries({ semesters: makeSemesters(1) })
      renderBoard({
        students: [
          activeStudentRow1,
          {
            enrollment: {
              _id: studentClassId2,
              status: 'on_leave' as const,
              enrolledDate: '2026-01-01',
            },
            student: makeStudent({
              _id: studentId2,
              studentCode: 'STU002',
              fullName: 'Tran Thi B',
            }),
          },
        ],
      })

      expect(screen.getByText('STU001')).toBeInTheDocument()
      expect(screen.queryByText('STU002')).not.toBeInTheDocument()
    })

    test('skips an active enrollment row whose student record is null rather than throwing', () => {
      mockQueries({ semesters: makeSemesters(1) })

      expect(() =>
        renderBoard({
          students: [
            activeStudentRow1,
            {
              enrollment: {
                _id: studentClassId4,
                status: 'active' as const,
                enrolledDate: '2026-01-01',
              },
              student: null,
            },
          ],
        }),
      ).not.toThrow()

      expect(screen.getByText('STU001')).toBeInTheDocument()
      // Only one data row (the null-student row renders nothing).
      const table = screen.getByRole('table')
      const bodyRows = within(table.querySelector('tbody')!).getAllByRole('row')
      expect(bodyRows).toHaveLength(1)
    })
  })

  describe('student name rendering', () => {
    test('prefixes the full name with the saint name when present', () => {
      mockQueries({ semesters: makeSemesters(1) })
      renderBoard()

      expect(screen.getByText('Peter Nguyen Van A')).toBeInTheDocument()
      // No saint name -> fullName rendered alone.
      expect(screen.getByText('Tran Thi B')).toBeInTheDocument()
    })
  })

  describe('requesterId skip behavior', () => {
    test('skips the Annual results query (stays loading) when requesterId is falsy', () => {
      mockQueries({ semesters: makeSemesters(1) })
      const { container } = render(
        <EvaluationsBoard
          classYearId={classYearId}
          academicYearId={academicYearId}
          requesterId={'' as Id<'catechists'>}
          canManage={true}
          students={defaultStudents}
        />,
      )

      expect(
        container.querySelector('[data-slot="skeleton"]'),
      ).toBeInTheDocument()
      expect(screen.queryByRole('table')).not.toBeInTheDocument()
    })
  })
})
