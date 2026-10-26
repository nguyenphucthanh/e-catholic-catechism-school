import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { useQuery } from 'convex/react'
import { DiligenceCard } from './diligence-card'
import { useAuth } from '~/lib/auth'

vi.mock('~/lib/academic-year', () => ({
  useSelectedAcademicYear: () => ({ selectedYearId: 'ay-1' }),
}))

// Interpolation-aware t so counts passed to i18n are assertable.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}|${JSON.stringify(opts)}` : key,
  }),
}))

const rate = (present: number, late: number, rateVal: number | null) => ({
  present,
  late,
  excused: 1,
  unexcused: 2,
  total: present + late + 3,
  rate: rateVal,
})

const summary = {
  classTeaching: rate(6, 2, 0.8),
  meeting: rate(1, 0, 0.25),
  overall: rate(7, 2, 0.5),
  unrecorded: 4 as number | null,
}

type Perms = { isAdmin?: boolean; isBoardMember?: boolean } | undefined

function setup(opts: { perms?: Perms; summary?: unknown }) {
  vi.mocked(useQuery).mockImplementation(((ref: any, args: any) => {
    const path = ref?.[Symbol.for('functionName')]
    if (path === 'catechistPermissions:getPermissions')
      return args === 'skip' ? undefined : opts.perms
    if (path === 'catechistAttendance:getCatechistAttendanceSummary')
      return args === 'skip' ? undefined : opts.summary
    return undefined
  }) as any)
}

const asUser = (id: string | null) =>
  vi.mocked(useAuth).mockReturnValue({
    user: id ? { accountType: 'catechist', userDocId: id } : null,
  } as any)

const callsTo = (name: string) =>
  vi
    .mocked(useQuery)
    .mock.calls.filter(
      ([ref]) => (ref as any)?.[Symbol.for('functionName')] === name,
    )

const SUMMARY_FN = 'catechistAttendance:getCatechistAttendanceSummary'
const PERMS_FN = 'catechistPermissions:getPermissions'

