import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { useQuery } from 'convex/react'
import { Route } from './reports_.catechist-attendance'
import { useAuth } from '~/lib/auth'
import { exportCsv, exportPdf } from '~/lib/export'

vi.mock('~/lib/academic-year', () => ({
  useSelectedAcademicYear: () => ({ selectedYearId: 'ay-1' }),
}))
vi.mock('~/lib/export', () => ({ exportCsv: vi.fn(), exportPdf: vi.fn() }))

const REPORT_FN = 'catechistAttendance:getYearlyMatrixReport'

const targets = [
  { id: 's1', kind: 'class', date: '2024-10-06', label: 'Class A' },
  { id: 'm1', kind: 'meeting', date: '2024-10-13', label: 'Board meet' },
]
const totals = (o: Record<string, number | null>) => ({
  present: 0,
  late: 0,
  excused: 0,
  unexcused: 0,
  total: 0,
  rate: null,
  ...o,
})
const report = {
  truncated: false,
  targets,
  rows: [
    {
      catechistId: 'c-1',
      memberId: 'GLV1',
      saintName: 'Maria',
      fullName: 'Nguyen A',
      cells: ['present', 'late'],
      totals: totals({ present: 1, late: 1, total: 2, rate: 1 }),
    },
    {
      catechistId: 'c-2',
      memberId: 'GLV2',
      saintName: null,
      fullName: 'Tran B',
      cells: ['excused_absence', null],
      totals: totals({ excused: 1, total: 1, rate: 0 }),
    },
    {
      catechistId: 'c-3',
      memberId: 'GLV3',
      saintName: 'Anna',
      fullName: 'Le C',
      cells: ['unrecorded', 'unexcused_absence'],
      totals: totals({ unexcused: 1, total: 1, rate: 0 }),
    },
  ],
}
const branches = [
  { _id: 'b-1', name: 'Branch One' },
  { _id: 'b-2', name: 'Branch Two' },
]

type Setup = {
  perms?: Record<string, unknown> | undefined
  report?: unknown
}

function setup(o: Setup = {}) {
  const perms = 'perms' in o ? o.perms : { isAdmin: true }
  vi.mocked(useQuery).mockImplementation(((ref: any, args: any) => {
    const path = ref?.[Symbol.for('functionName')]
    if (path === 'catechistPermissions:getPermissions') return perms
    if (path === 'branches:list') return branches
    if (path === 'academicYears:get')
      return { startDate: '2024-09-01', endDate: '2025-05-31' }
    if (path === REPORT_FN)
      return args === 'skip' ? undefined : 'report' in o ? o.report : report
    return undefined
  }) as any)
}

const reportArgs = () => {
  const calls = vi
    .mocked(useQuery)
    .mock.calls.filter(
      ([r]) => (r as any)?.[Symbol.for('functionName')] === REPORT_FN,
    )
  return calls.at(-1)![1]
}

function renderPage() {
  const Component = (Route as any).options.component
  return render(<Component />)
}

// First combobox is the branch filter; the data-table pager has another.
const branchSelect = () => screen.getAllByRole('combobox')[0]

const rowOf = (name: string) =>
  screen.getByText(name).closest('tr') as HTMLElement

function openExport() {
  fireEvent.pointerDown(
    screen.getByRole('button', { name: /classes\.export\.title/ }),
  )
  fireEvent.click(
    screen.getByRole('button', { name: /classes\.export\.title/ }),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useAuth).mockReturnValue({
    login: vi.fn(),
    logout: vi.fn(),
    user: { accountType: 'catechist', userDocId: 'c-9' },
  } as any)
})

describe('catechist attendance report: access gating', () => {
  test('admin queries the whole year with no branch', () => {
    setup()
    renderPage()
    expect(reportArgs()).toEqual({
      requesterId: 'c-9',
      academicYearId: 'ay-1',
      branchId: undefined,
      kind: 'class',
      // today is past the year's end: clamp to its last 3 months
      fromDate: '2025-02-28',
      toDate: '2025-05-31',
    })
    expect(screen.getByText('Maria Nguyen A')).toBeInTheDocument()
  })

  test('board member sees all branches option', () => {
    setup({ perms: { isBoardMember: true } })
    renderPage()
    expect(reportArgs().branchId).toBeUndefined()
    expect(branchSelect()).toHaveTextContent(
      'reports.catechistAttendance.allBranches',
    )
  })

  test('branch head is forced to own first branch and has no all-branches option', () => {
    setup({ perms: { branchHeadOf: ['b-2'] } })
    renderPage()
    expect(reportArgs().branchId).toBe('b-2')
    const select = branchSelect()
    expect(select).toHaveTextContent('Branch Two')
    fireEvent.pointerDown(select)
    fireEvent.click(select)
    expect(screen.queryByText('Branch One')).toBeNull()
    expect(
      screen.queryByText('reports.catechistAttendance.allBranches'),
    ).toBeNull()
  })

  test('other users see contactAdmin and the report query is skipped', () => {
    setup({ perms: { isAdmin: false, isBoardMember: false, branchHeadOf: [] } })
    renderPage()
    expect(screen.getByText('common.contactAdmin')).toBeInTheDocument()
    expect(vi.mocked(useQuery)).toHaveBeenCalledWith(expect.anything(), 'skip')
    expect(screen.queryByText('Maria Nguyen A')).toBeNull()
    expect(
      screen.queryByRole('button', { name: /classes\.export\.title/ }),
    ).toBeNull()
  })

  test('skips every query when not a catechist account', () => {
    vi.mocked(useAuth).mockReturnValue({ user: null } as any)
    setup()
    renderPage()
    expect(reportArgs()).toBe('skip')
  })

  test('does not show contactAdmin while permissions load', () => {
    setup({ perms: undefined })
    renderPage()
    expect(screen.queryByText('common.contactAdmin')).toBeNull()
  })
})

