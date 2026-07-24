import { describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { InactiveYearAlert } from './inactive-year-alert'
import { useInactiveYear } from '~/lib/academic-year'

vi.mock('~/lib/academic-year', () => ({
  useInactiveYear: vi.fn(),
}))

describe('InactiveYearAlert', () => {
  test('renders nothing when the selected year is active', () => {
    vi.mocked(useInactiveYear).mockReturnValue({
      isInactive: false,
      yearName: null,
    })

    const { container } = render(<InactiveYearAlert />)
    expect(container).toBeEmptyDOMElement()
  })

  test('renders the alert with title and description when the year is inactive', () => {
    vi.mocked(useInactiveYear).mockReturnValue({
      isInactive: true,
      yearName: '2023-2024',
    })

    render(<InactiveYearAlert />)
    expect(screen.getByText('inactiveYear.title')).toBeInTheDocument()
    expect(screen.getByText('inactiveYear.description')).toBeInTheDocument()
  })

  test('renders the alert even when yearName is null', () => {
    vi.mocked(useInactiveYear).mockReturnValue({
      isInactive: true,
      yearName: null,
    })

    render(<InactiveYearAlert />)
    expect(screen.getByText('inactiveYear.title')).toBeInTheDocument()
    expect(screen.getByText('inactiveYear.description')).toBeInTheDocument()
  })
})
