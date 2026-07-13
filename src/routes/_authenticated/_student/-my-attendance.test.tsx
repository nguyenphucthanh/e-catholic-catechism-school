import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useQuery } from 'convex/react'
import { Route } from './my-attendance'
import { useAuth } from '~/lib/auth'
import { formatDateTime } from '~/lib/locale'

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options?.name ? `${key}:${options.name}` : key,
    i18n: { language: 'en-US' },
  })),
}))

vi.mock('~/lib/auth', () => ({
  useAuth: vi.fn(),
}))

const mockStudentUser = {
  _id: 'user123',
  userDocId: 'student123',
  fullName: 'Student User',
  role: 'user',
  accountType: 'student',
} as any

function setupQuery(records: any) {
  vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
    const path = queryRef?.[Symbol.for('functionName')]
    if (path === 'attendance:listMyParishAttendance') return records
    return undefined
  })
}

const MyAttendancePageComponent = (Route as any).options.component

describe('MyAttendancePage component', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockStudentUser,
    })
  })

  test('renders loading skeleton while records are undefined', () => {
    setupQuery(undefined)

    const { container } = render(<MyAttendancePageComponent />)

    expect(screen.getByText('nav.myAttendance')).toBeInTheDocument()
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBe(3)
    expect(screen.queryByText('myAttendance.empty')).not.toBeInTheDocument()
  })

  test('renders empty state when there are no records', () => {
    setupQuery([])

    render(<MyAttendancePageComponent />)

    expect(screen.getByText('myAttendance.empty')).toBeInTheDocument()
  })

  test('groups records by month and renders date, catechist, and badges', () => {
    const julyTs = new Date('2026-07-08T10:00:00').getTime()
    const juneTs = new Date('2026-06-15T09:00:00').getTime()

    setupQuery([
      {
        _id: 'record1',
        status: 'present',
        notes: null,
        deviceQueuedAt: julyTs,
        sessionType: 'mass',
        sessionDate: '2026-07-08',
        classId: null,
        className: null,
        recordedByCatechistId: 'catechist1',
        recordedByCatechistName: 'Maria Catechist Name',
      },
      {
        _id: 'record2',
        status: 'late',
        notes: null,
        deviceQueuedAt: juneTs,
        sessionType: 'extracurricular',
        sessionDate: '2026-06-15',
        classId: null,
        className: null,
        recordedByCatechistId: 'catechist1',
        recordedByCatechistName: 'Maria Catechist Name',
      },
    ])

    render(<MyAttendancePageComponent />)

    // Grouped by month heading (locale-formatted "long month + year").
    expect(
      screen.getByText(
        new Date(julyTs).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
        }),
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        new Date(juneTs).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
        }),
      ),
    ).toBeInTheDocument()

    // Formatted date/time and recordedBy text.
    expect(screen.getByText(formatDateTime(julyTs))).toBeInTheDocument()
    expect(
      screen.getAllByText('myAttendance.recordedBy:Maria Catechist Name'),
    ).toHaveLength(2)

    // Session type + status badges.
    expect(screen.getByText('attendance.sessionType.mass')).toBeInTheDocument()
    expect(
      screen.getByText('attendance.sessionType.extracurricular'),
    ).toBeInTheDocument()
    expect(screen.getByText('attendance.status.present')).toBeInTheDocument()
    expect(screen.getByText('attendance.status.late')).toBeInTheDocument()
  })
})