describe('DiligenceCard', () => {
  beforeEach(() => {
    vi.mocked(useQuery).mockReset()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('treats a non-catechist user as non-self and skips summary without permissions', () => {
    asUser(null)
    setup({ perms: { isAdmin: false, isBoardMember: false }, summary })
    const { container } = render(<DiligenceCard catechistId={'c-1' as any} />)
    expect(container).toBeEmptyDOMElement()
    expect(callsTo(SUMMARY_FN).every(([, a]) => a === 'skip')).toBe(true)
  })

  it('renders nothing and skips the summary for a non-admin viewing someone else', () => {
    asUser('c-2')
    setup({ perms: { isAdmin: false, isBoardMember: false }, summary })
    const { container } = render(<DiligenceCard catechistId={'c-1' as any} />)
    expect(container).toBeEmptyDOMElement()
    expect(callsTo(SUMMARY_FN).every(([, a]) => a === 'skip')).toBe(true)
  })

  it('skips the summary while permissions are still loading', () => {
    asUser('c-2')
    setup({ perms: undefined, summary })
    const { container } = render(<DiligenceCard catechistId={'c-1' as any} />)
    expect(container).toBeEmptyDOMElement()
    expect(callsTo(SUMMARY_FN).every(([, a]) => a === 'skip')).toBe(true)
  })

  it('self view skips the permissions query and fetches the summary', () => {
    asUser('c-1')
    setup({ summary })
    render(<DiligenceCard catechistId={'c-1' as any} />)
    expect(callsTo(PERMS_FN).every(([, a]) => a === 'skip')).toBe(true)
    expect(screen.getByText('diligence.title')).toBeInTheDocument()
    expect(callsTo(SUMMARY_FN).some(([, a]) => a !== 'skip')).toBe(true)
  })

  it.each([
    ['admin', { isAdmin: true }],
    ['board member', { isBoardMember: true }],
  ])('%s viewing another catechist sees the card', (_n, perms) => {
    asUser('c-2')
    setup({ perms, summary })
    render(<DiligenceCard catechistId={'c-1' as any} />)
    expect(screen.getByText('diligence.title')).toBeInTheDocument()
    expect(callsTo(PERMS_FN).at(-1)![1]).toEqual({
      academicYearId: 'ay-1',
    })
  })

  it('shows a skeleton while the summary loads', () => {
    asUser('c-1')
    setup({ summary: undefined })
    const { container } = render(<DiligenceCard catechistId={'c-1' as any} />)
    expect(screen.getByText('diligence.title')).toBeInTheDocument()
    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(2)
    expect(screen.queryByText('diligence.classTeaching')).toBeNull()
  })

  it('shows the empty state when nothing is recorded', () => {
    asUser('c-1')
    setup({
      summary: { ...summary, overall: { ...summary.overall, total: 0 } },
    })
    render(<DiligenceCard catechistId={'c-1' as any} />)
    expect(screen.getByText('diligence.empty')).toBeInTheDocument()
    expect(screen.queryByText('diligence.overall')).toBeNull()
  })

  const STATUS_LABELS = [
    'students.enrollments.summary.attendance.present',
    'students.enrollments.summary.attendance.late',
    'students.enrollments.summary.attendance.excusedAbsence',
    'students.enrollments.summary.attendance.unexcusedAbsence',
  ]

  // The 4 status cards (label + number) in the section under a given title.
  const sectionCounts = (titleKey: string) => {
    const section = screen.getByText(titleKey).closest('div')!
    return STATUS_LABELS.map((label) => {
      const card = within(section)
        .getByText(label)
        .closest('[data-slot="card"]')!
      return card.querySelector('p')!.textContent
    })
  }

  it('renders the percentage after each title and 4 status cards per section', () => {
    asUser('c-1')
    setup({ summary })
    render(<DiligenceCard catechistId={'c-1' as any} />)
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(screen.getByText('diligence.classTeaching')).toHaveTextContent(
      'diligence.classTeaching80%',
    )
    expect(screen.getByText('diligence.meetings')).toHaveTextContent(
      'diligence.meetings25%',
    )
    expect(screen.getByText('diligence.overall')).toHaveTextContent(
      'diligence.overall50%',
    )
    expect(sectionCounts('diligence.classTeaching')).toEqual([
      '6',
      '2',
      '1',
      '2',
    ])
    expect(sectionCounts('diligence.meetings')).toEqual(['1', '0', '1', '2'])
    expect(sectionCounts('diligence.overall')).toEqual(['7', '2', '1', '2'])
    expect(
      screen.getByText('diligence.unrecorded|{"count":4}'),
    ).toBeInTheDocument()
  })

  it('shows a dash for a null rate, and hides unrecorded when null', () => {
    asUser('c-1')
    setup({
      summary: {
        ...summary,
        meeting: rate(0, 0, null),
        unrecorded: null,
      },
    })
    render(<DiligenceCard catechistId={'c-1' as any} />)
    expect(screen.getByText('diligence.meetings')).toHaveTextContent(
      'diligence.meetings—',
    )
    expect(screen.queryByText(/diligence\.unrecorded/)).toBeNull()
  })

  it('passes requester, catechist, year and today (app timezone, YYYY-MM-DD)', () => {
    vi.useFakeTimers()
    // 20:00Z on the 14th is already the 15th in Asia/Ho_Chi_Minh (UTC+7).
    vi.setSystemTime(new Date('2026-03-14T20:00:00Z'))
    asUser('c-1')
    setup({ summary })
    render(<DiligenceCard catechistId={'c-1' as any} />)
    expect(callsTo(SUMMARY_FN).at(-1)![1]).toEqual({
      catechistId: 'c-1',
      academicYearId: 'ay-1',
      asOfDate: '2026-03-15',
    })
  })
})
