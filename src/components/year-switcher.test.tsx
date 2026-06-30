import { fireEvent, render, screen } from '@testing-library/react'
import { useQuery } from 'convex/react'
import { describe, expect, test, vi } from 'vitest'
import { YearSwitcher } from './year-switcher'
import { useSelectedAcademicYear } from '~/lib/academic-year'

vi.mock('~/lib/academic-year', () => ({
  useSelectedAcademicYear: vi.fn(),
}))

describe('YearSwitcher component', () => {
  test('renders loading skeleton when queries are loading', () => {
    vi.mocked(useSelectedAcademicYear).mockReturnValue({
      selectedYearId: null,
      setSelectedYearId: vi.fn(),
    })
    vi.mocked(useQuery).mockReturnValue(undefined) // Loading state

    const { container } = render(<YearSwitcher />)
    expect(container.querySelector('[data-slot=skeleton]')).toBeInTheDocument()
  })

  test('renders select selector trigger with year name and active marker', () => {
    const handleSelect = vi.fn()
    vi.mocked(useSelectedAcademicYear).mockReturnValue({
      selectedYearId: 'year1' as any,
      setSelectedYearId: handleSelect,
    })

    vi.mocked(useQuery).mockReturnValue([
      {
        _id: 'year1',
        name: '2024-2025',
        startDate: '2024-09-01',
        endDate: '2025-05-31',
        timezone: 'Asia/Ho_Chi_Minh',
        isActive: true,
        isDeleted: false,
      },
      {
        _id: 'year2',
        name: '2025-2026',
        startDate: '2025-09-01',
        endDate: '2026-05-31',
        timezone: 'Asia/Ho_Chi_Minh',
        isActive: false,
        isDeleted: false,
      },
    ] as any)

    render(<YearSwitcher />)

    const trigger = screen.getByRole('combobox')
    expect(trigger).toBeInTheDocument()

    // Click the trigger to open select dropdown content
    fireEvent.click(trigger)

    expect(screen.getByText(/2024-2025/)).toBeInTheDocument()
  })
})
