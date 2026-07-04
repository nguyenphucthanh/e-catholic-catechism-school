import { describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { useQuery } from 'convex/react'
import { EnrollmentSummary } from './enrollment-summary'
import type { Id } from '../../../convex/_generated/dataModel'
import { formatDate } from '~/lib/locale'

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

interface AttendanceRecordFixture {
  _id: string
  sessionId: string
  sessionDate: string
  sessionType: string
  status: 'present' | 'late' | 'excused_absence' | 'unexcused_absence'
  notes?: string
}

function makeRecords(): Array<AttendanceRecordFixture> {
  return [
    {
      _id: 'r1',
      sessionId: 's1',
      sessionDate: '2024-10-01',
      sessionType: 'catechism',
      status: 'present',
    },
    {
      _id: 'r2',
      sessionId: 's2',
      sessionDate: '2024-10-08',
      sessionType: 'catechism',
      status: 'present',
    },
    {
      _id: 'r3',
      sessionId: 's3',
      sessionDate: '2024-10-15',
      sessionType: 'mass',
      status: 'late',
    },
    {
      _id: 'r4',
      sessionId: 's4',
      sessionDate: '2024-10-22',
      sessionType: 'catechism',
      status: 'excused_absence',
      notes: 'Doctor appointment',
    },
    {
      _id: 'r5',
      sessionId: 's5',
      sessionDate: '2024-10-29',
      sessionType: 'catechism',
      status: 'unexcused_absence',
    },
  ]
}

/**
 * Mocks the two distinct useQuery calls made by EnrollmentSummary /
 * AttendanceRecordsDialog, branching on the Convex function reference (see
 * project memory: convex-usequery-mocking). Both params are required (no
 * defaults) so a test can't accidentally get a default summary/records value
 * when it explicitly means to pass `undefined` for a loading state.
 */
function mockUseQuery({
  summary,
  records,
}: {
  summary: ReturnType<typeof makeSummaryData> | null | undefined
  records: Array<AttendanceRecordFixture> | undefined
}) {
  vi.mocked(useQuery).mockImplementation(((queryRef: any, args?: any) => {
    const path = queryRef?.[Symbol.for('functionName')]
    if (path === 'students:getEnrollmentSummary') return summary
    if (path === 'attendance:listAttendanceRecordsForStudentClass') {
      return args === 'skip' ? undefined : records
    }
    return undefined
  }) as any)
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
 * any other numbers rendered on the page). Scopes to the enclosing shadcn
 * Card (data-slot="card") rather than the nearest ancestor div, since the
 * label and value now live in separate CardHeader/CardContent divs.
 */
function statValue(labelKey: string): string {
  const label = screen.getByText(labelKey)
  const card = label.closest('[data-slot="card"]') as HTMLElement
  const valueEl = card.querySelector('p.text-2xl') as HTMLElement
  return valueEl.textContent
}

function clickTab(name: string) {
  fireEvent.click(screen.getByRole('tab', { name }))
}

function clickStatCard(labelKey: string) {
  const label = screen.getByText(labelKey)
  const button = label.closest('button')
  fireEvent.click(button!)
}

describe('EnrollmentSummary', () => {
  describe('loading state', () => {
    test('renders skeletons and no tabs while the query is loading', () => {
      mockUseQuery({ summary: undefined, records: undefined })
      const { container } = renderSummary()

      expect(
        container.querySelector('[data-slot="skeleton"]'),
      ).toBeInTheDocument()
      expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    })
  })

  describe('null state', () => {
    test('renders the not-found message when the enrollment is missing/deleted', () => {
      mockUseQuery({ summary: null, records: undefined })
      renderSummary()

      expect(
        screen.getByText('students.enrollments.noRecord'),
      ).toBeInTheDocument()
      expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    })
  })

  describe('attendance tab (default)', () => {
    test('renders present/late/excused/unexcused counts and the formatted rate', () => {
      mockUseQuery({ summary: makeSummaryData(), records: [] })
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
      mockUseQuery({
        summary: makeSummaryData({
          attendance: {
            present: 0,
            late: 0,
            excusedAbsence: 0,
            unexcusedAbsence: 0,
            total: 0,
            rate: 0,
          },
        }),
        records: [],
      })
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

  describe('attendance records dialog', () => {
    test('the rate card is not clickable and has no button wrapper', () => {
      mockUseQuery({ summary: makeSummaryData(), records: makeRecords() })
      renderSummary()

      const label = screen.getByText(
        'students.enrollments.summary.attendance.rate',
      )
      expect(label.closest('button')).toBeNull()

      // Clicking the card itself (not a button) must not open the dialog.
      const card = label.closest('[data-slot="card"]') as HTMLElement
      fireEvent.click(card)
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    test('clicking "present" opens a dialog showing only present records with no reason line', () => {
      mockUseQuery({ summary: makeSummaryData(), records: makeRecords() })
      renderSummary()

      clickStatCard('students.enrollments.summary.attendance.present')

      const dialog = screen.getByRole('dialog')
      expect(
        within(dialog).getByText('attendance.status.present'),
      ).toBeInTheDocument()
      expect(
        within(dialog).getByText(formatDate('2024-10-01')),
      ).toBeInTheDocument()
      expect(
        within(dialog).getByText(formatDate('2024-10-08')),
      ).toBeInTheDocument()
      expect(
        within(dialog).getAllByText('attendance.sessionType.catechism'),
      ).toHaveLength(2)

      // Present/late statuses never render a reason line.
      expect(
        within(dialog).queryByText(
          'students.enrollments.summary.attendance.records.reason',
          { exact: false },
        ),
      ).not.toBeInTheDocument()
    })

    test('clicking "excused_absence" shows the reason line using record.notes when present', () => {
      mockUseQuery({ summary: makeSummaryData(), records: makeRecords() })
      renderSummary()

      clickStatCard('students.enrollments.summary.attendance.excusedAbsence')

      const dialog = screen.getByRole('dialog')
      expect(
        within(dialog).getByText('attendance.status.excused_absence'),
      ).toBeInTheDocument()
      expect(
        within(dialog).getByText(formatDate('2024-10-22')),
      ).toBeInTheDocument()
      expect(within(dialog).getByText('Doctor appointment')).toBeInTheDocument()
      expect(
        within(dialog).queryByText(
          'students.enrollments.summary.attendance.records.noReason',
        ),
      ).not.toBeInTheDocument()
    })

    test('shows the no-reason-provided i18n key when notes is absent on an absence record', () => {
      mockUseQuery({ summary: makeSummaryData(), records: makeRecords() })
      renderSummary()

      clickStatCard('students.enrollments.summary.attendance.unexcusedAbsence')

      const dialog = screen.getByRole('dialog')
      expect(
        within(dialog).getByText('attendance.status.unexcused_absence'),
      ).toBeInTheDocument()
      expect(
        within(dialog).getByText(
          'students.enrollments.summary.attendance.records.noReason',
        ),
      ).toBeInTheDocument()
    })

    test('shows skeleton loaders while records are still loading, not the empty-state message', () => {
      mockUseQuery({ summary: makeSummaryData(), records: undefined })
      renderSummary()

      clickStatCard('students.enrollments.summary.attendance.present')

      const dialog = screen.getByRole('dialog')
      expect(
        within(dialog).queryAllByText(
          'students.enrollments.summary.attendance.records.empty',
        ),
      ).toHaveLength(0)
      expect(
        dialog.querySelectorAll('[data-slot="skeleton"]').length,
      ).toBeGreaterThan(0)
    })

    test('shows the empty-state message when the filtered records list is empty', () => {
      // No "late" records in this fixture -- filtering by "late" yields [].
      mockUseQuery({
        summary: makeSummaryData(),
        records: makeRecords().filter((r) => r.status !== 'late'),
      })
      renderSummary()

      clickStatCard('students.enrollments.summary.attendance.late')

      const dialog = screen.getByRole('dialog')
      expect(
        within(dialog).getByText(
          'students.enrollments.summary.attendance.records.empty',
        ),
      ).toBeInTheDocument()
      expect(dialog.querySelector('[data-slot="skeleton"]')).toBeNull()
    })

    test('closing the dialog resets selectedStatus back to null', () => {
      mockUseQuery({ summary: makeSummaryData(), records: makeRecords() })
      renderSummary()

      clickStatCard('students.enrollments.summary.attendance.present')
      const dialog = screen.getByRole('dialog')

      fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  describe('grading tab', () => {
    test('groups exams by semester and renders exam name/score', () => {
      mockUseQuery({ summary: makeSummaryData(), records: [] })
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
      mockUseQuery({
        summary: makeSummaryData({
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
        records: [],
      })
      renderSummary()

      clickTab('students.enrollments.summary.tabs.grading')

      expect(
        screen.getByText('students.enrollments.summary.grading.semesterLabel'),
      ).toBeInTheDocument()
    })

    test('shows the no-grading-recorded message when grading is empty', () => {
      mockUseQuery({
        summary: makeSummaryData({ grading: [] }),
        records: [],
      })
      renderSummary()

      clickTab('students.enrollments.summary.tabs.grading')

      expect(
        screen.getByText('students.enrollments.summary.grading.noRecord'),
      ).toBeInTheDocument()
    })

    test('renders an em dash when both scoreValue and scoreLabel are absent', () => {
      mockUseQuery({
        summary: makeSummaryData({
          grading: [
            {
              semesterId: 'sem1',
              semesterName: 'Semester 1',
              semesterNumber: 1,
              exams: [{ columnName: 'Unscored Exam', columnType: 'numeric' }],
            },
          ],
        }),
        records: [],
      })
      renderSummary()

      clickTab('students.enrollments.summary.tabs.grading')

      expect(screen.getByText('Unscored Exam')).toBeInTheDocument()
      expect(screen.getByText('—')).toBeInTheDocument()
    })

    test('renders scoreLabel instead of an em dash when scoreValue is absent', () => {
      mockUseQuery({
        summary: makeSummaryData({
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
        records: [],
      })
      renderSummary()

      clickTab('students.enrollments.summary.tabs.grading')

      expect(screen.getByText('Excellent')).toBeInTheDocument()
      expect(screen.queryByText('—')).not.toBeInTheDocument()
    })
  })

  describe('semester/year tab', () => {
    test('renders semester results with morality badge, teacher note, and completed badge', () => {
      mockUseQuery({ summary: makeSummaryData(), records: [] })
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
      mockUseQuery({
        summary: makeSummaryData({
          semesterResults: [
            {
              semesterId: 'sem1',
              semesterName: 'Semester 1',
              semesterNumber: 1,
              isCompleted: false,
            },
          ],
        }),
        records: [],
      })
      renderSummary()

      clickTab('students.enrollments.summary.tabs.semesterYear')

      expect(screen.getByText('students.status.withdrawn')).toBeInTheDocument()
    })

    test('renders annual result with conduct grade badge and remark', () => {
      mockUseQuery({ summary: makeSummaryData(), records: [] })
      renderSummary()

      clickTab('students.enrollments.summary.tabs.semesterYear')

      // Both the semester result and the annual result use morality 'good' /
      // conductGrade 'good' in the default fixture, so this key renders twice.
      expect(
        screen.getAllByText('evaluations.morality.good').length,
      ).toBeGreaterThanOrEqual(2)
      expect(screen.getByText('Well done overall.')).toBeInTheDocument()
    })

    test('falls back to the default text color for an unmapped morality/conduct grade', () => {
      mockUseQuery({
        summary: makeSummaryData({
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
        records: [],
      })
      renderSummary()

      clickTab('students.enrollments.summary.tabs.semesterYear')

      const values = screen.getAllByText('evaluations.morality.unmapped_value')
      expect(values).toHaveLength(2)
      values.forEach((value) => expect(value).toHaveClass('text-foreground'))
    })

    test('omits the completed/withdrawn badge entirely when isCompleted is undefined', () => {
      mockUseQuery({
        summary: makeSummaryData({
          semesterResults: [
            {
              semesterId: 'sem1',
              semesterName: 'Semester 1',
              semesterNumber: 1,
            },
          ],
          annualResult: {},
        }),
        records: [],
      })
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
      mockUseQuery({
        summary: makeSummaryData({
          annualResult: { conductGrade: 'good', isCompleted: false },
        }),
        records: [],
      })
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
      mockUseQuery({
        summary: makeSummaryData({ semesterResults: [], annualResult: null }),
        records: [],
      })
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
