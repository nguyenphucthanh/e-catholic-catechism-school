import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useConvex, useMutation, useQuery } from 'convex/react'
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

let appConfigData: any
let semestersData: any
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
    appConfigData = { autoLinkCatechismAttendance: false }
    semestersData = [
      { _id: 'sem1', semesterNumber: 1, name: 'HK1' },
      { _id: 'sem2', semesterNumber: 2, name: 'HK2', startDate: '2026-06-01' },
    ]
    vi.mocked(useQuery).mockImplementation((ref: any, args?: any) => {
      const path = ref?.[Symbol.for('functionName')]
      if (path === 'appConfig:get') return appConfigData
      if (path === 'academicYears:listSemesters')
        return args === 'skip' ? undefined : semestersData
      return undefined
    })
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

  describe('mass auto-link to catechism attendance', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-08-01T10:00:00Z'))
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    const renderSelect = () => {
      const Component = (Route as any).options.component
      render(<Component />)
    }
    const getSwitch = () => screen.getByRole('switch')

    test('toggle is shown for mass and hidden for extracurricular', () => {
      renderSelect()
      expect(getSwitch()).toBeInTheDocument()
      fireEvent.click(
        screen.getByText('attendance.select.type.extracurricular'),
      )
      expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    })

    test('extracurricular never passes catechismSemesterId even if config is on', async () => {
      appConfigData = { autoLinkCatechismAttendance: true }
      renderSelect()
      fireEvent.click(
        screen.getByText('attendance.select.type.extracurricular'),
      )
      fireEvent.click(screen.getByText('attendance.select.submit'))
      await screen.findByTestId('qr-scanner')
      await scan('42')
      await waitFor(() => expect(enqueueScan).toHaveBeenCalledTimes(1))
      expect(vi.mocked(enqueueScan).mock.calls[0][0]).toHaveProperty(
        'catechismSemesterId',
        undefined,
      )
    })

    test('initial toggle value follows appConfig', () => {
      appConfigData = { autoLinkCatechismAttendance: true }
      renderSelect()
      expect(getSwitch()).toBeChecked()
    })

    test('toggle is off when appConfig is off, and no semester select shows', () => {
      renderSelect()
      expect(getSwitch()).not.toBeChecked()
      expect(
        screen.queryByText('attendance.autoLink.semester'),
      ).not.toBeInTheDocument()
    })

    test('local override can turn it on over config off', () => {
      renderSelect()
      fireEvent.click(getSwitch())
      expect(getSwitch()).toBeChecked()
      expect(
        screen.getByText('attendance.autoLink.semester'),
      ).toBeInTheDocument()
    })

    test('semester is pre-selected from the session date', () => {
      appConfigData = { autoLinkCatechismAttendance: true }
      renderSelect()
      // 2026-08-01 is after sem2 start -> HK2
      expect(screen.getByText('HK2')).toBeInTheDocument()
      expect(screen.queryByText('HK1')).not.toBeInTheDocument()
    })

    test('start is disabled when auto-link is on and no semester exists', () => {
      appConfigData = { autoLinkCatechismAttendance: true }
      semestersData = []
      renderSelect()
      expect(
        screen.getByText('attendance.select.submit').closest('button'),
      ).toBeDisabled()
    })

    test('start is enabled when auto-link is off without semesters', () => {
      semestersData = []
      renderSelect()
      expect(
        screen.getByText('attendance.select.submit').closest('button'),
      ).toBeEnabled()
    })

    test('QR scan passes catechismSemesterId when on', async () => {
      appConfigData = { autoLinkCatechismAttendance: true }
      renderSelect()
      fireEvent.click(screen.getByText('attendance.select.submit'))
      await screen.findByTestId('qr-scanner')
      await scan('42')
      await waitFor(() => expect(enqueueScan).toHaveBeenCalledTimes(1))
      expect(enqueueScan).toHaveBeenCalledWith(
        expect.objectContaining({
          studentCode: '42',
          status: 'present',
          catechismSemesterId: 'sem2',
        }),
      )
    })

    test('QR scan does not pass catechismSemesterId when off', async () => {
      renderSelect()
      fireEvent.click(screen.getByText('attendance.select.submit'))
      await screen.findByTestId('qr-scanner')
      await scan('42')
      await waitFor(() => expect(enqueueScan).toHaveBeenCalledTimes(1))
      expect(vi.mocked(enqueueScan).mock.calls[0][0]).toHaveProperty(
        'catechismSemesterId',
        undefined,
      )
    })

    const toReviewUnrecorded = async () => {
      renderSelect()
      fireEvent.click(screen.getByText('attendance.select.submit'))
      await screen.findByTestId('qr-scanner')
      fireEvent.click(screen.getByText('attendance.scanning.finish'))
    }

    test('review mark-present passes the semester, absence never does', async () => {
      appConfigData = { autoLinkCatechismAttendance: true }
      await toReviewUnrecorded()
      fireEvent.click(await screen.findByText('attendance.review.excused'))
      await waitFor(() => expect(enqueueScan).toHaveBeenCalledTimes(1))
      expect(vi.mocked(enqueueScan).mock.calls[0][0]).toMatchObject({
        status: 'excused_absence',
        catechismSemesterId: undefined,
      })
      fireEvent.click(await screen.findByText('attendance.review.markPresent'))
      await waitFor(() => expect(enqueueScan).toHaveBeenCalledTimes(2))
      expect(vi.mocked(enqueueScan).mock.calls[1][0]).toMatchObject({
        status: 'present',
        catechismSemesterId: 'sem2',
      })
    })
  })
})
