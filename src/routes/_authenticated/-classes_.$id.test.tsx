import { describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useQuery } from 'convex/react'
import { useParams } from '@tanstack/react-router'
import { Route } from './classes_.$id'
import { useAuth } from '~/lib/auth'

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router')
  return {
    ...actual,
    useParams: vi.fn(),
    useNavigate: vi.fn(() => vi.fn()),
  }
})

vi.mocked(useParams).mockReturnValue({ id: 'class123' })

const sampleClass = {
  _id: 'class123',
  name: 'Ấu Nhi 1',
  branchId: 'branch123',
  description: 'Lớp ấu nhi',
  isDeleted: false,
}

describe('ClassDetailPage', () => {
  test('renders skeleton while loading', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'catechist123' },
    } as any)
    vi.mocked(useQuery).mockReturnValue(undefined)

    const DetailPage = (Route as any).options.component
    render(<DetailPage />)

    expect(screen.getByText('classes.detail.title')).toBeInTheDocument()
  })

  test('renders class name when data is available', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'catechist123' },
    } as any)
    vi.mocked(useQuery).mockReturnValue(sampleClass)

    const DetailPage = (Route as any).options.component
    render(<DetailPage />)

    expect(screen.getByText('Ấu Nhi 1')).toBeInTheDocument()
  })

  test('renders fallback title when class is null', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'catechist123' },
    } as any)
    vi.mocked(useQuery).mockReturnValue(null)

    const DetailPage = (Route as any).options.component
    render(<DetailPage />)

    expect(screen.getByText('classes.detail.title')).toBeInTheDocument()
  })
})
