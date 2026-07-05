import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CatechistDashboard } from './catechist-dashboard'
import type { Id } from '../../../convex/_generated/dataModel'
import { useSelectedAcademicYear } from '~/lib/academic-year'

vi.mock('~/lib/academic-year', () => ({
  useSelectedAcademicYear: vi.fn(),
}))

vi.mock('~/components/custom/my-classes-widget', () => ({
  MyClassesWidget: vi.fn(({ requesterId, academicYearId }: any) => (
    <div
      data-testid="my-classes-widget"
      data-requester-id={requesterId}
      data-academic-year-id={academicYearId ?? ''}
    />
  )),
}))

vi.mock('~/components/custom/today-this-week-widget', () => ({
  TodayThisWeekWidget: vi.fn(({ requesterId, academicYearId }: any) => (
    <div
      data-testid="today-this-week-widget"
      data-requester-id={requesterId}
      data-academic-year-id={academicYearId ?? ''}
    />
  )),
}))

vi.mock('~/components/custom/attendance-health-widget', () => ({
  AttendanceHealthWidget: vi.fn(
    ({ requesterId, academicYearId, dateFrom, dateTo }: any) => (
      <div
        data-testid="attendance-health-widget"
        data-requester-id={requesterId}
        data-academic-year-id={academicYearId ?? ''}
        data-date-from={dateFrom}
        data-date-to={dateTo}
      />
    ),
  ),
}))

const catechistId = 'catechist1' as Id<'catechists'>

describe('CatechistDashboard', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-08T09:00:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('reads the selected academic year and passes it with requesterId to MyClassesWidget', () => {
    vi.mocked(useSelectedAcademicYear).mockReturnValue({
      selectedYearId: 'year123',
    } as any)

    render(<CatechistDashboard catechistId={catechistId} />)

    expect(useSelectedAcademicYear).toHaveBeenCalled()
    const widget = screen.getByTestId('my-classes-widget')
    expect(widget).toHaveAttribute('data-requester-id', catechistId)
    expect(widget).toHaveAttribute('data-academic-year-id', 'year123')

    const todayWidget = screen.getByTestId('today-this-week-widget')
    expect(todayWidget).toHaveAttribute('data-requester-id', catechistId)
    expect(todayWidget).toHaveAttribute('data-academic-year-id', 'year123')
  })

  test('passes a null academicYearId through when no academic year is selected', () => {
    vi.mocked(useSelectedAcademicYear).mockReturnValue({
      selectedYearId: null,
    } as any)

    render(<CatechistDashboard catechistId={catechistId} />)

    const widget = screen.getByTestId('my-classes-widget')
    expect(widget).toHaveAttribute('data-requester-id', catechistId)
    expect(widget).toHaveAttribute('data-academic-year-id', '')

    const todayWidget = screen.getByTestId('today-this-week-widget')
    expect(todayWidget).toHaveAttribute('data-requester-id', catechistId)
    expect(todayWidget).toHaveAttribute('data-academic-year-id', '')
  })

  test('passes requesterId, academicYearId, and a 28-day date range (today back 27 days) to AttendanceHealthWidget', () => {
    vi.mocked(useSelectedAcademicYear).mockReturnValue({
      selectedYearId: 'year123',
    } as any)

    render(<CatechistDashboard catechistId={catechistId} />)

    const healthWidget = screen.getByTestId('attendance-health-widget')
    expect(healthWidget).toHaveAttribute('data-requester-id', catechistId)
    expect(healthWidget).toHaveAttribute('data-academic-year-id', 'year123')
    expect(healthWidget).toHaveAttribute('data-date-to', '2026-07-08')
    expect(healthWidget).toHaveAttribute('data-date-from', '2026-06-11')
  })

  test('passes a null academicYearId through to AttendanceHealthWidget when no academic year is selected', () => {
    vi.mocked(useSelectedAcademicYear).mockReturnValue({
      selectedYearId: null,
    } as any)

    render(<CatechistDashboard catechistId={catechistId} />)

    const healthWidget = screen.getByTestId('attendance-health-widget')
    expect(healthWidget).toHaveAttribute('data-requester-id', catechistId)
    expect(healthWidget).toHaveAttribute('data-academic-year-id', '')
  })
})
