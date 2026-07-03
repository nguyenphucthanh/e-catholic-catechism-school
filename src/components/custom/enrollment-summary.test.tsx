import { describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useQuery } from 'convex/react'
import { EnrollmentSummary } from './enrollment-summary'
import type { Id } from '../../../convex/_generated/dataModel'

const studentClassId = 'sc1' as Id<'studentClasses'>
const requesterId = 'catechist1' as Id<'catechists'>

interface SummaryDataOverrides {
  attendance?: {
    present: number
    late: number
    excusedAbsence: number
    unexcusedAbsence: number
    total: number
    rate: number
  }
  grading?: Array<{
    semesterId: string
    semesterName?: string
    semesterNumber: number
    exams: Array<{
      columnName: string
      columnType: string
      scoreValue?: number
      scoreLabel?: string
    }>
  }>
  semesterResults?: Array<{
    semesterId: string
    semesterName?: string
    semesterNumber: number
    morality?: string
    teacherNote?: string
    isCompleted?: boolean
  }>
  annualResult?: {
    conductGrade?: string
    remark?: string
    isCompleted?: boolean
  } | null
}

function makeSummaryData(overrides: SummaryDataOverrides = {}) {
  return {
    attendance: {
      present: 6,
      late: 1,
      excusedAbsence: 2,
      unexcusedAbsence: 1,
      total: 10,
      rate: 0.6,
    },
    grading: [
      {
        semesterId: 'sem1',
        semesterName: 'Semester 1',
        semesterNumber: 1,
        exams: [
          { columnName: 'Midterm', columnType: 'numeric', scoreValue: 8.5 },
        ],
      },
    ],
    semesterResults: [
      {
        semesterId: 'sem1',
        semesterName: 'Semester 1',
        semesterNumber: 1,
        morality: 'good',
        teacherNote: 'Great progress this semester.',
        isCompleted: true,
      },
    ],
    annualResult: {
      conductGrade: 'good',
      remark: 'Well done overall.',
      isCompleted: true,
    },
    ...overrides,
  }
}

function renderSummary() {
  return render(
    <EnrollmentSummary
      studentClassId={studentClassId}
      requesterId={requesterId}
    />,
  )
}

/**
 * Reads the value of a StatBlock scoped by its label text (avoids
 * "found multiple elements" collisions between the label's raw i18n key and
 * any other numbers rendered on the page).
 */
function statValue(labelKey: string): string {
  const label = screen.getByText(labelKey)
  const block = label.closest('div') as HTMLElement
  const valueEl = block.querySelector('p.text-lg') as HTMLElement
  return valueEl.textContent || ''
}

function clickTab(name: string) {
  fireEvent.click(screen.getByRole('tab', { name }))
}

