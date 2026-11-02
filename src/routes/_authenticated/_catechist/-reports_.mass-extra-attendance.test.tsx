import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useQuery } from 'convex/react'
import { Route } from './reports_.mass-extra-attendance'

// Render popover content inline and replace the calendar with buttons that
// drive onSelect, so range selection is testable without the real picker.
vi.mock('~/components/ui/popover', () => ({
  Popover: ({ children }: any) => <div>{children}</div>,
  PopoverTrigger: ({ render: trigger }: any) => trigger,
  PopoverContent: ({ children }: any) => <div>{children}</div>,
}))
vi.mock('~/components/ui/calendar', () => ({
  Calendar: ({ onSelect }: any) => (
    <div>
      <button
        onClick={() =>
          onSelect({ from: new Date(2026, 9, 1), to: new Date(2026, 9, 10) })
        }
      >
        pick-short
      </button>
      <button
        onClick={() =>
          onSelect({ from: new Date(2026, 8, 1), to: new Date(2026, 9, 10) })
        }
      >
        pick-wide
      </button>
      <button
        onClick={() => onSelect({ from: new Date(2026, 9, 1), to: undefined })}
      >
        pick-from-only
      </button>
    </div>
  ),
}))
vi.mock('~/lib/export', () => ({ exportCsv: vi.fn(), exportPdf: vi.fn() }))

const record = {
  _id: 'r1',
  sessionDate: '2026-10-25',
  status: 'present',
  notes: null,
  deviceQueuedAt: 1761350400000,
  syncedAt: null,
  studentId: 'st1',
  studentCode: '123',
  fullName: 'Nguyen A',
  saintName: 'Maria',
  classId: 'c1',
  className: 'Class One',
  recordedByCatechistId: null,
  recordedByCatechistName: 'Catechist X',
}

function mockReport(data: unknown) {
  vi.mocked(useQuery).mockImplementation((() => data) as any)
}
const lastArgs = () => vi.mocked(useQuery).mock.calls.at(-1)![1]

function renderPage() {
  const Component = (Route as any).options.component
  return render(<Component />)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 31, 12, 0, 0)) // 2026-10-31 local
})
afterEach(() => {
  vi.useRealTimers()
})

describe('mass extra attendance report: query args', () => {
  test('defaults to last 31 days, today inclusive, mass type', () => {
    mockReport(undefined)
    renderPage()
    expect(lastArgs()).toEqual({
      dateFrom: '2026-10-01',
      dateTo: '2026-10-31',
      sessionType: 'mass',
    })
  })

  test('a range within 31 days is queried with local dates', () => {
    mockReport({ sessionCount: 1, records: [] })
    renderPage()
    fireEvent.click(screen.getByText('pick-short'))
    expect(lastArgs()).toEqual({
      dateFrom: '2026-10-01',
      dateTo: '2026-10-10',
      sessionType: 'mass',
    })
    expect(
      screen.queryByText('reports.massExtraAttendance.rangeTooWide'),
    ).toBeNull()
  })

  test('a range wider than 31 days skips the query and shows the alert', () => {
    mockReport({ sessionCount: 1, records: [record] })
    renderPage()
    fireEvent.click(screen.getByText('pick-wide'))
    expect(lastArgs()).toBe('skip')
    expect(
      screen.getByText('reports.massExtraAttendance.rangeTooWide'),
    ).toBeInTheDocument()
    // stale data is not shown while skipped
    expect(screen.queryByText('Class One')).toBeNull()
  })

  test('only `from` set skips the query without the too-wide alert', () => {
    mockReport({ sessionCount: 1, records: [record] })
    renderPage()
    fireEvent.click(screen.getByText('pick-from-only'))
    expect(lastArgs()).toBe('skip')
    expect(
      screen.queryByText('reports.massExtraAttendance.rangeTooWide'),
    ).toBeNull()
  })
})

describe('mass extra attendance report: rendering', () => {
  test('renders records including the session date column', () => {
    mockReport({ sessionCount: 1, records: [record] })
    renderPage()
    expect(
      screen.getByRole('columnheader', {
        name: /reports\.massExtraAttendance\.table\.sessionDate/,
      }),
    ).toBeInTheDocument()
    const row = screen.getByText('Class One').closest('tr') as HTMLElement
    expect(row).toHaveTextContent('25')
    expect(row).toHaveTextContent('Maria Nguyen A')
    expect(row).toHaveTextContent('Catechist X')
    expect(row).toHaveTextContent('attendance.status.present')
    expect(row).toHaveTextContent('—') // not yet synced
  })

  test('shows skeleton while loading', () => {
    mockReport(undefined)
    const { container } = renderPage()
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(5)
  })

  test('shows noSession text when sessionCount is 0', () => {
    mockReport({ sessionCount: 0, records: [] })
    renderPage()
    expect(
      screen.getByText('reports.massExtraAttendance.noSession'),
    ).toBeInTheDocument()
  })

  test('shows emptyRecords text when sessions exist but no records', () => {
    mockReport({ sessionCount: 2, records: [] })
    renderPage()
    expect(
      screen.getByText('reports.massExtraAttendance.emptyRecords'),
    ).toBeInTheDocument()
  })
})

describe('mass extra attendance report: export', () => {
  test('export button appears only with records and passes sessionDate', async () => {
    const { exportCsv } = await import('~/lib/export')
    mockReport({ sessionCount: 1, records: [record] })
    renderPage()
    const btn = screen.getByRole('button', { name: /classes\.export\.title/ })
    fireEvent.pointerDown(btn)
    fireEvent.click(btn)
    fireEvent.click(screen.getByText('classes.export.csv'))
    const [rows, filename] = vi.mocked(exportCsv).mock.calls[0] as any
    expect(filename).toBe('mass-attendance-2026-10-01_2026-10-31.csv')
    expect(Object.values(rows[0])).toContain('2026-10-25')
  })

  test('no export button without records', () => {
    mockReport({ sessionCount: 0, records: [] })
    renderPage()
    expect(
      screen.queryByRole('button', { name: /classes\.export\.title/ }),
    ).toBeNull()
  })
})
