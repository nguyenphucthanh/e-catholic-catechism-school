import { describe, expect, test, vi } from 'vitest'
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

const catechistId = 'catechist1' as Id<'catechists'>

describe('CatechistDashboard', () => {
  test('reads the selected academic year and passes it with requesterId to MyClassesWidget', () => {
    vi.mocked(useSelectedAcademicYear).mockReturnValue({
      selectedYearId: 'year123',
    } as any)

    render(<CatechistDashboard catechistId={catechistId} />)

    expect(useSelectedAcademicYear).toHaveBeenCalled()
    const widget = screen.getByTestId('my-classes-widget')
    expect(widget).toHaveAttribute('data-requester-id', catechistId)
    expect(widget).toHaveAttribute('data-academic-year-id', 'year123')
  })

  test('passes a null academicYearId through when no academic year is selected', () => {
    vi.mocked(useSelectedAcademicYear).mockReturnValue({
      selectedYearId: null,
    } as any)

    render(<CatechistDashboard catechistId={catechistId} />)

    const widget = screen.getByTestId('my-classes-widget')
    expect(widget).toHaveAttribute('data-requester-id', catechistId)
    expect(widget).toHaveAttribute('data-academic-year-id', '')
  })
})
