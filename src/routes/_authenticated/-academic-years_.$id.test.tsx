import { describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useQuery } from 'convex/react'
import { useParams } from '@tanstack/react-router'
import { Route } from './academic-years_.$id'
import { useAuth } from '~/lib/auth'

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router')
  return {
    ...actual,
    useParams: vi.fn(),
    useNavigate: vi.fn(() => vi.fn()),
  }
})

vi.mocked(useParams).mockReturnValue({ id: 'year123' })

const sampleYear = {
  _id: 'year123',
  name: '2024-2025',
  startDate: '2024-09-01',
  endDate: '2025-05-31',
  timezone: 'Asia/Ho_Chi_Minh',
  isActive: true,
  isDeleted: false,
}

describe('AcademicYearDetailPage', () => {
  test('renders skeleton while loading', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'catechist123' },
    } as any)
    vi.mocked(useQuery).mockReturnValue(undefined)

    const DetailPage = (Route as any).options.component
    render(<DetailPage />)

    expect(screen.getByText('academicYears.detail.title')).toBeInTheDocument()
  })

  test('renders year name when data is available', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'catechist123' },
    } as any)
    vi.mocked(useQuery).mockReturnValue(sampleYear)

    const DetailPage = (Route as any).options.component
    render(<DetailPage />)

    expect(screen.getByText('2024-2025')).toBeInTheDocument()
  })

  test('renders fallback title when year is null', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'catechist123' },
    } as any)
    vi.mocked(useQuery).mockReturnValue(null)

    const DetailPage = (Route as any).options.component
    render(<DetailPage />)

    expect(screen.getByText('academicYears.detail.title')).toBeInTheDocument()
  })
})