describe('EnrollmentSummary', () => {
  describe('loading state', () => {
    test('renders skeletons and no tabs while the query is loading', () => {
      vi.mocked(useQuery).mockReturnValue(undefined)
      const { container } = renderSummary()

      expect(
        container.querySelector('[data-slot="skeleton"]'),
      ).toBeInTheDocument()
      expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    })
  })

  describe('null state', () => {
    test('renders the not-found message when the enrollment is missing/deleted', () => {
      vi.mocked(useQuery).mockReturnValue(null)
      renderSummary()

      expect(
        screen.getByText('students.enrollments.noRecord'),
      ).toBeInTheDocument()
      expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    })
  })

  describe('attendance tab (default)', () => {
    test('renders present/late/excused/unexcused counts and the formatted rate', () => {
      vi.mocked(useQuery).mockReturnValue(makeSummaryData())
      renderSummary()

      expect(statValue('students.enrollments.summary.attendance.present')).toBe(
        '6',
      )
      expect(statValue('students.enrollments.summary.attendance.late')).toBe(
        '1',
      )
      expect(
        statValue('students.enrollments.summary.attendance.excusedAbsence'),
      ).toBe('2')
      expect(
        statValue('students.enrollments.summary.attendance.unexcusedAbsence'),
      ).toBe('1')
      expect(statValue('students.enrollments.summary.attendance.rate')).toBe(
        '60.0%',
      )

      expect(
        screen.queryByText('students.enrollments.summary.attendance.noRecord'),
      ).not.toBeInTheDocument()
    })

    test('shows the no-attendance-recorded message when total is 0', () => {
      vi.mocked(useQuery).mockReturnValue(
        makeSummaryData({
          attendance: {
            present: 0,
            late: 0,
            excusedAbsence: 0,
            unexcusedAbsence: 0,
            total: 0,
            rate: 0,
          },
        }),
      )
      renderSummary()

      expect(
        screen.getByText('students.enrollments.summary.attendance.noRecord'),
      ).toBeInTheDocument()
      // Stat values still render (all zero) alongside the empty message.
      expect(statValue('students.enrollments.summary.attendance.present')).toBe(
        '0',
      )
    })
  })

  describe('grading tab', () => {
    test('groups exams by semester and renders exam name/score', () => {
      vi.mocked(useQuery).mockReturnValue(makeSummaryData())
      renderSummary()

      clickTab('students.enrollments.summary.tabs.grading')

      expect(screen.getByText('Semester 1')).toBeInTheDocument()
      expect(screen.getByText('Midterm')).toBeInTheDocument()
      expect(screen.getByText('8.5')).toBeInTheDocument()
      // Attendance panel content should no longer be mounted (Tabs
      // unmounts inactive panels by default in this project's Base UI setup).
      expect(
        screen.queryByText('students.enrollments.summary.attendance.present'),
      ).not.toBeInTheDocument()
    })

    test('falls back to the semesterLabel i18n key when semesterName is absent', () => {
      vi.mocked(useQuery).mockReturnValue(
        makeSummaryData({
          grading: [
            {
              semesterId: 'sem2',
              semesterNumber: 2,
              exams: [
                {
                  columnName: 'Final',
                  columnType: 'numeric',
                  scoreValue: 9,
                },
              ],
            },
          ],
        }),
      )
      renderSummary()

      clickTab('students.enrollments.summary.tabs.grading')

      expect(
        screen.getByText('students.enrollments.summary.grading.semesterLabel'),
      ).toBeInTheDocument()
    })

    test('shows the no-grading-recorded message when grading is empty', () => {
      vi.mocked(useQuery).mockReturnValue(makeSummaryData({ grading: [] }))
      renderSummary()

      clickTab('students.enrollments.summary.tabs.grading')

      expect(
        screen.getByText('students.enrollments.summary.grading.noRecord'),
      ).toBeInTheDocument()
    })

    test('renders an em dash when both scoreValue and scoreLabel are absent', () => {
      vi.mocked(useQuery).mockReturnValue(
        makeSummaryData({
          grading: [
            {
              semesterId: 'sem1',
              semesterName: 'Semester 1',
              semesterNumber: 1,
              exams: [{ columnName: 'Unscored Exam', columnType: 'numeric' }],
            },
          ],
        }),
      )
      renderSummary()

      clickTab('students.enrollments.summary.tabs.grading')

      expect(screen.getByText('Unscored Exam')).toBeInTheDocument()
      expect(screen.getByText('—')).toBeInTheDocument()
    })

    test('renders scoreLabel instead of an em dash when scoreValue is absent', () => {
      vi.mocked(useQuery).mockReturnValue(
        makeSummaryData({
          grading: [
            {
              semesterId: 'sem1',
              semesterName: 'Semester 1',
              semesterNumber: 1,
              exams: [
                {
                  columnName: 'Participation',
                  columnType: 'qualitative',
                  scoreLabel: 'Excellent',
                },
              ],
            },
          ],
        }),
      )
      renderSummary()

      clickTab('students.enrollments.summary.tabs.grading')

      expect(screen.getByText('Excellent')).toBeInTheDocument()
      expect(screen.queryByText('—')).not.toBeInTheDocument()
    })
  })

  describe('semester/year tab', () => {
    test('renders semester results with morality badge, teacher note, and completed badge', () => {
      vi.mocked(useQuery).mockReturnValue(makeSummaryData())
      renderSummary()

      clickTab('students.enrollments.summary.tabs.semesterYear')

      // Both the semester result and the annual result use morality/conduct
      // grade 'good' and isCompleted true in the default fixture.
      expect(screen.getAllByText('evaluations.morality.good')).toHaveLength(2)
      expect(
        screen.getByText('Great progress this semester.'),
      ).toBeInTheDocument()
      expect(screen.getAllByText('evaluations.isCompleted')).toHaveLength(2)
    })

    test('renders the withdrawn badge when isCompleted is false', () => {
      vi.mocked(useQuery).mockReturnValue(
        makeSummaryData({
          semesterResults: [
            {
              semesterId: 'sem1',
              semesterName: 'Semester 1',
              semesterNumber: 1,
              isCompleted: false,
            },
          ],
        }),
      )
      renderSummary()

      clickTab('students.enrollments.summary.tabs.semesterYear')

      expect(screen.getByText('students.status.withdrawn')).toBeInTheDocument()
    })

    test('renders annual result with conduct grade badge and remark', () => {
      vi.mocked(useQuery).mockReturnValue(makeSummaryData())
      renderSummary()

      clickTab('students.enrollments.summary.tabs.semesterYear')

      // Both the semester result and the annual result use morality 'good' /
      // conductGrade 'good' in the default fixture, so this key renders twice.
      expect(
        screen.getAllByText('evaluations.morality.good').length,
      ).toBeGreaterThanOrEqual(2)
      expect(screen.getByText('Well done overall.')).toBeInTheDocument()
    })

    test('falls back to the outline badge variant for an unmapped morality/conduct grade', () => {
      vi.mocked(useQuery).mockReturnValue(
        makeSummaryData({
          semesterResults: [
            {
              semesterId: 'sem1',
              semesterName: 'Semester 1',
              semesterNumber: 1,
              morality: 'unmapped_value',
            },
          ],
          annualResult: { conductGrade: 'unmapped_value' },
        }),
      )
      renderSummary()

      clickTab('students.enrollments.summary.tabs.semesterYear')

      const badges = screen.getAllByText('evaluations.morality.unmapped_value')
      expect(badges).toHaveLength(2)
      badges.forEach((badge) =>
        expect(badge.closest('[data-slot="badge"]')).toHaveAttribute(
          'data-variant',
          'outline',
        ),
      )
    })

    test('omits the completed/withdrawn badge entirely when isCompleted is undefined', () => {
      vi.mocked(useQuery).mockReturnValue(
        makeSummaryData({
          semesterResults: [
            {
              semesterId: 'sem1',
              semesterName: 'Semester 1',
              semesterNumber: 1,
            },
          ],
          annualResult: {},
        }),
      )
      renderSummary()

      clickTab('students.enrollments.summary.tabs.semesterYear')

      expect(
        screen.queryByText('evaluations.isCompleted'),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByText('students.status.withdrawn'),
      ).not.toBeInTheDocument()
    })

    test('renders the withdrawn badge for the annual result when isCompleted is false', () => {
      vi.mocked(useQuery).mockReturnValue(
        makeSummaryData({
          annualResult: { conductGrade: 'good', isCompleted: false },
        }),
      )
      renderSummary()

      clickTab('students.enrollments.summary.tabs.semesterYear')

      // The semester result (isCompleted: true, default fixture) still shows
      // the completed badge, so both keys are present -- assert at least one
      // withdrawn badge (the annual one) exists.
      expect(
        screen.getAllByText('students.status.withdrawn').length,
      ).toBeGreaterThanOrEqual(1)
    })

    test('shows empty-state messages when semesterResults is empty and annualResult is null', () => {
      vi.mocked(useQuery).mockReturnValue(
        makeSummaryData({ semesterResults: [], annualResult: null }),
      )
      renderSummary()

      clickTab('students.enrollments.summary.tabs.semesterYear')

      expect(
        screen.getByText('students.enrollments.summary.semester.noRecord'),
      ).toBeInTheDocument()
      expect(
        screen.getByText('students.enrollments.summary.annual.noRecord'),
      ).toBeInTheDocument()
    })
  })
})