describe('catechist attendance report: rendering', () => {
  test('shows skeleton while loading', () => {
    setup({ report: undefined })
    const { container } = renderPage()
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(5)
    expect(
      screen.queryByRole('button', { name: /classes\.export\.title/ }),
    ).toBeNull()
  })

  test('shows empty text and no export button without rows', () => {
    setup({ report: { ...report, rows: [] } })
    renderPage()
    expect(
      screen.getByText('reports.catechistAttendance.empty'),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /classes\.export\.title/ }),
    ).toBeNull()
  })

  test('renders dynamic target columns, rates and status cells', () => {
    setup()
    renderPage()
    const h1 = screen.getByRole('columnheader', { name: '06/10' })
    expect(h1.querySelector('[title="Class A"]')).not.toBeNull()
    const h2 = screen.getByRole('columnheader', { name: '13/10' })
    expect(h2.querySelector('[title="Board meet"]')).not.toBeNull()

    const r1 = within(rowOf('Maria Nguyen A'))
    expect(r1.getByText(/100%/)).toBeInTheDocument()
    expect(r1.getByText('(2/2)')).toBeInTheDocument()
    expect(r1.getByLabelText('attendance.status.present')).toHaveStyle({
      color: '#10B981',
    })
    expect(r1.getByLabelText('attendance.status.late')).toHaveStyle({
      color: '#F59E0B',
    })

    const r2 = within(rowOf('Tran B'))
    expect(r2.getByText(/0%/)).toBeInTheDocument()
    expect(r2.getByLabelText('attendance.status.excused_absence')).toHaveStyle({
      color: '#8B5CF6',
    })
    // null cell renders no icon
    expect(rowOf('Tran B').querySelectorAll('svg[aria-label]')).toHaveLength(1)

    const r3 = within(rowOf('Anna Le C'))
    expect(r3.getByLabelText('attendance.status.unset')).toHaveStyle({
      color: '#9CA3AF',
    })
    expect(
      r3.getByLabelText('attendance.status.unexcused_absence'),
    ).toHaveStyle({ color: '#EF4444' })
  })

  test('shows a dash for a null rate', () => {
    setup({
      report: {
        ...report,
        rows: [
          {
            ...report.rows[2],
            totals: totals({}),
            cells: ['unrecorded', null],
          },
        ],
      },
    })
    renderPage()
    expect(within(rowOf('Anna Le C')).getByText(/—/)).toBeInTheDocument()
  })

  test('truncated notice only when flagged', () => {
    setup()
    const { unmount } = renderPage()
    expect(
      screen.queryByText('reports.catechistAttendance.truncated'),
    ).toBeNull()
    unmount()
    setup({ report: { ...report, truncated: true } })
    renderPage()
    expect(
      screen.getByText('reports.catechistAttendance.truncated'),
    ).toBeInTheDocument()
  })

  test('selecting a branch re-queries with that branch id', () => {
    setup()
    renderPage()
    const select = branchSelect()
    fireEvent.pointerDown(select)
    fireEvent.click(select)
    const opt = screen.getByRole('option', { name: 'Branch One' })
    fireEvent.pointerDown(opt)
    fireEvent.click(opt)
    expect(reportArgs()).toEqual({
      requesterId: 'c-9',
      academicYearId: 'ay-1',
      branchId: 'b-1',
      kind: 'class',
      fromDate: '2025-02-28',
      toDate: '2025-05-31',
    })
  })
})

