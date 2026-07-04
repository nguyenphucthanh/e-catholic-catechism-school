import { describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useQuery } from 'convex/react'
import { useParams } from '@tanstack/react-router'
import { Route } from './branches_.$id'
import { useAuth } from '~/lib/auth'

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router')
  return {
    ...actual,
    useParams: vi.fn(),
    useNavigate: vi.fn(() => vi.fn()),
  }
})

vi.mocked(useParams).mockReturnValue({ id: 'branch123' })

const sampleBranch = {
  _id: 'branch123',
  name: 'Ấu Nhi',
  sortOrder: 1,
  description: 'Mô tả ấu nhi',
  isDeleted: false,
}

describe('BranchDetailPage', () => {
  test('renders skeleton while loading', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'catechist123' },
    } as any)
    vi.mocked(useQuery).mockReturnValue(undefined)

    const DetailPage = (Route as any).options.component
    render(<DetailPage />)

    expect(screen.getByText('branches.detail.title')).toBeInTheDocument()
  })

  test('renders branch name when data is available', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'catechist123' },
    } as any)
    vi.mocked(useQuery).mockReturnValue(sampleBranch)

    const DetailPage = (Route as any).options.component
    render(<DetailPage />)

    expect(screen.getByText('Ấu Nhi')).toBeInTheDocument()
  })

  test('renders fallback title when branch is null', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'catechist123' },
    } as any)
    vi.mocked(useQuery).mockReturnValue(null)

    const DetailPage = (Route as any).options.component
    render(<DetailPage />)

    expect(screen.getByText('branches.detail.title')).toBeInTheDocument()
  })
})
