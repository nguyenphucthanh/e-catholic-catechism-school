import { beforeEach, describe, expect, test, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useConvex, useMutation } from 'convex/react'
import { Route } from './attendance'
import { useAuth } from '~/lib/auth'
import { playBeep } from '~/lib/beep'
import { enqueueScan } from '~/lib/offline-db'

const scanner = vi.hoisted(() => ({
  onScan: undefined as undefined | ((raw: string) => void),
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: vi.fn(() => (options: any) => ({ options })),
  useNavigate: () => vi.fn(),
}))
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}))
vi.mock('~/lib/academic-year', () => ({
  useSelectedAcademicYear: () => ({ selectedYearId: 'ay-1' }),
}))
vi.mock('~/lib/beep', () => ({ playBeep: vi.fn() }))
vi.mock('~/lib/offline-db', () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
  cacheStudents: vi.fn().mockResolvedValue(undefined),
  enqueueScan: vi.fn().mockResolvedValue(undefined),
  getSessionRecordsFromQueue: vi.fn().mockResolvedValue([]),
}))
vi.mock('~/hooks/use-attendance-sync', () => ({
  useAttendanceSync: () => ({
    isOnline: true,
    syncStatus: 'idle',
    pendingCount: 0,
    syncNow: vi.fn(),
  }),
}))
vi.mock('~/components/custom/qr-scanner', () => ({
  QRScanner: ({ onScan }: { onScan: (raw: string) => void }) => {
    scanner.onScan = onScan
    return <div data-testid="qr-scanner" />
  },
}))

const queryMock = vi.fn()
const openSessionMock = vi.fn()

async function startScanning() {
  const Component = (Route as any).options.component
  render(<Component />)
  fireEvent.click(screen.getByText('attendance.select.submit'))
  await screen.findByTestId('qr-scanner')
}
const scan = async (raw: string) => {
  await act(async () => {
    scanner.onScan!(raw)
    await Promise.resolve()
  })
}

describe('student attendance QR scanning', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: { userDocId: 'cat-1', accountType: 'catechist' } as any,
    })
    openSessionMock.mockReset().mockResolvedValue({ _id: 'sess-1' })
    queryMock.mockReset().mockResolvedValue({
      students: [
        {
          studentId: 's1',
          studentClassId: 'sc1',
          studentCode: '42',
          fullName: 'Nguyen A',
          saintName: 'Maria',
          className: 'Class A',
        },
      ],
      records: [],
    })
    vi.mocked(useMutation).mockReturnValue(openSessionMock as any)
    vi.mocked(useConvex).mockReturnValue({ query: queryMock } as any)
    vi.mocked(playBeep).mockClear()
    vi.mocked(enqueueScan).mockClear()
  })

  test('a catechist QR shows the not-a-student-card overlay with an error beep and no attendance writes', async () => {
    await startScanning()
    await scan('{"type":"catechist","memberId":"GLV1"}')
    expect(
      await screen.findByText('attendance.scanning.overlay.unknown'),
    ).toBeInTheDocument()
    expect(playBeep).toHaveBeenCalledWith('error')
    expect(enqueueScan).not.toHaveBeenCalled()
    // only the session-open mutation was ever invoked
    expect(openSessionMock).toHaveBeenCalledTimes(1)
  })

  test('a raw student code is still recorded', async () => {
    await startScanning()
    await scan('42')
    await waitFor(() => expect(enqueueScan).toHaveBeenCalledTimes(1))
    expect(enqueueScan).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'sess-1',
        studentCode: '42',
        status: 'present',
      }),
    )
    expect(playBeep).toHaveBeenCalledWith('success')
  })

  test('an unknown raw code still shows the invalid-code overlay', async () => {
    await startScanning()
    await scan('999')
    expect(playBeep).toHaveBeenCalledWith('error')
    expect(enqueueScan).not.toHaveBeenCalled()
  })
})