describe('catechist attendance report: filters and date grouping', () => {
  test('type select defaults to class and re-queries with meeting', () => {
    setup()
    renderPage()
    const select = screen.getAllByRole('combobox')[1]
    expect(select).toHaveTextContent('reports.catechistAttendance.type.class')
    fireEvent.pointerDown(select)
    fireEvent.click(select)
    const opt = screen.getByRole('option', {
      name: 'reports.catechistAttendance.type.meeting',
    })
    fireEvent.pointerDown(opt)
    fireEvent.click(opt)
    expect(reportArgs().kind).toBe('meeting')
    expect(screen.queryByRole('option', { name: /type\.all/ })).toBeNull()
  })

  test('skips the report query until the academic year loads', () => {
    setup()
    vi.mocked(useQuery).mockImplementation(((ref: any, args: any) => {
      const path = ref?.[Symbol.for('functionName')]
      if (path === 'catechistPermissions:getPermissions')
        return { isAdmin: true }
      if (path === REPORT_FN) return args === 'skip' ? undefined : report
      return undefined
    }) as any)
    renderPage()
    expect(reportArgs()).toBe('skip')
  })

  test('targets on the same date share one column; worst status wins', () => {
    setup({
      report: {
        ...report,
        targets: [
          { id: 's1', kind: 'class', date: '2024-10-06', label: 'Class A' },
          { id: 's2', kind: 'class', date: '2024-10-06', label: 'Class B' },
        ],
        rows: [{ ...report.rows[0], cells: ['present', 'unexcused_absence'] }],
      },
    })
    renderPage()
    expect(screen.getAllByRole('columnheader', { name: '06/10' })).toHaveLength(
      1,
    )
    const header = screen.getByRole('columnheader', { name: '06/10' })
    expect(header.querySelector('[title="Class A, Class B"]')).not.toBeNull()
    const row = rowOf('Maria Nguyen A')
    expect(row.querySelectorAll('svg[aria-label]')).toHaveLength(1)
    expect(
      within(row).getByLabelText('attendance.status.unexcused_absence'),
    ).toBeInTheDocument()
  })
})

describe('catechist attendance report: export', () => {
  test('CSV exports the full matrix with target columns and rate', () => {
    setup()
    renderPage()
    openExport()
    fireEvent.click(screen.getByText('classes.export.csv'))
    const headers = [
      'reports.catechistAttendance.col.catechist',
      '2024-10-06',
      '2024-10-13',
      'reports.catechistAttendance.col.rate',
    ]
    expect(exportCsv).toHaveBeenCalledTimes(1)
    const [rows, filename, hdrs] = vi.mocked(exportCsv).mock.calls[0]
    expect(filename).toBe('catechist-attendance.csv')
    expect(hdrs).toEqual(headers)
    expect(rows).toEqual([
      {
        [headers[0]]: 'Maria Nguyen A',
        [headers[1]]: 'attendance.status.present',
        [headers[2]]: 'attendance.status.late',
        [headers[3]]: '100%',
      },
      {
        [headers[0]]: 'Tran B',
        [headers[1]]: 'attendance.status.excused_absence',
        [headers[2]]: '',
        [headers[3]]: '0%',
      },
      {
        [headers[0]]: 'Anna Le C',
        [headers[1]]: 'attendance.status.unset',
        [headers[2]]: 'attendance.status.unexcused_absence',
        [headers[3]]: '0%',
      },
    ])
    expect(exportPdf).not.toHaveBeenCalled()
  })

  test('PDF exports per-catechist totals only', () => {
    setup()
    renderPage()
    openExport()
    fireEvent.click(screen.getByText('classes.export.pdf'))
    expect(exportPdf).toHaveBeenCalledTimes(1)
    const [rows, title, , filename, hdrs, widths] = vi.mocked(exportPdf).mock
      .calls[0] as any
    expect(title).toBe('reports.catechistAttendance.title')
    expect(filename).toBe('catechist-attendance.pdf')
    expect(hdrs).toEqual([
      'reports.catechistAttendance.col.catechist',
      'attendance.status.present',
      'attendance.status.late',
      'attendance.status.excused_absence',
      'attendance.status.unexcused_absence',
      'reports.catechistAttendance.col.rate',
    ])
    expect(widths).toHaveLength(6)
    expect(rows[0]).toEqual({
      [hdrs[0]]: 'Maria Nguyen A',
      [hdrs[1]]: 1,
      [hdrs[2]]: 1,
      [hdrs[3]]: 0,
      [hdrs[4]]: 0,
      [hdrs[5]]: '100%',
    })
    expect(rows).toHaveLength(3)
    expect(Object.keys(rows[0])).toHaveLength(6)
    expect(exportCsv).not.toHaveBeenCalled()
  })

  test('null rate exports as a dash', () => {
    setup({
      report: {
        ...report,
        rows: [
          {
            ...report.rows[2],
            totals: totals({}),
            cells: ['unrecorded', null],
          },
        ],
      },
    })
    renderPage()
    openExport()
    fireEvent.click(screen.getByText('classes.export.pdf'))
    const rows = vi.mocked(exportPdf).mock.calls[0][0] as any
    expect(Object.values(rows[0]).at(-1)).toBe('—')
  })
})
