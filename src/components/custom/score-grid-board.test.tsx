import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useQuery } from 'convex/react'
import { ScoreGridBoard } from './score-grid-board'
import type { Id } from '../../../convex/_generated/dataModel'
import { exportCsv } from '~/lib/export'

// Only CSV export behavior is covered here (per project scope) -- this
// component has no prior sibling test file.
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
const col1 = 'col1' as Id<'scoreColumns'>
const col2 = 'col2' as Id<'scoreColumns'>
const col3 = 'col3' as Id<'scoreColumns'>
const semesterId1 = 'sem1' as Id<'semesters'>

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
        sortOrder: 1,
        semesterId: semesterId1,
      },
      {
        _id: col2,
        columnName: 'Hạnh kiểm',
        columnType: 'conduct',
        scaleType: 'pass_fail' as const,
        sortOrder: 2,
        semesterId: semesterId1,
      },
      {
        _id: col3,
        columnName: 'Xếp loại',
        columnType: 'classification',
        scaleType: 'letter_af' as const,
        sortOrder: 3,
        semesterId: semesterId1,
      },
    ],
    scoreEntriesMap: {
      [`${studentClassId1}_${col1}`]: { _id: 'e1', scoreValue: 8.5 },
      [`${studentClassId1}_${col2}`]: { _id: 'e2', scoreLabel: 'pass' },
      [`${studentClassId2}_${col2}`]: { _id: 'e3', scoreLabel: 'fail' },
      [`${studentClassId2}_${col3}`]: { _id: 'e4', scoreLabel: 'B+' },
    } as Record<
      string,
      { _id: string; scoreValue?: number; scoreLabel?: string }
    >,
  }
}

function mockQueries(gridData: ReturnType<typeof makeGridData> | undefined) {
  vi.mocked(useQuery).mockImplementation(((queryRef: any) => {
    const path = queryRef?.[Symbol.for('functionName')]
    if (path === 'grading:getScoresGrid') return gridData
    if (path === 'appConfig:get') return undefined
    if (path === 'academicYears:listSemesters') return []
    return undefined
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
  })

  describe('CSV export', () => {
    test('exports name-sorted rows with per-column values formatted per scaleType', () => {
      mockQueries(makeGridData())
      renderBoard()

      fireEvent.click(screen.getByText('classes.export.csv'))

      expect(exportCsv).toHaveBeenCalledTimes(1)
      const [rows, filename, headers] = vi.mocked(exportCsv).mock.calls[0]

      expect(filename).toBe('bang-diem.csv')
      expect(headers).toEqual([
        'exams.grid.studentName',
        'students.col.studentCode',
        'Kiểm tra 15 phút',
        'Hạnh kiểm',
        'Xếp loại',
      ])

      // Name-sorted: "Peter Nguyen Van A" before "Tran Thi B", even though
      // gridData.students declared them in the opposite order above.
      expect(rows).toHaveLength(2)
      expect(rows[0]['exams.grid.studentName']).toBe('Peter Nguyen Van A')
      expect(rows[0]['students.col.studentCode']).toBe('STU001')
      expect(rows[1]['exams.grid.studentName']).toBe('Tran Thi B')
      expect(rows[1]['students.col.studentCode']).toBe('STU002')

      // scale_10 -> toFixed(1); unset -> em dash.
      expect(rows[0]['Kiểm tra 15 phút']).toBe('8.5')
      expect(rows[1]['Kiểm tra 15 phút']).toBe('—')

      // pass_fail -> translated pass/fail badge keys.
      expect(rows[0]['Hạnh kiểm']).toBe('exams.grid.passBadge')
      expect(rows[1]['Hạnh kiểm']).toBe('exams.grid.failBadge')

      // letter_af -> raw label passed through; unset -> em dash.
      expect(rows[0]['Xếp loại']).toBe('—')
      expect(rows[1]['Xếp loại']).toBe('B+')
    })

    test('does not call exportCsv on render, only after clicking the button', () => {
      mockQueries(makeGridData())
      renderBoard()

      expect(exportCsv).not.toHaveBeenCalled()
    })
  })

  describe('semester averages', () => {
    test('does not throw when a student has no score entry for a column in the semester', () => {
      // studentClassId2 has no scoreEntriesMap entry for col1 -- this is the
      // sparse-map case that must not crash the semester-average computation.
      const gridData = makeGridData()
      vi.mocked(useQuery).mockImplementation(((queryRef: any) => {
        const path = queryRef?.[Symbol.for('functionName')]
        if (path === 'grading:getScoresGrid') return gridData
        if (path === 'appConfig:get') return undefined
        if (path === 'academicYears:listSemesters')
          return [{ _id: semesterId1, name: 'HK1', semesterNumber: 1 }]
        return undefined
      }) as any)

      expect(() => renderBoard()).not.toThrow()
    })
  })
})
